import { randomUUID } from "node:crypto";
import type { WalletBalance } from "@nerix/shared";
import type { CreditReservation, LedgerEntryRecord, WalletRecord } from "./wallet.types.js";

export interface WalletRepository {
  getWallet(userId: string): Promise<WalletBalance | null>;
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
    const wallet = this.wallets.get(userId);
    return wallet ? publicWallet(wallet) : null;
  }

  async reserve(userId: string, amountCredits: number, referenceId: string) {
    const wallet = this.wallets.get(userId);
    if (!wallet || wallet.availableCredits < amountCredits) {
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
    const wallet = this.wallets.get(userId);
    if (!wallet || wallet.reservedCredits < amountCredits) {
      return null;
    }

    wallet.reservedCredits -= amountCredits;
    wallet.ledger.push(ledgerEntry(wallet, "capture", -amountCredits, "reservation_id", reservationId));
    return publicWallet(wallet);
  }

  async refund(userId: string, reservationId: string, amountCredits: number) {
    const wallet = this.wallets.get(userId);
    if (!wallet || wallet.reservedCredits < amountCredits) {
      return null;
    }

    wallet.reservedCredits -= amountCredits;
    wallet.availableCredits += amountCredits;
    wallet.ledger.push(ledgerEntry(wallet, "refund", amountCredits, "reservation_id", reservationId));
    return publicWallet(wallet);
  }

  async ledger(userId: string) {
    return this.wallets.get(userId)?.ledger ?? [];
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

