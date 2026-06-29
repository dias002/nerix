import type {
  MailingAudienceApiRecord,
  MailingCampaignApiRecord,
  MailingContactApiRecord,
  MailingImportSummary,
  MailingRecipientApiRecord,
} from "./index";
import { request } from "./transport";

export async function getMailingAudiences() {
  return request<{ audiences: MailingAudienceApiRecord[] }>("/mailings/audiences");
}

export async function createMailingAudience(input: { name: string }) {
  return request<{ audience: MailingAudienceApiRecord }>("/mailings/audiences", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function importMailingContacts(input: { audienceId: string; rawContacts: string }) {
  return request<{ summary: MailingImportSummary }>(`/mailings/audiences/${input.audienceId}/import`, {
    method: "POST",
    body: JSON.stringify({
      rawContacts: input.rawContacts,
    }),
  });
}

export async function getMailingContacts(audienceId: string) {
  return request<{ contacts: MailingContactApiRecord[] }>(`/mailings/audiences/${audienceId}/contacts`);
}

export async function getMailingCampaigns() {
  return request<{ campaigns: MailingCampaignApiRecord[] }>("/mailings/campaigns");
}

export async function createMailingCampaign(input: {
  audienceId: string;
  name: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}) {
  return request<{ campaign: MailingCampaignApiRecord }>("/mailings/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function sendMailingCampaign(campaignId: string) {
  return request<{
    campaign: MailingCampaignApiRecord;
    attempted: number;
    accepted: number;
    failed: number;
  }>(`/mailings/campaigns/${campaignId}/send`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function syncMailingCampaign(campaignId: string) {
  return request<{
    campaign: MailingCampaignApiRecord;
    updatedRecipients: number;
    opened: number;
    unsubscribed: number;
    bounced: number;
  }>(`/mailings/campaigns/${campaignId}/sync`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getMailingRecipients(campaignId: string) {
  return request<{ recipients: MailingRecipientApiRecord[] }>(`/mailings/campaigns/${campaignId}/recipients`);
}
