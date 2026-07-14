import type { DatabaseClient } from "../../database/index.js";
import { DomainError, fail, ok, type Result } from "../../domain/result.js";
import type { TransactionalMailer } from "./transactional-mailer.js";

type UnpaidUserRow = {
  id: string;
  display_name: string | null;
  email: string;
  reminder_day: string | number;
};

type EndingSubscriptionRow = {
  subscription_id: string;
  user_id: string;
  display_name: string | null;
  email: string;
  plan_slug: string;
  current_period_end: Date | string;
};

type EventRow = {
  id: string;
};

export type LifecycleNotificationRun = {
  unpaidRemindersSent: number;
  tariffEndingRemindersSent: number;
  skipped: number;
  failed: number;
};

export class LifecycleNotificationsService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly mailer: TransactionalMailer
  ) {}

  async run(now = new Date()): Promise<Result<LifecycleNotificationRun>> {
    const result: LifecycleNotificationRun = {
      unpaidRemindersSent: 0,
      tariffEndingRemindersSent: 0,
      skipped: 0,
      failed: 0,
    };

    try {
      const [unpaidUsers, endingSubscriptions] = await Promise.all([
        this.listUnpaidUsers(now),
        this.listEndingSubscriptions(now),
      ]);

      for (const user of unpaidUsers) {
        const sent = await this.sendUnpaidReminder(user);
        if (sent === "sent") result.unpaidRemindersSent += 1;
        if (sent === "skipped") result.skipped += 1;
        if (sent === "failed") result.failed += 1;
      }

      for (const subscription of endingSubscriptions) {
        const sent = await this.sendTariffEndingReminder(subscription);
        if (sent === "sent") result.tariffEndingRemindersSent += 1;
        if (sent === "skipped") result.skipped += 1;
        if (sent === "failed") result.failed += 1;
      }

      return ok(result);
    } catch (error) {
      return fail(new DomainError("internal_error", errorMessage(error), 500));
    }
  }

  private async listUnpaidUsers(now: Date) {
    const result = await this.database.query<UnpaidUserRow>(
      `
        select
          u.id,
          u.display_name,
          u.email,
          case
            when u.created_at <= $1::timestamptz - interval '3 days' then 3
            else 1
          end as reminder_day
        from users u
        where u.email is not null
          and u.email <> ''
          and u.created_at <= $1::timestamptz - interval '1 day'
          and u.created_at >= $1::timestamptz - interval '7 days'
          and not exists (
            select 1
            from subscriptions s
            where s.user_id = u.id and s.status = 'active'
          )
          and not exists (
            select 1
            from subscription_checkouts sc
            where sc.user_id = u.id and sc.status = 'completed'
          )
        order by u.created_at asc
        limit 200
      `,
      [now.toISOString()]
    );

    return result.rows;
  }

  private async listEndingSubscriptions(now: Date) {
    const result = await this.database.query<EndingSubscriptionRow>(
      `
        select
          s.id as subscription_id,
          s.user_id,
          u.display_name,
          u.email,
          s.plan_slug,
          s.current_period_end
        from subscriptions s
        join users u on u.id = s.user_id
        where s.status = 'active'
          and s.cancel_at_period_end = false
          and u.email is not null
          and u.email <> ''
          and s.current_period_end > $1::timestamptz
          and s.current_period_end <= $1::timestamptz + interval '3 days'
        order by s.current_period_end asc
        limit 200
      `,
      [now.toISOString()]
    );

    return result.rows;
  }

  private async sendUnpaidReminder(user: UnpaidUserRow) {
    const day = normalizeReminderDay(user.reminder_day);
    const eventKey = `subscription_unpaid:${user.id}:day_${day}`;
    const eventId = await this.claimEvent({
      eventKey,
      userId: user.id,
      type: "subscription_unpaid",
      metadata: { day },
    });

    if (!eventId) return "skipped" as const;

    try {
      await this.mailer.sendUnpaidSubscriptionReminder({
        email: user.email,
        name: user.display_name,
        day,
      });
      await this.markEventSent(eventId);
      return "sent" as const;
    } catch (error) {
      await this.markEventFailed(eventId, errorMessage(error));
      return "failed" as const;
    }
  }

  private async sendTariffEndingReminder(subscription: EndingSubscriptionRow) {
    const periodEnd = new Date(subscription.current_period_end);
    const eventKey = `subscription_period_ending:${subscription.subscription_id}:${periodEnd.toISOString().slice(0, 10)}`;
    const eventId = await this.claimEvent({
      eventKey,
      userId: subscription.user_id,
      type: "subscription_period_ending",
      metadata: {
        subscriptionId: subscription.subscription_id,
        planId: subscription.plan_slug,
        periodEnd: periodEnd.toISOString(),
      },
    });

    if (!eventId) return "skipped" as const;

    try {
      await this.mailer.sendTariffEndingReminder({
        email: subscription.email,
        name: subscription.display_name,
        planName: planName(subscription.plan_slug),
        periodEnd: formatDate(periodEnd),
      });
      await this.markEventSent(eventId);
      return "sent" as const;
    } catch (error) {
      await this.markEventFailed(eventId, errorMessage(error));
      return "failed" as const;
    }
  }

  private async claimEvent(input: {
    eventKey: string;
    userId: string;
    type: string;
    metadata: Record<string, unknown>;
  }) {
    const result = await this.database.query<EventRow>(
      `
        insert into notification_events (event_key, user_id, type, status, metadata)
        values ($1, $2, $3, 'pending', $4::jsonb)
        on conflict (event_key) do update
          set status = 'pending',
              error_message = null,
              updated_at = now()
        where notification_events.status = 'failed'
        returning id
      `,
      [input.eventKey, input.userId, input.type, JSON.stringify(input.metadata)]
    );

    return result.rows[0]?.id ?? null;
  }

  private async markEventSent(eventId: string) {
    await this.database.query(
      `
        update notification_events
        set status = 'sent',
            sent_at = now(),
            updated_at = now(),
            error_message = null
        where id = $1
      `,
      [eventId]
    );
  }

  private async markEventFailed(eventId: string, message: string) {
    await this.database.query(
      `
        update notification_events
        set status = 'failed',
            error_message = $2,
            updated_at = now()
        where id = $1
      `,
      [eventId, message.slice(0, 500)]
    );
  }
}

function normalizeReminderDay(value: string | number): 1 | 3 {
  return Number(value) >= 3 ? 3 : 1;
}

function planName(planId: string) {
  if (planId === "base") return "Easy Start";
  if (planId === "ultra") return "Active Work";
  if (planId === "pro") return "Team Mode";
  if (planId === "business") return "Business Cabinet";
  return planId;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Lifecycle notification run failed.";
}
