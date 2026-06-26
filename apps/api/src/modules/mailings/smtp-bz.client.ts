import net from "node:net";
import tls from "node:tls";
import { config } from "../../config.js";
import { DomainError } from "../../domain/result.js";
import type { MailingContactRecord, SmtpBzMessage } from "./mailing.types.js";

export type SendMassEmailInput = {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  tag: string;
  contacts: Array<Pick<MailingContactRecord, "email" | "name">>;
};

export interface MailingTransport {
  sendMass(input: SendMassEmailInput): Promise<{ accepted: number; raw: unknown }>;
  fetchMessagesByTag(tag: string): Promise<SmtpBzMessage[]>;
}

type SmtpConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  clientDomain: string;
  secure: boolean;
  startTls: boolean;
  rejectUnauthorized: boolean;
};

export class SmtpBzClient implements MailingTransport {
  constructor(
    private readonly apiKey = config.SMTP_BZ_API_KEY,
    private readonly baseUrl = config.SMTP_BZ_BASE_URL.replace(/\/$/, ""),
    private readonly smtpConfig = {
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      username: config.SMTP_USERNAME,
      password: config.SMTP_PASSWORD,
      clientDomain: config.SMTP_CLIENT_DOMAIN,
      secure: config.SMTP_SECURE,
      startTls: config.SMTP_STARTTLS,
      rejectUnauthorized: config.SMTP_TLS_REJECT_UNAUTHORIZED,
    }
  ) {}

  async sendMass(input: SendMassEmailInput) {
    if (!this.apiKey) {
      return this.sendViaSmtp(input);
    }

    const form = new FormData();
    form.set("from", input.fromEmail);
    if (input.fromName) form.set("name", input.fromName);
    form.set("subject", input.subject);
    form.set("to", JSON.stringify(input.contacts.map((contact) => toSmtpRecipient(contact))));
    if (input.replyTo) form.set("reply", input.replyTo);
    form.set("html", input.html);
    if (input.text) form.set("text", input.text);
    form.set("tag", input.tag);
    form.set(
      "headers",
      JSON.stringify([
        {
          "X-Tag": input.tag,
        },
      ])
    );

    const response = await fetch(`${this.baseUrl}/smtp/mass`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey ?? "",
      },
      body: form,
    });

    const body = await safeJson(response);
    if (!response.ok) {
      throw new DomainError(
        response.status === 401 ? "unauthorized" : "provider_unavailable",
        smtpErrorMessage(body, `SMTP.BZ rejected the campaign with ${response.status}.`),
        response.status === 401 ? 401 : 503
      );
    }

    return {
      accepted: input.contacts.length,
      raw: body,
    };
  }

  async fetchMessagesByTag(tag: string) {
    if (!this.apiKey) return [];

    const url = new URL(`${this.baseUrl}/log/message`);
    url.searchParams.set("tag", tag);
    url.searchParams.set("limit", "500");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: this.apiKey ?? "",
      },
    });

    if (response.status === 404) return [];

    const body = await safeJson(response);
    if (!response.ok) {
      throw new DomainError(
        response.status === 401 ? "unauthorized" : "provider_unavailable",
        smtpErrorMessage(body, `SMTP.BZ log sync failed with ${response.status}.`),
        response.status === 401 ? 401 : 503
      );
    }

    return extractMessageRows(body).map(normalizeSmtpMessage).filter((message) => Boolean(message.to));
  }

  private async sendViaSmtp(input: SendMassEmailInput) {
    const smtpConfig = this.getVerifiedSmtpConfig();

    let accepted = 0;
    for (const contact of input.contacts) {
      await sendSmtpMessage({
        config: smtpConfig,
        fromEmail: input.fromEmail,
        fromName: input.fromName,
        replyTo: input.replyTo,
        recipient: contact,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tag: input.tag,
      });
      accepted += 1;
    }

    return {
      accepted,
      raw: {
        transport: "smtp",
        accepted,
      },
    };
  }

  private getVerifiedSmtpConfig(): SmtpConfig {
    const { host, username, password, port, clientDomain, secure, startTls, rejectUnauthorized } = this.smtpConfig;
    if (!host || !username || !password) {
      throw new DomainError(
        "provider_unavailable",
        "SMTP credentials are not configured. Set SMTP_BZ_API_KEY or SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD on the API server.",
        503
      );
    }

    return {
      host,
      port,
      username,
      password,
      clientDomain,
      secure,
      startTls,
      rejectUnauthorized,
    };
  }
}

type SmtpSocket = net.Socket | tls.TLSSocket;

async function sendSmtpMessage(input: {
  config: SmtpConfig;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  recipient: Pick<MailingContactRecord, "email" | "name">;
  subject: string;
  html: string;
  text: string;
  tag: string;
}) {
  const fromEmail = sanitizeSmtpAddress(input.fromEmail, "sender email");
  const recipientEmail = sanitizeSmtpAddress(input.recipient.email, "recipient email");
  const clientDomain = sanitizeEhloDomain(input.config.clientDomain);
  const message = buildMimeMessage({
    ...input,
    fromEmail,
    recipient: {
      ...input.recipient,
      email: recipientEmail,
    },
  });
  let socket = await connectSmtp(input.config);
  try {
    await readSmtpResponse(socket, [220]);
    await writeSmtpCommand(socket, `EHLO ${clientDomain}`, [250]);

    if (!input.config.secure && input.config.startTls) {
      await writeSmtpCommand(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket, input.config);
      await writeSmtpCommand(socket, `EHLO ${clientDomain}`, [250]);
    }

    await writeSmtpCommand(socket, "AUTH LOGIN", [334]);
    await writeSmtpCommand(socket, Buffer.from(input.config.username).toString("base64"), [334]);
    await writeSmtpCommand(socket, Buffer.from(input.config.password).toString("base64"), [235]);
    await writeSmtpCommand(socket, `MAIL FROM:<${fromEmail}>`, [250]);
    await writeSmtpCommand(socket, `RCPT TO:<${recipientEmail}>`, [250, 251]);
    await writeSmtpCommand(socket, "DATA", [354]);
    await writeSmtpCommand(socket, `${message}\r\n.`, [250]);
    await writeSmtpCommand(socket, "QUIT", [221]);
  } catch (error) {
    throw new DomainError(
      "provider_unavailable",
      error instanceof Error ? error.message : "SMTP send failed.",
      503
    );
  } finally {
    socket.destroy();
  }
}

function connectSmtp(config: {
  host: string;
  port: number;
  secure: boolean;
  rejectUnauthorized: boolean;
}): Promise<SmtpSocket> {
  return new Promise((resolve, reject) => {
    const socket = config.secure
      ? tls.connect({
          host: config.host,
          port: config.port,
          servername: config.host,
          rejectUnauthorized: config.rejectUnauthorized,
        })
      : net.connect({
          host: config.host,
          port: config.port,
        });

    if (config.secure) {
      socket.once("secureConnect", () => resolve(socket));
    } else {
      socket.once("connect", () => resolve(socket));
    }
    socket.once("error", reject);
    socket.setTimeout(30_000, () => {
      socket.destroy(new Error("SMTP connection timed out."));
    });
  });
}

function upgradeToTls(
  socket: SmtpSocket,
  config: { host: string; rejectUnauthorized: boolean }
): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({
      socket,
      servername: config.host,
      rejectUnauthorized: config.rejectUnauthorized,
    });
    secureSocket.once("secureConnect", () => resolve(secureSocket));
    secureSocket.once("error", reject);
    secureSocket.setTimeout(30_000, () => {
      secureSocket.destroy(new Error("SMTP TLS handshake timed out."));
    });
  });
}

async function writeSmtpCommand(socket: SmtpSocket, command: string, expectedCodes: number[]) {
  socket.write(`${command}\r\n`);
  return readSmtpResponse(socket, expectedCodes);
}

function readSmtpResponse(socket: SmtpSocket, expectedCodes: number[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1];
      const match = lastLine?.match(/^(\d{3})\s/);
      if (!match) return;

      cleanup();
      const code = Number(match[1]);
      if (expectedCodes.includes(code)) {
        resolve(buffer);
        return;
      }
      reject(new Error(`SMTP server returned ${code}: ${buffer.trim()}`));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.once("error", onError);
  });
}

function buildMimeMessage(input: {
  fromEmail: string;
  fromName: string;
  replyTo: string;
  recipient: Pick<MailingContactRecord, "email" | "name">;
  subject: string;
  html: string;
  text: string;
  tag: string;
}) {
  const boundary = `nomduchat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const text = input.text || stripHtml(input.html);
  const recipientName = formatMailbox(input.recipient.email, input.recipient.name ?? undefined);
  const fromName = formatMailbox(input.fromEmail, input.fromName);
  const replyTo = input.replyTo ? sanitizeSmtpAddress(input.replyTo, "reply-to email") : "";
  const headers = [
    `From: ${fromName}`,
    `To: ${recipientName}`,
    replyTo ? `Reply-To: ${replyTo}` : "",
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `X-Tag: ${sanitizeHeaderToken(input.tag, "campaign tag")}`,
  ].filter(Boolean);

  return [
    ...headers,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(input.html),
    `--${boundary}--`,
  ].join("\r\n");
}

function encodeHeader(value: string) {
  const safeValue = sanitizeHeaderValue(value, "header");
  if (/^[\x20-\x7e]+$/.test(safeValue)) return safeValue;
  return `=?UTF-8?B?${Buffer.from(safeValue, "utf8").toString("base64")}?=`;
}

function formatMailbox(email: string, name?: string) {
  const safeEmail = sanitizeSmtpAddress(email, "mailbox email");
  const safeName = sanitizeHeaderValue(name ?? "", "mailbox name");
  if (!safeName) return safeEmail;

  return `${encodeDisplayName(safeName)} <${safeEmail}>`;
}

function encodeDisplayName(value: string) {
  const safeValue = sanitizeHeaderValue(value, "display name");
  if (/^[\x20-\x7e]+$/.test(safeValue)) {
    return `"${safeValue.replace(/["\\]/g, "\\$&")}"`;
  }

  return `=?UTF-8?B?${Buffer.from(safeValue, "utf8").toString("base64")}?=`;
}

function sanitizeSmtpAddress(value: string, field: string) {
  const email = sanitizeHeaderValue(value, field).trim().toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) {
    throw new DomainError("validation_failed", `Invalid ${field}.`);
  }

  return email;
}

function sanitizeHeaderToken(value: string, field: string) {
  const token = sanitizeHeaderValue(value, field).trim();
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(token)) {
    throw new DomainError("validation_failed", `Invalid ${field}.`);
  }

  return token;
}

function sanitizeEhloDomain(value: string) {
  const domain = sanitizeHeaderValue(value, "SMTP client domain").toLowerCase();
  if (!/^[a-z0-9.-]{1,253}$/.test(domain)) {
    throw new DomainError("validation_failed", "Invalid SMTP client domain.");
  }

  return domain;
}

function sanitizeHeaderValue(value: string, field: string) {
  if (/[\x00-\x08\x0a-\x1f\x7f]/.test(value)) {
    throw new DomainError("validation_failed", `Invalid ${field}.`);
  }

  return value.trim();
}

function wrapBase64(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/.{1,76}/g, "$&\r\n")
    .trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSmtpRecipient(contact: Pick<MailingContactRecord, "email" | "name">) {
  if (!contact.name) return contact.email;

  return {
    name: contact.name,
    address: contact.email,
  };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function smtpErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  const message = record.message ?? record.error ?? record.error_message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function extractMessageRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];

  const record = body as Record<string, unknown>;
  for (const key of ["data", "messages", "items", "result", "rows"]) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = extractMessageRows(value);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function normalizeSmtpMessage(row: unknown): SmtpBzMessage {
  const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const to = firstString(record, ["to", "email", "address", "recipient", "to_email"]);
  const status = firstString(record, ["status", "state", "delivery_status"]);
  const id = firstString(record, ["id", "messageid", "message_id", "messageId"]);
  const createdAt = firstString(record, ["created_at", "createdAt", "date", "sent_at"]);

  return {
    id,
    to: to?.toLowerCase(),
    status,
    isOpen: firstBoolean(record, ["is_open", "isOpen", "open", "opened"]),
    isUnsubscribe: firstBoolean(record, ["is_unsubscribe", "isUnsubscribe", "unsubscribe", "unsubscribed"]),
    createdAt,
    raw: row,
  };
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return undefined;
}

function firstBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (["1", "true", "yes", "open", "opened", "unsubscribe", "unsubscribed"].includes(normalized)) return true;
      if (["0", "false", "no"].includes(normalized)) return false;
    }
  }

  return false;
}
