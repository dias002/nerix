import { DomainError, fail, ok } from "../../domain/result.js";
import type { ProjectRepository } from "./project.repository.js";
import type { CreateProjectInput, UpdateProjectInput } from "./project.types.js";

export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  async listProjects(userId: string) {
    return ok({
      projects: await this.projects.listByUser(userId),
    });
  }

  async createProject(input: CreateProjectInput) {
    const title = input.title.trim();
    if (!title) {
      return fail(new DomainError("validation_failed", "Project title is required.", 400));
    }

    const project = await this.projects.create({
      ...input,
      title,
      description: input.description?.trim() ?? "",
      metadata: input.metadata ?? {},
    });
    if (!project) return fail(new DomainError("not_found", `User '${input.userId}' was not found.`, 404));

    return ok({ project });
  }

  async updateProject(userId: string, projectId: string, input: UpdateProjectInput) {
    const title = input.title?.trim();
    if (input.title !== undefined && !title) {
      return fail(new DomainError("validation_failed", "Project title is required.", 400));
    }

    const project = await this.projects.update(userId, projectId, {
      ...input,
      title,
      description: input.description?.trim(),
      metadata: input.metadata,
    });
    if (!project) return fail(new DomainError("not_found", "Project was not found.", 404));

    return ok({ project });
  }

  async deleteProject(userId: string, projectId: string) {
    const deleted = await this.projects.delete(userId, projectId);
    if (!deleted) return fail(new DomainError("not_found", "Project was not found.", 404));

    return ok({ deleted: true });
  }
}
