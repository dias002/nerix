import type { UserRecord } from "./user.types.js";

export interface UserRepository {
  findById(userId: string): Promise<UserRecord | null>;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, UserRecord>([
    [
      "local-user",
      {
        id: "local-user",
        name: "Local User",
        email: "local@nerix.ai",
        phone: null,
        country: "KZ",
        language: "ru",
      },
    ],
  ]);

  async findById(userId: string) {
    return this.users.get(userId) ?? null;
  }
}

