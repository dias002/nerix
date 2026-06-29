import type {
  BusinessConversationRating,
  BusinessCustomerConversationApiRecord,
  BusinessCustomerMessageRole,
  BusinessIdeaStatus,
  BusinessJobApiRecord,
  BusinessJobsApiResponse,
  BusinessMemberStatus,
  BusinessOpsOverviewApiResponse,
  BusinessRoleKey,
  BusinessTeamMessageApiRecord,
  BusinessWebsiteApiRecord,
  BusinessWorkspaceApiResponse,
  CreateBusinessCustomerConversationInput,
  CreateBusinessWebsiteDraftInput,
} from "./index";
import { request } from "./transport";

export async function getBusinessWorkspace() {
  return request<BusinessWorkspaceApiResponse>("/business/workspace");
}

export async function addBusinessMember(input: {
  name: string;
  roleKey: BusinessRoleKey;
  invitedEmail?: string;
  roleTitle?: string;
  access?: string;
  status?: BusinessMemberStatus;
}) {
  return request<BusinessWorkspaceApiResponse>("/business/members", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addBusinessDealNote(dealId: string, text: string) {
  return request<BusinessWorkspaceApiResponse>(`/business/deals/${encodeURIComponent(dealId)}/notes`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function updateBusinessIdeaStatus(ideaId: string, status: BusinessIdeaStatus) {
  return request<BusinessWorkspaceApiResponse>(`/business/ideas/${encodeURIComponent(ideaId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getBusinessOpsOverview() {
  return request<BusinessOpsOverviewApiResponse>("/business/ops");
}

export async function getBusinessJobs() {
  return request<BusinessJobsApiResponse>("/business/jobs");
}

export async function getBusinessJob(jobId: string) {
  return request<{ workspaceId: string; job: BusinessJobApiRecord }>(`/business/jobs/${encodeURIComponent(jobId)}`);
}

export async function cancelBusinessJob(jobId: string) {
  return request<{ workspaceId: string; job: BusinessJobApiRecord }>(
    `/business/jobs/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function createBusinessCustomerConversation(input: CreateBusinessCustomerConversationInput) {
  return request<{
    conversation: BusinessCustomerConversationApiRecord;
    overview: BusinessOpsOverviewApiResponse;
  }>("/business/ops/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addBusinessCustomerMessage(
  conversationId: string,
  input: {
    role: BusinessCustomerMessageRole;
    authorName?: string;
    content: string;
  }
) {
  return request<{
    conversation: BusinessCustomerConversationApiRecord;
    overview: BusinessOpsOverviewApiResponse;
  }>(`/business/ops/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function rateBusinessCustomerConversation(conversationId: string, rating: BusinessConversationRating) {
  return request<{
    conversation: BusinessCustomerConversationApiRecord;
    overview: BusinessOpsOverviewApiResponse;
  }>(`/business/ops/conversations/${encodeURIComponent(conversationId)}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export async function addBusinessTeamMessage(input: {
  memberId?: string | null;
  authorName: string;
  roleTitle?: string;
  text: string;
}) {
  return request<{
    message: BusinessTeamMessageApiRecord;
    overview: BusinessOpsOverviewApiResponse;
  }>("/business/ops/team/messages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getBusinessWebsites() {
  return request<{ websites: BusinessWebsiteApiRecord[] }>("/business/websites");
}

export async function createBusinessWebsiteDraft(input: CreateBusinessWebsiteDraftInput) {
  return request<{
    website: BusinessWebsiteApiRecord;
    assistantSummary: string;
    suggestedNextSteps: string[];
  }>("/business/websites/draft", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBusinessWebsite(
  siteId: string,
  input: Partial<Pick<BusinessWebsiteApiRecord, "title" | "slug" | "content">>
) {
  return request<{ website: BusinessWebsiteApiRecord }>(`/business/websites/${encodeURIComponent(siteId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function publishBusinessWebsite(siteId: string) {
  return request<{ website: BusinessWebsiteApiRecord }>(
    `/business/websites/${encodeURIComponent(siteId)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function getPublicBusinessWebsite(slug: string) {
  return request<{ website: BusinessWebsiteApiRecord }>(`/public/websites/${encodeURIComponent(slug)}`);
}
