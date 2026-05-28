import type { LedgerEntryType, WalletBalance } from "@nerix/shared";

export type LedgerEntryRecord = {
  id: string;
  walletUserId: string;
  type: LedgerEntryType;
  amountCredits: number;
  balanceAfterCredits: number;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
};

export type WalletRecord = WalletBalance & {
  ledger: LedgerEntryRecord[];
};

export type CreditReservation = {
  reservationId: string;
  wallet: WalletBalance;
};

