import type { DatabaseClient } from "../../database/index.js";

export const LOCAL_USER_PUBLIC_ID = "local-user";
export const LOCAL_USER_DATABASE_ID = "00000000-0000-4000-8000-000000000001";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toDatabaseUserId(userId: string) {
  if (userId === LOCAL_USER_PUBLIC_ID) return LOCAL_USER_DATABASE_ID;
  return uuidPattern.test(userId) ? userId : null;
}

export function toPublicUserId(databaseUserId: string) {
  return databaseUserId === LOCAL_USER_DATABASE_ID ? LOCAL_USER_PUBLIC_ID : databaseUserId;
}

export async function ensureLocalUser(database: DatabaseClient) {
  await database.query(
    `
      insert into users (id, email, phone, display_name, country_code, language)
      values ($1, $2, null, $3, $4, $5)
      on conflict (id) do nothing
    `,
    [LOCAL_USER_DATABASE_ID, "local@nerix.ai", "Local User", "KZ", "ru"]
  );
}
