import { config } from "../../config.js";
import type { MailingTransport } from "../mailings/smtp-bz.client.js";
import { SmtpBzClient } from "../mailings/smtp-bz.client.js";

type TransactionalContact = {
  email: string;
  name?: string | null;
};

type CheckoutEmailInput = TransactionalContact & {
  planName: string;
  amount: string;
  checkoutUrl?: string;
};

type PaidEmailInput = TransactionalContact & {
  planName: string;
  amount: string;
  periodEnd: string;
};

type UnpaidReminderEmailInput = TransactionalContact & {
  day: 1 | 3;
};

type TariffEndingReminderEmailInput = TransactionalContact & {
  planName: string;
  periodEnd: string;
};

export interface TransactionalMailer {
  sendWelcome(input: TransactionalContact): Promise<void>;
  sendCheckoutCreated(input: CheckoutEmailInput): Promise<void>;
  sendSubscriptionPaid(input: PaidEmailInput): Promise<void>;
  sendUnpaidSubscriptionReminder(input: UnpaidReminderEmailInput): Promise<void>;
  sendTariffEndingReminder(input: TariffEndingReminderEmailInput): Promise<void>;
}

export class MailingTransactionalMailer implements TransactionalMailer {
  constructor(private readonly transport: MailingTransport = new SmtpBzClient()) {}

  async sendWelcome(input: TransactionalContact) {
    await this.send({
      contact: input,
      subject: "Добро пожаловать в nomduchat",
      title: "Аккаунт nomduchat создан",
      lines: [
        `Здравствуйте${input.name ? `, ${input.name}` : ""}.`,
        "Вы можете продолжить работу в чате, сохранить историю запросов и подключить подходящий тариф.",
      ],
      cta: {
        label: "Открыть nomduchat",
        url: `${config.WEB_APP_URL.replace(/\/$/, "")}/workspace`,
      },
      tag: "welcome",
    });
  }

  async sendCheckoutCreated(input: CheckoutEmailInput) {
    await this.send({
      contact: input,
      subject: "Оплата тарифа nomduchat",
      title: "Платеж создан",
      lines: [
        `Тариф: ${input.planName}.`,
        `Сумма: ${input.amount}.`,
        "Если вы уже завершили оплату, тариф активируется автоматически после подтверждения платежа.",
      ],
      cta: input.checkoutUrl?.startsWith("http")
        ? {
            label: "Продолжить оплату",
            url: input.checkoutUrl,
          }
        : undefined,
      tag: "subscription_checkout",
    });
  }

  async sendSubscriptionPaid(input: PaidEmailInput) {
    await this.send({
      contact: input,
      subject: "Тариф nomduchat активирован",
      title: "Подписка активна",
      lines: [
        `Тариф: ${input.planName}.`,
        `Сумма: ${input.amount}.`,
        `Период действует до ${input.periodEnd}.`,
      ],
      cta: {
        label: "Открыть подписку",
        url: `${config.WEB_APP_URL.replace(/\/$/, "")}/workspace/balance`,
      },
      tag: "subscription_paid",
    });
  }

  async sendUnpaidSubscriptionReminder(input: UnpaidReminderEmailInput) {
    await this.send({
      contact: input,
      subject: input.day === 1 ? "Продолжите настройку nomduchat" : "Тариф nomduchat еще не подключен",
      title: input.day === 1 ? "Аккаунт готов к работе" : "Вы еще не выбрали тариф",
      lines: [
        input.day === 1
          ? "Вы зарегистрировались в nomduchat, но тариф пока не подключен."
          : "Прошло несколько дней после регистрации, а тариф все еще не активирован.",
        "В тарифе открываются расширенные лимиты, изображения, видео, музыка, avatar-video и бизнес-инструменты.",
      ],
      cta: {
        label: "Выбрать тариф",
        url: `${config.WEB_APP_URL.replace(/\/$/, "")}/workspace/balance`,
      },
      tag: `subscription_unpaid_day_${input.day}`,
    });
  }

  async sendTariffEndingReminder(input: TariffEndingReminderEmailInput) {
    await this.send({
      contact: input,
      subject: "Скоро закончится период тарифа nomduchat",
      title: "Период тарифа подходит к концу",
      lines: [
        `Тариф: ${input.planName}.`,
        `Текущий период действует до ${input.periodEnd}.`,
        "Проверьте автопродление и способ оплаты, чтобы доступ к расширенным возможностям не прерывался.",
      ],
      cta: {
        label: "Открыть подписку",
        url: `${config.WEB_APP_URL.replace(/\/$/, "")}/workspace/balance`,
      },
      tag: "subscription_period_ending",
    });
  }

  private async send(input: {
    contact: TransactionalContact;
    subject: string;
    title: string;
    lines: string[];
    cta?: { label: string; url: string };
    tag: string;
  }) {
    const fromEmail = config.TRANSACTIONAL_FROM_EMAIL ?? config.PASSWORD_RESET_FROM_EMAIL ?? config.SMTP_USERNAME ?? "admin@nomduchat.com";
    const fromName = config.TRANSACTIONAL_FROM_NAME;
    const text = [
      input.title,
      "",
      ...input.lines,
      ...(input.cta ? ["", `${input.cta.label}: ${input.cta.url}`] : []),
    ].join("\n");

    await this.transport.sendMass({
      fromEmail,
      fromName,
      replyTo: fromEmail,
      subject: input.subject,
      html: transactionalHtml(input),
      text,
      tag: `${input.tag}_${Date.now()}`,
      contacts: [{ email: input.contact.email, name: input.contact.name ?? null }],
    });
  }
}

function transactionalHtml(input: {
  contact: TransactionalContact;
  title: string;
  lines: string[];
  cta?: { label: string; url: string };
}) {
  const escapedName = escapeHtml(input.contact.name || "пользователь");
  const escapedTitle = escapeHtml(input.title);
  const body = input.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const cta = input.cta
    ? `<p><a href="${escapeHtml(input.cta.url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px">${escapeHtml(input.cta.label)}</a></p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 16px">${escapedTitle}</h2>
      <p>Здравствуйте, ${escapedName}.</p>
      ${body}
      ${cta}
      <p style="font-size:13px;color:#666">Это сервисное письмо nomduchat.</p>
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
