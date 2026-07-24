export type SupportTicketStatus = "open" | "closed";
export type SupportTicketTopic = "billing" | "access" | "refund" | "technical" | "other";

export type SupportTicketRecord = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  topic: SupportTicketTopic;
  message: string;
  status: SupportTicketStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateSupportTicketInput = {
  userId?: string | null;
  name?: string | null;
  email: string;
  topic: SupportTicketTopic;
  message: string;
  pageUrl?: string | null;
};
