import { config } from "../../config.js";
import { DomainError, fail, ok } from "../../domain/result.js";
import type { MailingTransport } from "../mailings/smtp-bz.client.js";
import type { CreateSupportTicketInput } from "./support.types.js";
import type { SupportRepository } from "./support.repository.js";

export class SupportService {
  constructor(
    private readonly repository: SupportRepository,
    private readonly transport?: MailingTransport
  ) {}

  async createTicket(input: CreateSupportTicketInput) {
    const email = input.email.trim().toLowerCase();
    const message = input.message.trim();
    const name = input.name?.trim() || null;

    if (!message) {
      return fail(new DomainError("validation_failed", "Support message is required.", 400));
    }

    const ticket = await this.repository.create({
      ...input,
      email,
      name,
      message,
      pageUrl: input.pageUrl?.trim() || null,
    });

    await this.sendBestEffort(ticket);

    return ok({ ticket });
  }

  private async sendBestEffort(ticket: {
    id: string;
    email: string;
    name: string | null;
    topic: string;
    message: string;
    metadata: Record<string, unknown>;
  }) {
    try {
      await this.transport?.sendMass({
        fromEmail: config.TRANSACTIONAL_FROM_EMAIL ?? config.PASSWORD_RESET_FROM_EMAIL ?? config.SMTP_USERNAME ?? config.SUPPORT_EMAIL,
        fromName: config.TRANSACTIONAL_FROM_NAME,
        replyTo: ticket.email,
        subject: `nomduchat support: ${topicLabel(ticket.topic)} #${ticket.id.slice(0, 8)}`,
        html: supportHtml(ticket),
        text: supportText(ticket),
        tag: `support_${ticket.id}`,
        contacts: [{ email: config.SUPPORT_EMAIL, name: "nomduchat support" }],
      });
    } catch {
      // Ticket is already saved; email delivery is best-effort.
    }
  }
}

function topicLabel(topic: string) {
  if (topic === "billing") return "оплата";
  if (topic === "access") return "доступ";
  if (topic === "refund") return "возврат";
  if (topic === "technical") return "технический вопрос";
  return "другое";
}

function supportText(ticket: {
  id: string;
  email: string;
  name: string | null;
  topic: string;
  message: string;
  metadata: Record<string, unknown>;
}) {
  return [
    `Ticket: ${ticket.id}`,
    `Topic: ${topicLabel(ticket.topic)}`,
    `Name: ${ticket.name ?? "-"}`,
    `Email: ${ticket.email}`,
    ticket.metadata.pageUrl ? `Page: ${String(ticket.metadata.pageUrl)}` : null,
    "",
    ticket.message,
  ]
    .filter(Boolean)
    .join("\n");
}

function supportHtml(ticket: Parameters<typeof supportText>[0]) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2>Новое обращение nomduchat</h2>
      <p><b>Ticket:</b> ${escapeHtml(ticket.id)}</p>
      <p><b>Тема:</b> ${escapeHtml(topicLabel(ticket.topic))}</p>
      <p><b>Имя:</b> ${escapeHtml(ticket.name ?? "-")}</p>
      <p><b>Email:</b> ${escapeHtml(ticket.email)}</p>
      ${ticket.metadata.pageUrl ? `<p><b>Страница:</b> ${escapeHtml(String(ticket.metadata.pageUrl))}</p>` : ""}
      <p style="white-space:pre-wrap">${escapeHtml(ticket.message)}</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
