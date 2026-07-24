import { request } from "./transport";

export type SupportTicketTopic = "billing" | "access" | "refund" | "technical" | "other";

export type SupportTicketApiRecord = {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  topic: SupportTicketTopic;
  message: string;
  status: "open" | "closed";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function createSupportTicket(input: {
  name?: string;
  email: string;
  topic: SupportTicketTopic;
  message: string;
  pageUrl?: string;
}) {
  return request<{ ticket: SupportTicketApiRecord }>("/support/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
