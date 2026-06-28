import { DomainError, fail, ok } from "../../domain/result.js";
import type { UserRepository } from "./user.repository.js";
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

  async exportCurrentUserData(userId = "local-user", fallbackUser?: UserRecord) {
    const exportData = await this.repository.exportData(userId, fallbackUser);

    if (!exportData) {
      return fail(new DomainError("not_found", `User '${userId}' was not found.`, 404));
    }

    return ok(exportData);
  }

  async deactivateCurrentUser(input: { userId: string; confirmation: string; fallbackUser?: UserRecord }) {
    if (input.confirmation !== "DELETE") {
      return fail(new DomainError("validation_failed", "Type DELETE to confirm account deletion.", 400));
    }

    const result = await this.repository.deactivateAccount(input.userId, input.fallbackUser);
    if (!result) {
      return fail(new DomainError("not_found", `User '${input.userId}' was not found.`, 404));
    }

    return ok(result);
  }
}
