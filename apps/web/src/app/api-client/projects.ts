import { request } from "./transport";

export type UserProjectStatus = "planned" | "active" | "done";
export type UserProjectType = "general" | "content" | "marketing" | "development" | "research";

export type UserProjectApiRecord = {
  id: string;
  userId: string;
  title: string;
  description: string;
  projectType: UserProjectType;
  status: UserProjectStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function getProjects() {
  return request<{ projects: UserProjectApiRecord[] }>("/projects");
}

export async function createProject(input: {
  title: string;
  description?: string;
  projectType?: UserProjectType;
  status?: UserProjectStatus;
  metadata?: Record<string, unknown>;
}) {
  return request<{ project: UserProjectApiRecord }>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProject(input: {
  projectId: string;
  title?: string;
  description?: string;
  projectType?: UserProjectType;
  status?: UserProjectStatus;
  metadata?: Record<string, unknown>;
}) {
  return request<{ project: UserProjectApiRecord }>(`/projects/${encodeURIComponent(input.projectId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      projectType: input.projectType,
      status: input.status,
      metadata: input.metadata,
    }),
  });
}

export async function deleteProject(projectId: string) {
  return request<{ deleted: true }>(`/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
}
