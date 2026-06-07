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

export class SmtpBzClient implements MailingTransport {
  constructor(
    private readonly apiKey = config.SMTP_BZ_API_KEY,
    private readonly baseUrl = config.SMTP_BZ_BASE_URL.replace(/\/$/, "")
  ) {}

  async sendMass(input: SendMassEmailInput) {
    this.ensureConfigured();

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
    this.ensureConfigured();

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

  private ensureConfigured() {
    if (!this.apiKey) {
      throw new DomainError(
        "provider_unavailable",
        "SMTP.BZ API key is not configured. Set SMTP_BZ_API_KEY on the API server.",
        503
      );
    }
  }
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
