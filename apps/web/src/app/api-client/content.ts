import type { PublicContentBlocksApiResponse } from "./index";
import { request } from "./transport";

export function getPublicContentBlocks(input: { placement: string; locale: string }) {
  const params = new URLSearchParams({
    placement: input.placement,
    locale: input.locale,
  });

  return request<PublicContentBlocksApiResponse>(`/content/blocks?${params.toString()}`);
}
