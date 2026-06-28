export type KnowledgeBaseEntryType =
  | "company_profile"
  | "service"
  | "faq"
  | "policy"
  | "brand_voice"
  | "source_note";

export type KnowledgeBaseEntryRecord = {
  id: string;
  workspaceId: string;
  createdByUserId: string | null;
  type: KnowledgeBaseEntryType;
  title: string;
  content: string;
  sourceUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateKnowledgeBaseEntryInput = {
  type: KnowledgeBaseEntryType;
  title: string;
  content: string;
  sourceUrl?: string;
  tags?: string[];
};

export type UpdateKnowledgeBaseEntryInput = Partial<CreateKnowledgeBaseEntryInput>;
