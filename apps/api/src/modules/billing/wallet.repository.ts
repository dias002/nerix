import { randomUUID } from "node:crypto";
import type { LedgerEntryType, WalletBalance } from "@nerix/shared";
import type { DatabaseClient } from "../../database/index.js";
import { ensureLocalUser, LOCAL_USER_PUBLIC_ID, toDatabaseUserId, toPublicUserId } from "../users/local-user.js";
import type { CreditReservation, LedgerEntryRecord, WalletRecord } from "./wallet.types.js";

export interface WalletRepository {
  getWallet(userId: string): Promise<WalletBalance | null>;
  topup(userId: string, amountCredits: number, referenceId: string): Promise<WalletBalance | null>;
  topupOnce(userId: string, amountCredits: number, referenceId: string): Promise<WalletBalance | null>;
  reserve(userId: string, amountCredits: number, referenceId: string): Promise<CreditReservation | null>;
  capture(userId: string, reservationId: string, amountCredits: number): Promise<WalletBalance | null>;
  refund(userId: string, reservationId: string, amountCredits: number): Promise<WalletBalance | null>;
  ledger(userId: string): Promise<LedgerEntryRecord[]>;
}

export class InMemoryWalletRepository implements WalletRepository {
  private readonly wallets = new Map<string, WalletRecord>([
    [
      "local-user",
      {
        userId: "local-user",
        availableCredits: 12500,
        reservedCredits: 0,
        currency: "NERIX",
        ledger: [],
      },
    ],
  ]);

  async getWallet(userId: string) {
    return publicWallet(this.getOrCreateWallet(userId));
  }

  async topup(userId: string, amountCredits: number, referenceId: string) {
    const wallet = this.getOrCreateWallet(userId);

    wallet.availableCredits += amountCredits;
    wallet.ledger.push(ledgerEntry(wallet, "topup", amountCredits, "subscription", referenceId));
    return publicWallet(wallet);
  }

  async topupOnce(userId: string, amountCredits: number, referenceId: string) {
    const wallet = this.getOrCreateWallet(userId);
    const alreadyGranted = wallet.ledger.some(
      (entry) =>
        entry.type === "topup" &&
        entry.referenceType === "subscription" &&
        entry.referenceId === referenceId
    );

    if (alreadyGranted) return publicWallet(wallet);

    return this.topup(userId, amountCredits, referenceId);
  }

  async reserve(userId: string, amountCredits: number, referenceId: string) {
    const wallet = this.getOrCreateWallet(userId);
    if (wallet.availableCredits < amountCredits) {
      return null;
    }

    wallet.availableCredits -= amountCredits;
    wallet.reservedCredits += amountCredits;
    const reservationId = randomUUID();
    wallet.ledger.push(
      ledgerEntry(wallet, "reserve", -amountCredits, "reservation", referenceId),
      ledgerEntry(wallet, "adjustment", 0, "reservation_id", reservationId)
    );

    return {
      reservationId,
      wallet: publicWallet(wallet),
    };
  }

  async capture(userId: string, reservationId: string, amountCredits: number) {
    const wallet = this.getOrCreateWallet(userId);
    if (wallet.reservedCredits < amountCredits) {
      return null;
    }

    wallet.reservedCredits -= amountCredits;
    wallet.ledger.push(ledgerEntry(wallet, "capture", -amountCredits, "reservation_id", reservationId));
    return publicWallet(wallet);
  }

  async refund(userId: string, reservationId: string, amountCredits: number) {
    const wallet = this.getOrCreateWallet(userId);
    if (wallet.reservedCredits < amountCredits) {
      return null;
    }

    wallet.reservedCredits -= amountCredits;
    wallet.availableCredits += amountCredits;
    wallet.ledger.push(ledgerEntry(wallet, "refund", amountCredits, "reservation_id", reservationId));
    return publicWallet(wallet);
  }

  async ledger(userId: string) {
    return this.getOrCreateWallet(userId).ledger;
  }

  private getOrCreateWallet(userId: string) {
    const existingWallet = this.wallets.get(userId);
    if (existingWallet) return existingWallet;

    const wallet: WalletRecord = {
      userId,
      availableCredits: 0,
      reservedCredits: 0,
      currency: "NERIX",
      ledger: [],
    };
    this.wallets.set(userId, wallet);
    return wallet;
  }
}

type WalletRow = {
  id: string;
  user_id: string;
  available_credits: string | number;
  reserved_credits: string | number;
  currency: "NERIX";
} & Record<string, unknown>;

type LedgerRow = {
  id: string;
  wallet_user_id: string;
  type: string;
  amount_credits: string | number;
  balance_after_credits: string | number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: Date | string;
} & Record<string, unknown>;

type ReservationRow = {
  id: string;
  wallet_id: string;
  user_id: string;
  amount_reserved: string | number;
  amount_captured: string | number;
  amount_refunded: string | number;
  available_credits: string | number;
  reserved_credits: string | number;
  currency: "NERIX";
} & Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PostgresWalletRepository implements WalletRepository {
  constructor(private readonly database: DatabaseClient) {}

  async getWallet(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    await this.ensureWallet(this.database, userId, databaseUserId);
    const wallet = await this.findWallet(this.database, databaseUserId);
    return wallet ? publicPostgresWallet(wallet) : null;
  }

  async topup(userId: string, amountCredits: number, referenceId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    return this.transaction(async (client) => {
      await this.ensureWallet(client, userId, databaseUserId);
      const wallet = await this.findWallet(client, databaseUserId, true);
      if (!wallet) return null;

      const nextAvailableCredits = toNumber(wallet.available_credits) + amountCredits;
      const reservedCredits = toNumber(wallet.reserved_credits);
      await updateWallet(client, wallet.id, {
        availableCredits: nextAvailableCredits,
        reservedCredits,
      });

      await insertLedgerEntry(client, {
        walletId: wallet.id,
        type: "topup",
        amountCredits,
        balanceAfterCredits: nextAvailableCredits,
        referenceType: "subscription",
        referenceId,
      });

      return publicWalletFromValues(databaseUserId, nextAvailableCredits, reservedCredits);
    });
  }

  async topupOnce(userId: string, amountCredits: number, referenceId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    return this.transaction(async (client) => {
      await this.ensureWallet(client, userId, databaseUserId);
      const wallet = await this.findWallet(client, databaseUserId, true);
      if (!wallet) return null;

      const existingTopup = await client.query<{ id: string }>(
        `
          select id
          from ledger_entries
          where wallet_id = $1
            and type = 'topup'
            and reference_type = 'subscription'
            and reference_id = $2
          limit 1
        `,
        [wallet.id, referenceId]
      );

      if (existingTopup.rows[0]) {
        return publicPostgresWallet(wallet);
      }

      const nextAvailableCredits = toNumber(wallet.available_credits) + amountCredits;
      const reservedCredits = toNumber(wallet.reserved_credits);
      await updateWallet(client, wallet.id, {
        availableCredits: nextAvailableCredits,
        reservedCredits,
      });

      await insertLedgerEntry(client, {
        walletId: wallet.id,
        type: "topup",
        amountCredits,
        balanceAfterCredits: nextAvailableCredits,
        referenceType: "subscription",
        referenceId,
      });

      return publicWalletFromValues(databaseUserId, nextAvailableCredits, reservedCredits);
    });
  }

  async reserve(userId: string, amountCredits: number, referenceId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return null;

    return this.transaction(async (client) => {
      await this.ensureWallet(client, userId, databaseUserId);
      const wallet = await this.findWallet(client, databaseUserId, true);

      if (!wallet || toNumber(wallet.available_credits) < amountCredits) {
        return null;
      }

      const reservationId = randomUUID();
      const updatedWallet = await updateWallet(client, wallet.id, {
        availableCredits: toNumber(wallet.available_credits) - amountCredits,
        reservedCredits: toNumber(wallet.reserved_credits) + amountCredits,
      });

      await client.query(
        `
          insert into credit_reservations (id, wallet_id, user_id, amount_reserved, reference_id)
          values ($1, $2, $3, $4, $5)
        `,
        [reservationId, wallet.id, databaseUserId, amountCredits, referenceId]
      );

      await insertLedgerEntry(client, {
        walletId: wallet.id,
        type: "reserve",
        amountCredits: -amountCredits,
        balanceAfterCredits: updatedWallet.availableCredits,
        referenceType: "reservation",
        referenceId: reservationId,
        metadata: {
          requestReferenceId: referenceId,
        },
      });

      return {
        reservationId,
        wallet: publicWalletFromValues(databaseUserId, updatedWallet.availableCredits, updatedWallet.reservedCredits),
      };
    });
  }

  async capture(userId: string, reservationId: string, amountCredits: number) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId || !uuidPattern.test(reservationId)) return null;

    return this.transaction(async (client) => {
      const reservation = await this.findReservation(client, databaseUserId, reservationId);
      if (!reservation) return null;

      const remainingCredits = reservationRemainingCredits(reservation);
      if (remainingCredits < amountCredits) return null;

      const reservedCredits = toNumber(reservation.reserved_credits);
      if (reservedCredits < amountCredits) return null;

      const nextCaptured = toNumber(reservation.amount_captured) + amountCredits;
      const nextRemaining = toNumber(reservation.amount_reserved) - nextCaptured - toNumber(reservation.amount_refunded);
      const nextReservedCredits = reservedCredits - amountCredits;

      await updateWallet(client, reservation.wallet_id, {
        availableCredits: toNumber(reservation.available_credits),
        reservedCredits: nextReservedCredits,
      });

      await client.query(
        `
          update credit_reservations
          set amount_captured = $1,
              status = $2,
              updated_at = now()
          where id = $3
        `,
        [nextCaptured, nextRemaining === 0 ? "captured" : "open", reservationId]
      );

      await insertLedgerEntry(client, {
        walletId: reservation.wallet_id,
        type: "capture",
        amountCredits: -amountCredits,
        balanceAfterCredits: toNumber(reservation.available_credits),
        referenceType: "reservation",
        referenceId: reservationId,
      });

      return publicWalletFromValues(databaseUserId, toNumber(reservation.available_credits), nextReservedCredits);
    });
  }

  async refund(userId: string, reservationId: string, amountCredits: number) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId || !uuidPattern.test(reservationId)) return null;

    return this.transaction(async (client) => {
      const reservation = await this.findReservation(client, databaseUserId, reservationId);
      if (!reservation) return null;

      const remainingCredits = reservationRemainingCredits(reservation);
      if (remainingCredits < amountCredits) return null;

      const reservedCredits = toNumber(reservation.reserved_credits);
      if (reservedCredits < amountCredits) return null;

      const nextRefunded = toNumber(reservation.amount_refunded) + amountCredits;
      const nextAvailableCredits = toNumber(reservation.available_credits) + amountCredits;
      const nextReservedCredits = reservedCredits - amountCredits;
      const nextRemaining = toNumber(reservation.amount_reserved) - toNumber(reservation.amount_captured) - nextRefunded;
      const nextStatus =
        nextRemaining === 0 ? (toNumber(reservation.amount_captured) > 0 ? "captured" : "refunded") : "open";

      await updateWallet(client, reservation.wallet_id, {
        availableCredits: nextAvailableCredits,
        reservedCredits: nextReservedCredits,
      });

      await client.query(
        `
          update credit_reservations
          set amount_refunded = $1,
              status = $2,
              updated_at = now()
          where id = $3
        `,
        [nextRefunded, nextStatus, reservationId]
      );

      await insertLedgerEntry(client, {
        walletId: reservation.wallet_id,
        type: "refund",
        amountCredits,
        balanceAfterCredits: nextAvailableCredits,
        referenceType: "reservation",
        referenceId: reservationId,
      });

      return publicWalletFromValues(databaseUserId, nextAvailableCredits, nextReservedCredits);
    });
  }

  async ledger(userId: string) {
    const databaseUserId = toDatabaseUserId(userId);
    if (!databaseUserId) return [];

    await this.ensureWallet(this.database, userId, databaseUserId);

    const result = await this.database.query<LedgerRow>(
      `
        select
          le.id,
          w.user_id as wallet_user_id,
          le.type,
          le.amount_credits,
          le.balance_after_credits,
          le.reference_type,
          le.reference_id,
          le.created_at
        from ledger_entries le
        join wallets w on w.id = le.wallet_id
        where w.user_id = $1 and w.currency = 'NERIX'
        order by le.created_at desc
      `,
      [databaseUserId]
    );

    return result.rows.map(mapLedgerRow);
  }

  private async transaction<T>(callback: (client: DatabaseClient) => Promise<T>) {
    if (!this.database.transaction) {
      throw new Error("Postgres wallet repository requires a transactional database client.");
    }

    return this.database.transaction(callback);
  }

  private async ensureWallet(client: DatabaseClient, publicUserId: string, databaseUserId: string) {
    if (publicUserId === LOCAL_USER_PUBLIC_ID) {
      await ensureLocalUser(client);
    }

    const seedCredits = publicUserId === LOCAL_USER_PUBLIC_ID ? 12500 : 0;
    await client.query(
      `
        insert into wallets (user_id, available_credits, reserved_credits, currency)
        values ($1, $2, 0, 'NERIX')
        on conflict (user_id, currency) do nothing
      `,
      [databaseUserId, seedCredits]
    );
  }

  private async findWallet(client: DatabaseClient, databaseUserId: string, forUpdate = false) {
    const result = await client.query<WalletRow>(
      `
        select id, user_id, available_credits, reserved_credits, currency
        from wallets
        where user_id = $1 and currency = 'NERIX'
        limit 1
        ${forUpdate ? "for update" : ""}
      `,
      [databaseUserId]
    );

    return result.rows[0] ?? null;
  }

  private async findReservation(client: DatabaseClient, databaseUserId: string, reservationId: string) {
    const result = await client.query<ReservationRow>(
      `
        select
          r.id,
          r.wallet_id,
          r.user_id,
          r.amount_reserved,
          r.amount_captured,
          r.amount_refunded,
          w.available_credits,
          w.reserved_credits,
          w.currency
        from credit_reservations r
        join wallets w on w.id = r.wallet_id
        where r.id = $1 and r.user_id = $2 and w.currency = 'NERIX'
        limit 1
        for update of r, w
      `,
      [reservationId, databaseUserId]
    );

    return result.rows[0] ?? null;
  }
}

function publicWallet(wallet: WalletRecord): WalletBalance {
  return {
    userId: wallet.userId,
    availableCredits: wallet.availableCredits,
    reservedCredits: wallet.reservedCredits,
    currency: wallet.currency,
  };
}

function ledgerEntry(
  wallet: WalletRecord,
  type: LedgerEntryRecord["type"],
  amountCredits: number,
  referenceType: string,
  referenceId: string
): LedgerEntryRecord {
  return {
    id: randomUUID(),
    walletUserId: wallet.userId,
    type,
    amountCredits,
    balanceAfterCredits: wallet.availableCredits,
    referenceType,
    referenceId,
    createdAt: new Date().toISOString(),
  };
}

function publicPostgresWallet(wallet: WalletRow): WalletBalance {
  return publicWalletFromValues(wallet.user_id, toNumber(wallet.available_credits), toNumber(wallet.reserved_credits));
}

function publicWalletFromValues(
  databaseUserId: string,
  availableCredits: number,
  reservedCredits: number
): WalletBalance {
  return {
    userId: toPublicUserId(databaseUserId),
    availableCredits,
    reservedCredits,
    currency: "NERIX",
  };
}

function mapLedgerRow(row: LedgerRow): LedgerEntryRecord {
  return {
    id: row.id,
    walletUserId: toPublicUserId(row.wallet_user_id),
    type: row.type as LedgerEntryType,
    amountCredits: toNumber(row.amount_credits),
    balanceAfterCredits: toNumber(row.balance_after_credits),
    referenceType: row.reference_type ?? undefined,
    referenceId: row.reference_id ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function updateWallet(
  client: DatabaseClient,
  walletId: string,
  input: { availableCredits: number; reservedCredits: number }
) {
  await client.query(
    `
      update wallets
      set available_credits = $1,
          reserved_credits = $2,
          updated_at = now()
      where id = $3
    `,
    [input.availableCredits, input.reservedCredits, walletId]
  );

  return input;
}

async function insertLedgerEntry(
  client: DatabaseClient,
  input: {
    walletId: string;
    type: LedgerEntryType;
    amountCredits: number;
    balanceAfterCredits: number;
    referenceType: string;
    referenceId: string;
    metadata?: Record<string, unknown>;
  }
) {
  await client.query(
    `
      insert into ledger_entries (
        wallet_id,
        type,
        amount_credits,
        balance_after_credits,
        reference_type,
        reference_id,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      input.walletId,
      input.type,
      input.amountCredits,
      input.balanceAfterCredits,
      input.referenceType,
      input.referenceId,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}

function reservationRemainingCredits(reservation: ReservationRow) {
  return (
    toNumber(reservation.amount_reserved) -
    toNumber(reservation.amount_captured) -
    toNumber(reservation.amount_refunded)
  );
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}
