import { config } from "../../config.js";
import type { MailingTransport } from "../mailings/smtp-bz.client.js";
import { SmtpBzClient } from "../mailings/smtp-bz.client.js";

export type PasswordResetMailInput = {
  email: string;
  name: string;
  resetUrl: string;
};

export interface PasswordResetMailer {
  sendPasswordReset(input: PasswordResetMailInput): Promise<void>;
}

export class MailingPasswordResetMailer implements PasswordResetMailer {
  constructor(private readonly transport: MailingTransport = new SmtpBzClient()) {}

  async sendPasswordReset(input: PasswordResetMailInput) {
    const fromEmail = config.PASSWORD_RESET_FROM_EMAIL ?? config.SMTP_USERNAME ?? "admin@nomduchat.com";
    const fromName = config.PASSWORD_RESET_FROM_NAME;
    const subject = "Сброс пароля nomduchat";
    const text = [
      `Здравствуйте${input.name ? `, ${input.name}` : ""}.`,
      "",
      "Чтобы задать новый пароль для аккаунта nomduchat, откройте ссылку:",
      input.resetUrl,
      "",
      `Ссылка действует ${config.PASSWORD_RESET_TTL_MINUTES} минут. Если вы не запрашивали сброс, просто проигнорируйте это письмо.`,
    ].join("\n");

    await this.transport.sendMass({
      fromEmail,
      fromName,
      replyTo: fromEmail,
      subject,
      html: passwordResetHtml(input),
      text,
      tag: `password_reset_${Date.now()}`,
      contacts: [{ email: input.email, name: input.name }],
    });
  }
}

function passwordResetHtml(input: PasswordResetMailInput) {
  const escapedName = escapeHtml(input.name || "пользователь");
  const escapedUrl = escapeHtml(input.resetUrl);

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 16px">Сброс пароля nomduchat</h2>
      <p>Здравствуйте, ${escapedName}.</p>
      <p>Чтобы задать новый пароль, нажмите кнопку ниже. Ссылка действует ${config.PASSWORD_RESET_TTL_MINUTES} минут.</p>
      <p>
        <a href="${escapedUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px">
          Задать новый пароль
        </a>
      </p>
      <p style="font-size:13px;color:#666">Если кнопка не открывается, скопируйте ссылку: ${escapedUrl}</p>
      <p style="font-size:13px;color:#666">Если вы не запрашивали сброс, письмо можно удалить.</p>
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
