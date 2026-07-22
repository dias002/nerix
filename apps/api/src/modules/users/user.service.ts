import { DomainError, fail, ok } from "../../domain/result.js";
import { normalizeAvatarDataUrl } from "./avatar.js";
import type { UpdateUserProfileInput, UserRepository } from "./user.repository.js";
import type { UserRecord } from "./user.types.js";

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async getCurrentUser(userId = "local-user") {
    const user = await this.repository.findById(userId);

    if (!user) {
      return fail(new DomainError("not_found", `User '${userId}' was not found.`, 404));
    }

    return ok(user);
  }

  async updateCurrentUserProfile(userId: string, input: UpdateUserProfileInput & { avatarDataUrl?: string | null }) {
    const normalized = normalizeProfileInput(input);
    if (!normalized.ok) return normalized;

    const user = await this.repository.updateProfile(userId, normalized.value);
    if (!user) {
      return fail(new DomainError("not_found", `User '${userId}' was not found.`, 404));
    }

    return ok({ user });
  }

  async exportCurrentUserData(userId = "local-user", fallbackUser?: UserRecord) {
    const exportData = await this.repository.exportData(userId, fallbackUser);

    if (!exportData) {
      return fail(new DomainError("not_found", `User '${userId}' was not found.`, 404));
    }

    return ok(exportData);
  }

  async deleteCurrentUser(input: { userId: string; confirmation: string; fallbackUser?: UserRecord }) {
    if (input.confirmation !== "DELETE") {
      return fail(new DomainError("validation_failed", "Type DELETE to confirm account deletion.", 400));
    }

    const result = await this.repository.deactivateAccount(input.userId, input.fallbackUser);
    if (!result) {
      return fail(new DomainError("not_found", `User '${input.userId}' was not found.`, 404));
    }

    return ok({ ...result, deleted: true });
  }
}

function normalizeProfileInput(input: UpdateUserProfileInput & { avatarDataUrl?: string | null }) {
  try {
    const avatarUrl = normalizeAvatarDataUrl(input.avatarDataUrl);
    return ok({
      name: input.name?.trim(),
      country: input.country,
      language: input.language,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    });
  } catch (error) {
    if (error instanceof DomainError) return fail(error);
    throw error;
  }
}
