export type ProjectStatus = "planned" | "active" | "done";
export type ProjectType = "general" | "content" | "marketing" | "development" | "research";

export type ProjectRecord = {
  id: string;
  userId: string;
  title: string;
  description: string;
  projectType: ProjectType;
  status: ProjectStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  userId: string;
  title: string;
  description?: string;
  projectType?: ProjectType;
  status?: ProjectStatus;
  metadata?: Record<string, unknown>;
};

export type UpdateProjectInput = {
  title?: string;
  description?: string;
  projectType?: ProjectType;
  status?: ProjectStatus;
  metadata?: Record<string, unknown>;
};
