export type BusinessRoleKey = "owner" | "sales" | "support" | "marketing" | "developer";
export type BusinessMemberStatus = "online" | "away" | "offline";
export type AdvisorKey = "growth" | "sales" | "site" | "support";
export type BusinessIdeaStatus = "suggested" | "planned" | "in_progress" | "done";

export type BusinessWorkspaceRecord = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type BusinessRoleDefinition = {
  key: BusinessRoleKey;
  title: string;
  description: string;
  permissions: string[];
};

export type BusinessMemberRecord = {
  id: string;
  workspaceId: string;
  userId: string | null;
  invitedEmail: string | null;
  name: string;
  roleKey: BusinessRoleKey;
  roleTitle: string;
  access: string;
  status: BusinessMemberStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusinessGroupRecord = {
  id: string;
  workspaceId: string;
  name: string;
  purpose: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type BusinessEmployeeReportRecord = {
  id: string;
  workspaceId: string;
  memberId: string | null;
  userId: string | null;
  employeeName: string;
  roleTitle: string;
  reportDate: string;
  requestsCount: number;
  chatsCount: number;
  clientReportsCount: number;
  lastActivityAt: string | null;
  summary: string;
};

export type BusinessDealNoteRecord = {
  id: string;
  dealId: string;
  text: string;
  createdAt: string;
};

export type BusinessDealRecord = {
  id: string;
  workspaceId: string;
  client: string;
  request: string;
  stage: string;
  amount: string;
  source: string;
  nextStep: string;
  problem: string;
  createdAt: string;
  updatedAt: string;
  notes: BusinessDealNoteRecord[];
};

export type BusinessIdeaRecord = {
  id: string;
  workspaceId: string;
  advisorKey: AdvisorKey;
  title: string;
  effort: string;
  effect: string;
  text: string;
  next: string;
  status: BusinessIdeaStatus;
  createdAt: string;
  updatedAt: string;
};

export type BusinessAdvisorView = {
  key: AdvisorKey;
  title: string;
  short: string;
  summary: string;
  basedOn: string[];
  ideas: BusinessIdeaRecord[];
};

export type BusinessStaticCard = {
  title: string;
  text: string;
  icon?: string;
  price?: string;
};

export type BusinessMetric = {
  label: string;
  value: string;
  detail: string;
};

export type BusinessPipelineStage = {
  title: string;
  count: number;
  amount: string;
};

export type BusinessSignal = {
  tag: string;
  title: string;
  detail: string;
  tone: string;
};

export type BusinessTrafficSource = {
  source: string;
  value: number;
};

export type BusinessWorkspaceSnapshot = {
  workspace: BusinessWorkspaceRecord;
  access: {
    mode: "demo" | "active";
    planRequired: "business";
    enabled: boolean;
    subscriptionPlanId: string | null;
    message: string;
  };
  roles: BusinessRoleDefinition[];
  members: BusinessMemberRecord[];
  groups: BusinessGroupRecord[];
  employeeReports: BusinessEmployeeReportRecord[];
  stats: BusinessMetric[];
  knowledgeSources: string[];
  paidServices: BusinessStaticCard[];
  pipeline: BusinessPipelineStage[];
  deals: BusinessDealRecord[];
  customerSignals: BusinessSignal[];
  trafficSources: BusinessTrafficSource[];
  advisorViews: BusinessAdvisorView[];
};
