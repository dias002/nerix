import { randomUUID } from "node:crypto";
import { DomainError, fail, ok, type Result } from "../../domain/result.js";
import type {
  CreateMailingCampaignInput,
  MailingAudienceRecord,
  MailingCampaignRecord,
  MailingContactInput,
  MailingContactRecord,
  MailingImportSummary,
  MailingRecipientRecord,
  MailingSendSummary,
  MailingSyncSummary,
} from "./mailing.types.js";
import type { MailingRepository } from "./mailing.repository.js";
import type { MailingTransport } from "./smtp-bz.client.js";

const maxRawContactsLength = 2_000_000;
const maxContactsPerImport = 20_000;
const maxCampaignHtmlLength = 400_000;

export class MailingService {
  constructor(
    private readonly repository: MailingRepository,
    private readonly transport: MailingTransport
  ) {}

  async listAudiences(userId: string): Promise<Result<{ audiences: MailingAudienceRecord[] }>> {
    return ok({
      audiences: await this.repository.listAudiences(userId),
    });
  }

  async createAudience(input: { userId: string; name: string }): Promise<Result<{ audience: MailingAudienceRecord }>> {
    const name = input.name.trim();
    if (!name) {
      return fail(new DomainError("validation_failed", "Audience name is required."));
    }

    return ok({
      audience: await this.repository.createAudience(input.userId, name),
    });
  }

  async listContacts(input: {
    userId: string;
    audienceId: string;
  }): Promise<Result<{ contacts: MailingContactRecord[] }>> {
    const audience = await this.repository.getAudience(input.userId, input.audienceId);
    if (!audience) return fail(new DomainError("not_found", "Audience was not found.", 404));

    return ok({
      contacts: await this.repository.listContacts(input.userId, input.audienceId),
    });
  }

  async importContacts(input: {
    userId: string;
    audienceId: string;
    rawContacts?: string;
    contacts?: MailingContactInput[];
  }): Promise<Result<{ summary: MailingImportSummary }>> {
    if ((input.rawContacts?.length ?? 0) > maxRawContactsLength) {
      return fail(new DomainError("validation_failed", "Contacts payload is too large."));
    }
    if ((input.contacts?.length ?? 0) > maxContactsPerImport) {
      return fail(new DomainError("validation_failed", "Too many contacts in one import."));
    }

    const normalizedContacts = [
      ...parseContacts(input.rawContacts ?? ""),
      ...(input.contacts ?? []).map((contact) => ({
        email: contact.email,
        name: contact.name,
        metadata: contact.metadata,
      })),
    ];

    const dedupedContacts = dedupeContacts(normalizedContacts);
    if (dedupedContacts.length === 0) {
      return fail(new DomainError("validation_failed", "At least one valid email is required."));
    }
    if (dedupedContacts.length > maxContactsPerImport) {
      return fail(new DomainError("validation_failed", "Too many valid contacts in one import."));
    }

    const summary = await this.repository.importContacts(input.userId, input.audienceId, dedupedContacts);
    if (!summary) return fail(new DomainError("not_found", "Audience was not found.", 404));

    return ok({
      summary,
    });
  }

  async listCampaigns(userId: string): Promise<Result<{ campaigns: MailingCampaignRecord[] }>> {
    return ok({
      campaigns: await this.repository.listCampaigns(userId),
    });
  }

  async createCampaign(
    input: CreateMailingCampaignInput
  ): Promise<Result<{ campaign: MailingCampaignRecord }>> {
    const validationError = validateCampaign(input);
    if (validationError) return fail(validationError);

    const html = ensureUnsubscribeBlock(normalizeCampaignHtml(input.html.trim()));
    const text = input.text?.trim() || stripHtml(html);

    const campaign = await this.repository.createCampaign({
      ...input,
      name: input.name.trim(),
      fromEmail: input.fromEmail.trim().toLowerCase(),
      fromName: input.fromName?.trim() ?? "",
      replyTo: input.replyTo?.trim().toLowerCase() ?? "",
      subject: input.subject.trim(),
      html,
      text,
      tag: `nomduchat_${Date.now()}_${randomUUID().slice(0, 8)}`,
    });
    if (!campaign) return fail(new DomainError("not_found", "Audience was not found.", 404));

    return ok({
      campaign,
    });
  }

  async sendCampaign(input: { userId: string; campaignId: string }): Promise<Result<MailingSendSummary>> {
    const campaign = await this.repository.getCampaign(input.userId, input.campaignId);
    if (!campaign) return fail(new DomainError("not_found", "Campaign was not found.", 404));
    if (campaign.status === "sending") {
      return fail(new DomainError("validation_failed", "Campaign is already sending."));
    }
    if (campaign.status === "sent") {
      return fail(new DomainError("validation_failed", "Campaign was already sent. Create a new campaign to send it again."));
    }

    const contacts = await this.repository.listActiveContacts(input.userId, campaign.audienceId);
    if (contacts.length === 0) {
      return fail(new DomainError("validation_failed", "Audience has no active contacts."));
    }

    await this.repository.prepareRecipients(input.userId, campaign.id, contacts);
    await this.repository.markCampaignSending(input.userId, campaign.id, contacts.length);

    try {
      const sent = await this.transport.sendMass({
        fromEmail: campaign.fromEmail,
        fromName: campaign.fromName,
        replyTo: campaign.replyTo,
        subject: campaign.subject,
        html: campaign.html,
        text: campaign.text,
        tag: campaign.tag,
        contacts,
      });

      const updatedCampaign = await this.repository.markCampaignSent(input.userId, campaign.id, sent.accepted, 0);
      if (!updatedCampaign) return fail(new DomainError("not_found", "Campaign was not found.", 404));

      return ok({
        campaign: updatedCampaign,
        attempted: contacts.length,
        accepted: sent.accepted,
        failed: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Campaign failed to send.";
      const failedCampaign = await this.repository.markCampaignFailed(input.userId, campaign.id, message);
      if (error instanceof DomainError) return fail(error);
      return fail(
        new DomainError(
          "provider_unavailable",
          failedCampaign ? message : "Campaign failed and could not be updated.",
          503
        )
      );
    }
  }

  async syncCampaign(input: { userId: string; campaignId: string }): Promise<Result<MailingSyncSummary>> {
    const campaign = await this.repository.getCampaign(input.userId, input.campaignId);
    if (!campaign) return fail(new DomainError("not_found", "Campaign was not found.", 404));

    const messages = await this.transport.fetchMessagesByTag(campaign.tag);
    const summary = await this.repository.applyMessageUpdates(input.userId, campaign.id, messages);
    if (!summary.campaign) return fail(new DomainError("not_found", "Campaign was not found.", 404));

    return ok({
      campaign: summary.campaign,
      updatedRecipients: summary.updatedRecipients,
      opened: summary.opened,
      unsubscribed: summary.unsubscribed,
      bounced: summary.bounced,
    });
  }

  async listRecipients(input: {
    userId: string;
    campaignId: string;
  }): Promise<Result<{ recipients: MailingRecipientRecord[] }>> {
    const campaign = await this.repository.getCampaign(input.userId, input.campaignId);
    if (!campaign) return fail(new DomainError("not_found", "Campaign was not found.", 404));

    return ok({
      recipients: await this.repository.listRecipients(input.userId, input.campaignId),
    });
  }
}

function validateCampaign(input: CreateMailingCampaignInput) {
  if (!input.name.trim()) return new DomainError("validation_failed", "Campaign name is required.");
  if (hasHeaderControlChars(input.name)) return new DomainError("validation_failed", "Campaign name is invalid.");
  if (!isEmail(input.fromEmail)) return new DomainError("validation_failed", "Valid sender email is required.");
  if (input.replyTo && !isEmail(input.replyTo)) {
    return new DomainError("validation_failed", "Valid reply-to email is required.");
  }
  if (hasHeaderControlChars(input.fromEmail) || hasHeaderControlChars(input.replyTo ?? "")) {
    return new DomainError("validation_failed", "Sender email fields are invalid.");
  }
  if (hasHeaderControlChars(input.fromName ?? "")) {
    return new DomainError("validation_failed", "Sender name is invalid.");
  }
  if (!input.subject.trim()) return new DomainError("validation_failed", "Subject is required.");
  if (hasHeaderControlChars(input.subject)) return new DomainError("validation_failed", "Subject is invalid.");
  if (!input.html.trim()) return new DomainError("validation_failed", "HTML body is required.");
  if (/<script[\s>]/i.test(input.html)) {
    return new DomainError("validation_failed", "Script tags are not allowed in email HTML.");
  }
  if (input.html.length > maxCampaignHtmlLength || (input.text?.length ?? 0) > maxCampaignHtmlLength) {
    return new DomainError("validation_failed", "Campaign body is too large.");
  }
  return null;
}

export function parseContacts(rawContacts: string): MailingContactInput[] {
  const contacts: MailingContactInput[] = [];
  const lines = rawContacts.split(/\r?\n/);

  for (const line of lines) {
    const email = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (!email || !isEmail(email)) continue;

    const name = line
      .replace(email, "")
      .replace(/[;,|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    contacts.push({
      email: email.toLowerCase(),
      name: name || undefined,
    });
  }

  return contacts;
}

function dedupeContacts(contacts: MailingContactInput[]) {
  const deduped = new Map<string, MailingContactInput>();
  for (const contact of contacts) {
    const email = contact.email.trim().toLowerCase();
    if (!isEmail(email)) continue;
    deduped.set(email, {
      email,
      name: contact.name?.trim() || deduped.get(email)?.name,
      metadata: contact.metadata ?? deduped.get(email)?.metadata,
    });
  }

  return [...deduped.values()];
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function hasHeaderControlChars(value: string) {
  return /[\r\n\0]/.test(value);
}

function ensureUnsubscribeBlock(html: string) {
  if (/unsubscribe|отпис/i.test(html)) return html;

  return `${html}
<p style="margin-top:24px;color:#777;font-size:12px;line-height:1.5;">Если письмо больше не актуально, ответьте на него словом "отписка".</p>`;
}

function normalizeCampaignHtml(html: string) {
  if (/<html[\s>]/i.test(html) || /<body[\s>]/i.test(html)) {
    return html;
  }

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>nomduchat mailing</title>
  </head>
  <body style="margin:0;background:#f5f5f5;color:#111827;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:18px;padding:28px;border:1px solid #e5e7eb;">
        ${html}
      </div>
    </div>
  </body>
</html>`;
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
