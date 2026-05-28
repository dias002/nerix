import { DomainError, fail, ok } from "../../domain/result.js";
import type { UserRepository } from "./user.repository.js";

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async getCurrentUser(userId = "local-user") {
    const user = await this.repository.findById(userId);

    if (!user) {
      return fail(new DomainError("not_found", `User '${userId}' was not found.`, 404));
    }

    return ok(user);
  }
}

