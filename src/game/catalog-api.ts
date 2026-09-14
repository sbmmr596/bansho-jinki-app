import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export const CATALOG_KEY = "bansho-user-catalog";

export const loadUserCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ payload: string }>`
      select payload from user_catalog where user_id = ${context.userId} limit 1
    `;
    return rows[0]?.payload ?? null;
  });

export const saveUserCatalog = createServerFn({ method: "POST" })
  .validator((payload: string) => payload)
  .middleware([authMiddleware])
  .handler(async ({ context, data: payload }) => {
    const text = typeof payload === "string" ? payload : "";
    if (!text || text.length > 400_000) throw new Error("catalog too large");
    const sql = await getSql();
    await sql`
      insert into user_catalog (user_id, payload, updated_at)
      values (${context.userId}, ${text}, now())
      on conflict (user_id) do update set payload = excluded.payload, updated_at = now()
    `;
    return true;
  });

export const clearUserCatalog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`delete from user_catalog where user_id = ${context.userId}`;
    return true;
  });
