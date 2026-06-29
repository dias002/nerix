import type {
  CreateTelegramBotOrderInput,
  TelegramBotOrderApiRecord,
  TelegramBotProductApiResponse,
  TelegramBotTestReplyApiRecord,
  TelegramMiniAppDraftApiRecord,
  TelegramMiniAppDraftInput,
} from "./index";
import { request } from "./transport";

export async function getTelegramBotProduct() {
  return request<TelegramBotProductApiResponse>("/telegram-bots/product");
}

export async function getTelegramBotOrders() {
  return request<{ orders: TelegramBotOrderApiRecord[] }>("/telegram-bots/orders");
}

export async function createTelegramBotOrder(input: CreateTelegramBotOrderInput) {
  return request<{ order: TelegramBotOrderApiRecord }>("/telegram-bots/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function testTelegramBotOrder(input: { orderId: string; message: string }) {
  return request<TelegramBotTestReplyApiRecord>(
    `/telegram-bots/orders/${encodeURIComponent(input.orderId)}/test-message`,
    {
      method: "POST",
      body: JSON.stringify({ message: input.message }),
    }
  );
}

export async function createTelegramMiniAppDraft(input: TelegramMiniAppDraftInput) {
  return request<{ draft: TelegramMiniAppDraftApiRecord }>("/telegram-bots/miniapp/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
