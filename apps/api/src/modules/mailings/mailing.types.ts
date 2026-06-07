export type MailingAudienceRecord = {
  id: string;
  userId: string;
  name: string;
  source: string;
  contactsCount: number;
  activeContactsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MailingContactStatus = "active" | "unsubscribed" | "bounced" | "invalid";

export type MailingContactRecord = {
  id: string;
  userId: string;
  audienceId: string;
  email: string;
  name: string | null;
  status: MailingContactStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MailingCampaignStatus = "draft" | "sending" | "sent" | "failed";

export type MailingCampaignRecord = {
  id: string;
  userId: string;
  audienceId: string;
  audienceName: string;
  name: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  tag: string;
  status: MailingCampaignStatus;
  totalCount: number;
  sentCount: number;
  openedCount: number;
  unsubscribedCount: number;
  bouncedCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailingRecipientStatus = "queued" | "sent" | "opened" | "bounced" | "unsubscribed" | "failed";

export type MailingRecipientRecord = {
  id: string;
  campaignId: string;
  contactId: string | null;
  email: string;
  name: string | null;
  status: MailingRecipientStatus;
  smtpMessageId: string | null;
  openedAt: string | null;
  unsubscribedAt: string | null;
  lastEventAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailingContactInput = {
  email: string;
  name?: string;
  metadata?: Record<string, unknown>;
};

export type MailingImportSummary = {
  imported: number;
  updated: number;
  skipped: number;
  totalActiveContacts: number;
};

export type CreateMailingCampaignInput = {
  userId: string;
  audienceId: string;
  name: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
};

export type MailingSendSummary = {
  campaign: MailingCampaignRecord;
  attempted: number;
  accepted: number;
  failed: number;
};

export type MailingSyncSummary = {
  campaign: MailingCampaignRecord;
  updatedRecipients: number;
  opened: number;
  unsubscribed: number;
  bounced: number;
};

export type SmtpBzMessage = {
  id?: string;
  to?: string;
  status?: string;
  isOpen?: boolean;
  isUnsubscribe?: boolean;
  createdAt?: string;
  raw: unknown;
};
