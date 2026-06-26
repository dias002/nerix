import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type {
  CreateMailingCampaignInput,
  MailingAudienceRecord,
  MailingCampaignRecord,
  MailingCampaignStatus,
  MailingContactInput,
  MailingContactRecord,
  MailingContactStatus,
  MailingImportSummary,
  MailingRecipientRecord,
  MailingRecipientStatus,
  SmtpBzMessage,
} from "./mailing.types.js";

export interface MailingRepository {
  listAudiences(userId: string): Promise<MailingAudienceRecord[]>;
  getAudience(userId: string, audienceId: string): Promise<MailingAudienceRecord | null>;
  createAudience(userId: string, name: string): Promise<MailingAudienceRecord>;
  importContacts(userId: string, audienceId: string, contacts: MailingContactInput[]): Promise<MailingImportSummary | null>;
  listContacts(userId: string, audienceId: string): Promise<MailingContactRecord[]>;
  listActiveContacts(userId: string, audienceId: string): Promise<MailingContactRecord[]>;
  listCampaigns(userId: string): Promise<MailingCampaignRecord[]>;
  getCampaign(userId: string, campaignId: string): Promise<MailingCampaignRecord | null>;
  createCampaign(input: CreateMailingCampaignInput & { tag: string }): Promise<MailingCampaignRecord | null>;
  prepareRecipients(
    userId: string,
    campaignId: string,
    contacts: MailingContactRecord[]
  ): Promise<MailingRecipientRecord[]>;
  markCampaignSending(userId: string, campaignId: string, totalCount: number): Promise<MailingCampaignRecord | null>;
  markCampaignSent(
    userId: string,
    campaignId: string,
    sentCount: number,
    failedCount: number
  ): Promise<MailingCampaignRecord | null>;
  markCampaignFailed(userId: string, campaignId: string, error: string): Promise<MailingCampaignRecord | null>;
  listRecipients(userId: string, campaignId: string): Promise<MailingRecipientRecord[]>;
  applyMessageUpdates(userId: string, campaignId: string, messages: SmtpBzMessage[]): Promise<{
    updatedRecipients: number;
    opened: number;
    unsubscribed: number;
    bounced: number;
    campaign: MailingCampaignRecord | null;
  }>;
}

export class InMemoryMailingRepository implements MailingRepository {
  private readonly audiences = new Map<string, MailingAudienceRecord>();
  private readonly contacts = new Map<string, MailingContactRecord>();
  private readonly campaigns = new Map<string, MailingCampaignRecord>();
  private readonly recipients = new Map<string, MailingRecipientRecord>();

  async listAudiences(userId: string) {
    return [...this.audiences.values()]
      .filter((audience) => audience.userId === userId)
      .map((audience) => this.withAudienceCounts(audience))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAudience(userId: string, audienceId: string) {
    const audience = this.audiences.get(audienceId);
    return audience?.userId === userId ? this.withAudienceCounts(audience) : null;
  }

  async createAudience(userId: string, name: string) {
    const now = new Date().toISOString();
    const audience: MailingAudienceRecord = {
      id: randomUUID(),
      userId,
      name,
      source: "manual",
      contactsCount: 0,
      activeContactsCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.audiences.set(audience.id, audience);
    return audience;
  }

  async importContacts(userId: string, audienceId: string, contacts: MailingContactInput[]) {
    const audience = await this.getAudience(userId, audienceId);
    if (!audience) return null;

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const existingByEmail = new Map(
      [...this.contacts.values()]
        .filter((contact) => contact.audienceId === audienceId)
        .map((contact) => [contact.email, contact])
    );

    for (const input of contacts) {
      const email = normalizeEmail(input.email);
      if (!email) {
        skipped += 1;
        continue;
      }

      const existing = existingByEmail.get(email);
      const now = new Date().toISOString();
      if (existing) {
        const updatedContact: MailingContactRecord = {
          ...existing,
          name: input.name?.trim() || existing.name,
          metadata: input.metadata ?? existing.metadata,
          status: existing.status === "unsubscribed" ? existing.status : "active",
          updatedAt: now,
        };
        this.contacts.set(existing.id, updatedContact);
        updated += 1;
        continue;
      }

      const contact: MailingContactRecord = {
        id: randomUUID(),
        userId,
        audienceId,
        email,
        name: input.name?.trim() || null,
        status: "active",
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      };
      this.contacts.set(contact.id, contact);
      existingByEmail.set(email, contact);
      imported += 1;
    }

    const totalActiveContacts = [...this.contacts.values()].filter(
      (contact) => contact.audienceId === audienceId && contact.status === "active"
    ).length;

    this.audiences.set(audienceId, {
      ...audience,
      updatedAt: new Date().toISOString(),
      contactsCount: [...this.contacts.values()].filter((contact) => contact.audienceId === audienceId).length,
      activeContactsCount: totalActiveContacts,
    });

    return {
      imported,
      updated,
      skipped,
      totalActiveContacts,
    };
  }

  async listContacts(userId: string, audienceId: string) {
    const audience = await this.getAudience(userId, audienceId);
    if (!audience) return [];

    return [...this.contacts.values()]
      .filter((contact) => contact.audienceId === audienceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listActiveContacts(userId: string, audienceId: string) {
    return (await this.listContacts(userId, audienceId)).filter((contact) => contact.status === "active");
  }

  async listCampaigns(userId: string) {
    return [...this.campaigns.values()]
      .filter((campaign) => campaign.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCampaign(userId: string, campaignId: string) {
    const campaign = this.campaigns.get(campaignId);
    return campaign?.userId === userId ? campaign : null;
  }

  async createCampaign(input: CreateMailingCampaignInput & { tag: string }) {
    const audience = await this.getAudience(input.userId, input.audienceId);
    if (!audience) return null;

    const now = new Date().toISOString();
    const campaign: MailingCampaignRecord = {
      id: randomUUID(),
      userId: input.userId,
      audienceId: input.audienceId,
      audienceName: audience.name,
      name: input.name,
      fromEmail: input.fromEmail,
      fromName: input.fromName ?? "",
      replyTo: input.replyTo ?? "",
      subject: input.subject,
      html: input.html,
      text: input.text ?? "",
      tag: input.tag,
      status: "draft",
      totalCount: 0,
      sentCount: 0,
      openedCount: 0,
      unsubscribedCount: 0,
      bouncedCount: 0,
      failedCount: 0,
      lastSyncAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  async prepareRecipients(userId: string, campaignId: string, contacts: MailingContactRecord[]) {
    const campaign = await this.getCampaign(userId, campaignId);
    if (!campaign) return [];

    const now = new Date().toISOString();
    for (const contact of contacts) {
      const existing = [...this.recipients.values()].find(
        (recipient) => recipient.campaignId === campaignId && recipient.email === contact.email
      );
      const recipient: MailingRecipientRecord = {
        id: existing?.id ?? randomUUID(),
        campaignId,
        contactId: contact.id,
        email: contact.email,
        name: contact.name,
        status: "queued",
        smtpMessageId: existing?.smtpMessageId ?? null,
        openedAt: existing?.openedAt ?? null,
        unsubscribedAt: existing?.unsubscribedAt ?? null,
        lastEventAt: existing?.lastEventAt ?? null,
        error: null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      this.recipients.set(recipient.id, recipient);
    }

    return this.listRecipients(userId, campaignId);
  }

  async markCampaignSending(userId: string, campaignId: string, totalCount: number) {
    return this.updateCampaign(userId, campaignId, {
      status: "sending",
      totalCount,
      failedCount: 0,
      updatedAt: new Date().toISOString(),
    });
  }

  async markCampaignSent(userId: string, campaignId: string, sentCount: number, failedCount: number) {
    this.updateRecipientStatuses(campaignId, "queued", "sent");
    return this.updateCampaign(userId, campaignId, {
      status: failedCount > 0 && sentCount === 0 ? "failed" : "sent",
      sentCount,
      failedCount,
      updatedAt: new Date().toISOString(),
    });
  }

  async markCampaignFailed(userId: string, campaignId: string, error: string) {
    for (const recipient of this.recipients.values()) {
      if (recipient.campaignId === campaignId && recipient.status === "queued") {
        this.recipients.set(recipient.id, {
          ...recipient,
          status: "failed",
          error,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return this.updateCampaign(userId, campaignId, {
      status: "failed",
      failedCount: [...this.recipients.values()].filter((recipient) => recipient.campaignId === campaignId).length,
      updatedAt: new Date().toISOString(),
    });
  }

  async listRecipients(userId: string, campaignId: string) {
    const campaign = await this.getCampaign(userId, campaignId);
    if (!campaign) return [];

    return [...this.recipients.values()]
      .filter((recipient) => recipient.campaignId === campaignId)
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  async applyMessageUpdates(userId: string, campaignId: string, messages: SmtpBzMessage[]) {
    const campaign = await this.getCampaign(userId, campaignId);
    if (!campaign) {
      return {
        updatedRecipients: 0,
        opened: 0,
        unsubscribed: 0,
        bounced: 0,
        campaign: null,
      };
    }

    let updatedRecipients = 0;
    const recipientsByEmail = new Map(
      [...this.recipients.values()]
        .filter((recipient) => recipient.campaignId === campaignId)
        .map((recipient) => [recipient.email, recipient])
    );

    for (const message of messages) {
      const email = normalizeEmail(message.to ?? "");
      if (!email) continue;
      const recipient = recipientsByEmail.get(email);
      if (!recipient) continue;

      const nextStatus = statusFromSmtpMessage(message, recipient.status);
      const now = new Date().toISOString();
      this.recipients.set(recipient.id, {
        ...recipient,
        status: nextStatus,
        smtpMessageId: message.id ?? recipient.smtpMessageId,
        openedAt: message.isOpen ? recipient.openedAt ?? now : recipient.openedAt,
        unsubscribedAt: message.isUnsubscribe ? recipient.unsubscribedAt ?? now : recipient.unsubscribedAt,
        lastEventAt: message.createdAt ?? now,
        updatedAt: now,
      });

      if (message.isUnsubscribe && recipient.contactId) {
        const contact = this.contacts.get(recipient.contactId);
        if (contact) {
          this.contacts.set(contact.id, {
            ...contact,
            status: "unsubscribed",
            updatedAt: now,
          });
        }
      }
      updatedRecipients += 1;
    }

    return {
      updatedRecipients,
      ...this.campaignStats(userId, campaignId, true),
    };
  }

  private withAudienceCounts(audience: MailingAudienceRecord) {
    const contacts = [...this.contacts.values()].filter((contact) => contact.audienceId === audience.id);
    return {
      ...audience,
      contactsCount: contacts.length,
      activeContactsCount: contacts.filter((contact) => contact.status === "active").length,
    };
  }

  private updateCampaign(userId: string, campaignId: string, patch: Partial<MailingCampaignRecord>) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.userId !== userId) return null;

    const next = {
      ...campaign,
      ...patch,
    };
    this.campaigns.set(campaignId, next);
    return next;
  }

  private updateRecipientStatuses(campaignId: string, fromStatus: MailingRecipientStatus, toStatus: MailingRecipientStatus) {
    for (const recipient of this.recipients.values()) {
      if (recipient.campaignId === campaignId && recipient.status === fromStatus) {
        this.recipients.set(recipient.id, {
          ...recipient,
          status: toStatus,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  private campaignStats(userId: string, campaignId: string, synced: boolean) {
    const campaign = this.campaigns.get(campaignId);
    const recipients = [...this.recipients.values()].filter((recipient) => recipient.campaignId === campaignId);
    const opened = recipients.filter((recipient) => recipient.status === "opened").length;
    const unsubscribed = recipients.filter((recipient) => recipient.status === "unsubscribed").length;
    const bounced = recipients.filter((recipient) => recipient.status === "bounced").length;
    const failed = recipients.filter((recipient) => recipient.status === "failed").length;
    const sent = recipients.filter((recipient) => ["sent", "opened", "unsubscribed"].includes(recipient.status)).length;
    const nextCampaign = campaign
      ? this.updateCampaign(userId, campaignId, {
          sentCount: sent,
          openedCount: opened,
          unsubscribedCount: unsubscribed,
          bouncedCount: bounced,
          failedCount: failed,
          lastSyncAt: synced ? new Date().toISOString() : campaign.lastSyncAt,
          updatedAt: new Date().toISOString(),
        })
      : null;

    return {
      campaign: nextCampaign,
      opened,
      unsubscribed,
      bounced,
    };
  }
}

type AudienceRow = {
  id: string;
  user_id: string;
  name: string;
  source: string;
  contacts_count: string | number;
  active_contacts_count: string | number;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type ContactRow = {
  id: string;
  user_id: string;
  audience_id: string;
  email: string;
  name: string | null;
  status: MailingContactStatus;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type CampaignRow = {
  id: string;
  user_id: string;
  audience_id: string;
  audience_name: string;
  name: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  subject: string;
  html: string;
  text: string;
  tag: string;
  status: MailingCampaignStatus;
  total_count: string | number;
  sent_count: string | number;
  opened_count: string | number;
  unsubscribed_count: string | number;
  bounced_count: string | number;
  failed_count: string | number;
  last_sync_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

type RecipientRow = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  name: string | null;
  status: MailingRecipientStatus;
  smtp_message_id: string | null;
  opened_at: Date | string | null;
  unsubscribed_at: Date | string | null;
  last_event_at: Date | string | null;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
} & Record<string, unknown>;

export class PostgresMailingRepository implements MailingRepository {
  constructor(private readonly database: DatabaseClient) {}

  async listAudiences(userId: string) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<AudienceRow>(audiencesSql("where a.user_id = $1", "order by a.created_at desc"), [
      databaseUserId,
    ]);
    return result.rows.map(mapAudienceRow);
  }

  async getAudience(userId: string, audienceId: string) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<AudienceRow>(
      audiencesSql("where a.user_id = $1 and a.id = $2 limit 1"),
      [databaseUserId, audienceId]
    );
    return result.rows[0] ? mapAudienceRow(result.rows[0]) : null;
  }

  async createAudience(userId: string, name: string) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) throw new Error("Invalid user id.");

    const result = await this.database.query<AudienceRow>(
      `
        insert into mailing_audiences (user_id, name)
        values ($1, $2)
        on conflict (user_id, name) do update set updated_at = now()
        returning
          id,
          user_id,
          name,
          source,
          0 as contacts_count,
          0 as active_contacts_count,
          created_at,
          updated_at
      `,
      [databaseUserId, name]
    );

    return mapAudienceRow(result.rows[0]);
  }

  async importContacts(userId: string, audienceId: string, contacts: MailingContactInput[]) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId || !(await this.getAudience(userId, audienceId))) return null;

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const contact of contacts) {
      const email = normalizeEmail(contact.email);
      if (!email) {
        skipped += 1;
        continue;
      }

      const existing = await this.database.query<{ id: string }>(
        "select id from mailing_contacts where audience_id = $1 and email = $2 limit 1",
        [audienceId, email]
      );
      if (existing.rows[0]) updated += 1;
      else imported += 1;

      await this.database.query(
        `
          insert into mailing_contacts (user_id, audience_id, email, name, metadata, status)
          values ($1, $2, $3, $4, $5, 'active')
          on conflict (audience_id, email) do update set
            name = coalesce(excluded.name, mailing_contacts.name),
            metadata = excluded.metadata,
            status = case
              when mailing_contacts.status = 'unsubscribed' then mailing_contacts.status
              else excluded.status
            end,
            updated_at = now()
        `,
        [databaseUserId, audienceId, email, contact.name?.trim() || null, contact.metadata ?? {}]
      );
    }

    const audience = await this.getAudience(userId, audienceId);
    return {
      imported,
      updated,
      skipped,
      totalActiveContacts: audience?.activeContactsCount ?? 0,
    };
  }

  async listContacts(userId: string, audienceId: string) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<ContactRow>(
      `
        select id, user_id, audience_id, email, name, status, metadata, created_at, updated_at
        from mailing_contacts
        where user_id = $1 and audience_id = $2
        order by created_at desc
      `,
      [databaseUserId, audienceId]
    );
    return result.rows.map(mapContactRow);
  }

  async listActiveContacts(userId: string, audienceId: string) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<ContactRow>(
      `
        select id, user_id, audience_id, email, name, status, metadata, created_at, updated_at
        from mailing_contacts
        where user_id = $1 and audience_id = $2 and status = 'active'
        order by email asc
      `,
      [databaseUserId, audienceId]
    );
    return result.rows.map(mapContactRow);
  }

  async listCampaigns(userId: string) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) return [];

    const result = await this.database.query<CampaignRow>(campaignsSql("where c.user_id = $1 order by c.created_at desc"), [
      databaseUserId,
    ]);
    return result.rows.map(mapCampaignRow);
  }

  async getCampaign(userId: string, campaignId: string) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<CampaignRow>(
      campaignsSql("where c.user_id = $1 and c.id = $2 limit 1"),
      [databaseUserId, campaignId]
    );
    return result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  }

  async createCampaign(input: CreateMailingCampaignInput & { tag: string }) {
    const databaseUserId = await this.resolveDatabaseUserId(input.userId);
    const audience = await this.getAudience(input.userId, input.audienceId);
    if (!databaseUserId || !audience) return null;

    const result = await this.database.query<CampaignRow>(
      `
        insert into mailing_campaigns (
          user_id,
          audience_id,
          name,
          from_email,
          from_name,
          reply_to,
          subject,
          html,
          text,
          tag
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning
          id,
          user_id,
          audience_id,
          $11::text as audience_name,
          name,
          from_email,
          from_name,
          reply_to,
          subject,
          html,
          text,
          tag,
          status,
          total_count,
          sent_count,
          opened_count,
          unsubscribed_count,
          bounced_count,
          failed_count,
          last_sync_at,
          created_at,
          updated_at
      `,
      [
        databaseUserId,
        input.audienceId,
        input.name,
        input.fromEmail,
        input.fromName ?? "",
        input.replyTo ?? "",
        input.subject,
        input.html,
        input.text ?? "",
        input.tag,
        audience.name,
      ]
    );

    return mapCampaignRow(result.rows[0]);
  }

  async prepareRecipients(userId: string, campaignId: string, contacts: MailingContactRecord[]) {
    const campaign = await this.getCampaign(userId, campaignId);
    if (!campaign) return [];

    for (const contact of contacts) {
      await this.database.query(
        `
          insert into mailing_recipients (campaign_id, contact_id, email, name, status)
          values ($1, $2, $3, $4, 'queued')
          on conflict (campaign_id, email) do update set
            contact_id = excluded.contact_id,
            name = excluded.name,
            status = 'queued',
            error = null,
            updated_at = now()
        `,
        [campaignId, contact.id, contact.email, contact.name]
      );
    }

    return this.listRecipients(userId, campaignId);
  }

  async markCampaignSending(userId: string, campaignId: string, totalCount: number) {
    return this.updateCampaign(userId, campaignId, "status = 'sending', total_count = $3, failed_count = 0", [totalCount]);
  }

  async markCampaignSent(userId: string, campaignId: string, sentCount: number, failedCount: number) {
    await this.database.query(
      `
        update mailing_recipients
        set status = 'sent', updated_at = now()
        where campaign_id = $1 and status = 'queued'
      `,
      [campaignId]
    );

    return this.updateCampaign(
      userId,
      campaignId,
      "status = $3, sent_count = $4, failed_count = $5",
      [failedCount > 0 && sentCount === 0 ? "failed" : "sent", sentCount, failedCount]
    );
  }

  async markCampaignFailed(userId: string, campaignId: string, error: string) {
    await this.database.query(
      `
        update mailing_recipients
        set status = 'failed', error = $2, updated_at = now()
        where campaign_id = $1 and status = 'queued'
      `,
      [campaignId, error]
    );

    const recipients = await this.listRecipients(userId, campaignId);
    return this.updateCampaign(userId, campaignId, "status = 'failed', failed_count = $3", [recipients.length]);
  }

  async listRecipients(userId: string, campaignId: string) {
    const campaign = await this.getCampaign(userId, campaignId);
    if (!campaign) return [];

    const result = await this.database.query<RecipientRow>(
      `
        select
          id,
          campaign_id,
          contact_id,
          email,
          name,
          status,
          smtp_message_id,
          opened_at,
          unsubscribed_at,
          last_event_at,
          error,
          created_at,
          updated_at
        from mailing_recipients
        where campaign_id = $1
        order by email asc
      `,
      [campaignId]
    );
    return result.rows.map(mapRecipientRow);
  }

  async applyMessageUpdates(userId: string, campaignId: string, messages: SmtpBzMessage[]) {
    const campaign = await this.getCampaign(userId, campaignId);
    if (!campaign) {
      return {
        updatedRecipients: 0,
        opened: 0,
        unsubscribed: 0,
        bounced: 0,
        campaign: null,
      };
    }

    let updatedRecipients = 0;
    for (const message of messages) {
      const email = normalizeEmail(message.to ?? "");
      if (!email) continue;

      const existing = await this.database.query<RecipientRow>(
        `
          select
            id,
            campaign_id,
            contact_id,
            email,
            name,
            status,
            smtp_message_id,
            opened_at,
            unsubscribed_at,
            last_event_at,
            error,
            created_at,
            updated_at
          from mailing_recipients
          where campaign_id = $1 and email = $2
          limit 1
        `,
        [campaignId, email]
      );
      const recipient = existing.rows[0] ? mapRecipientRow(existing.rows[0]) : null;
      if (!recipient) continue;

      const nextStatus = statusFromSmtpMessage(message, recipient.status);
      await this.database.query(
        `
          update mailing_recipients
          set
            status = $3,
            smtp_message_id = coalesce($4, smtp_message_id),
            opened_at = case when $5 then coalesce(opened_at, now()) else opened_at end,
            unsubscribed_at = case when $6 then coalesce(unsubscribed_at, now()) else unsubscribed_at end,
            last_event_at = coalesce($7::timestamptz, now()),
            updated_at = now()
          where campaign_id = $1 and email = $2
        `,
        [campaignId, email, nextStatus, message.id ?? null, message.isOpen, message.isUnsubscribe, message.createdAt ?? null]
      );

      if (message.isUnsubscribe && recipient.contactId) {
        await this.database.query(
          `
            update mailing_contacts
            set status = 'unsubscribed', updated_at = now()
            where id = $1
          `,
          [recipient.contactId]
        );
      }

      updatedRecipients += 1;
    }

    const campaignWithStats = await this.recalculateCampaign(userId, campaignId, true);
    return {
      updatedRecipients,
      opened: campaignWithStats?.openedCount ?? 0,
      unsubscribed: campaignWithStats?.unsubscribedCount ?? 0,
      bounced: campaignWithStats?.bouncedCount ?? 0,
      campaign: campaignWithStats,
    };
  }

  private async resolveDatabaseUserId(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;
    if (userId === "local-user") await ensureLocalUser(this.database);
    return databaseUserId;
  }

  private async updateCampaign(userId: string, campaignId: string, setSql: string, params: unknown[]) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<CampaignRow>(
      `
        update mailing_campaigns c
        set ${setSql}, updated_at = now()
        from mailing_audiences a
        where c.audience_id = a.id and c.user_id = $1 and c.id = $2
        returning
          c.id,
          c.user_id,
          c.audience_id,
          a.name as audience_name,
          c.name,
          c.from_email,
          c.from_name,
          c.reply_to,
          c.subject,
          c.html,
          c.text,
          c.tag,
          c.status,
          c.total_count,
          c.sent_count,
          c.opened_count,
          c.unsubscribed_count,
          c.bounced_count,
          c.failed_count,
          c.last_sync_at,
          c.created_at,
          c.updated_at
      `,
      [databaseUserId, campaignId, ...params]
    );
    return result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  }

  private async recalculateCampaign(userId: string, campaignId: string, synced: boolean) {
    const databaseUserId = await this.resolveDatabaseUserId(userId);
    if (!databaseUserId) return null;

    const result = await this.database.query<CampaignRow>(
      `
        update mailing_campaigns c
        set
          sent_count = stats.sent_count,
          opened_count = stats.opened_count,
          unsubscribed_count = stats.unsubscribed_count,
          bounced_count = stats.bounced_count,
          failed_count = stats.failed_count,
          last_sync_at = case when $3 then now() else c.last_sync_at end,
          updated_at = now()
        from mailing_audiences a,
        lateral (
          select
            count(*) filter (where r.status in ('sent', 'opened', 'unsubscribed'))::int as sent_count,
            count(*) filter (where r.status = 'opened')::int as opened_count,
            count(*) filter (where r.status = 'unsubscribed')::int as unsubscribed_count,
            count(*) filter (where r.status = 'bounced')::int as bounced_count,
            count(*) filter (where r.status = 'failed')::int as failed_count
          from mailing_recipients r
          where r.campaign_id = c.id
        ) stats
        where c.audience_id = a.id and c.user_id = $1 and c.id = $2
        returning
          c.id,
          c.user_id,
          c.audience_id,
          a.name as audience_name,
          c.name,
          c.from_email,
          c.from_name,
          c.reply_to,
          c.subject,
          c.html,
          c.text,
          c.tag,
          c.status,
          c.total_count,
          c.sent_count,
          c.opened_count,
          c.unsubscribed_count,
          c.bounced_count,
          c.failed_count,
          c.last_sync_at,
          c.created_at,
          c.updated_at
      `,
      [databaseUserId, campaignId, synced]
    );

    return result.rows[0] ? mapCampaignRow(result.rows[0]) : null;
  }
}

function audiencesSql(whereSql: string, orderSql = "") {
  return `
    select
      a.id,
      a.user_id,
      a.name,
      a.source,
      count(c.id)::int as contacts_count,
      count(c.id) filter (where c.status = 'active')::int as active_contacts_count,
      a.created_at,
      a.updated_at
    from mailing_audiences a
    left join mailing_contacts c on c.audience_id = a.id
    ${whereSql}
    group by a.id
    ${orderSql}
  `;
}

function campaignsSql(whereSql: string) {
  return `
    select
      c.id,
      c.user_id,
      c.audience_id,
      a.name as audience_name,
      c.name,
      c.from_email,
      c.from_name,
      c.reply_to,
      c.subject,
      c.html,
      c.text,
      c.tag,
      c.status,
      c.total_count,
      c.sent_count,
      c.opened_count,
      c.unsubscribed_count,
      c.bounced_count,
      c.failed_count,
      c.last_sync_at,
      c.created_at,
      c.updated_at
    from mailing_campaigns c
    join mailing_audiences a on a.id = c.audience_id
    ${whereSql}
  `;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function statusFromSmtpMessage(message: SmtpBzMessage, fallback: MailingRecipientStatus): MailingRecipientStatus {
  if (message.isUnsubscribe) return "unsubscribed";
  if (message.isOpen) return "opened";

  const status = message.status?.toLowerCase() ?? "";
  if (["return", "bounce", "bounced"].includes(status)) return "bounced";
  if (["cancel", "failed", "error"].includes(status)) return "failed";
  if (["sent", "resent", "delivered"].includes(status)) return fallback === "opened" ? fallback : "sent";

  return fallback;
}

function mapAudienceRow(row: AudienceRow): MailingAudienceRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    name: row.name,
    source: row.source,
    contactsCount: Number(row.contacts_count),
    activeContactsCount: Number(row.active_contacts_count),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapContactRow(row: ContactRow): MailingContactRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    audienceId: row.audience_id,
    email: row.email,
    name: row.name,
    status: row.status,
    metadata: row.metadata ?? {},
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapCampaignRow(row: CampaignRow): MailingCampaignRecord {
  return {
    id: row.id,
    userId: toPublicUserId(row.user_id),
    audienceId: row.audience_id,
    audienceName: row.audience_name,
    name: row.name,
    fromEmail: row.from_email,
    fromName: row.from_name,
    replyTo: row.reply_to,
    subject: row.subject,
    html: row.html,
    text: row.text,
    tag: row.tag,
    status: row.status,
    totalCount: Number(row.total_count),
    sentCount: Number(row.sent_count),
    openedCount: Number(row.opened_count),
    unsubscribedCount: Number(row.unsubscribed_count),
    bouncedCount: Number(row.bounced_count),
    failedCount: Number(row.failed_count),
    lastSyncAt: row.last_sync_at ? toIso(row.last_sync_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapRecipientRow(row: RecipientRow): MailingRecipientRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    contactId: row.contact_id,
    email: row.email,
    name: row.name,
    status: row.status,
    smtpMessageId: row.smtp_message_id,
    openedAt: row.opened_at ? toIso(row.opened_at) : null,
    unsubscribedAt: row.unsubscribed_at ? toIso(row.unsubscribed_at) : null,
    lastEventAt: row.last_event_at ? toIso(row.last_event_at) : null,
    error: row.error,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
