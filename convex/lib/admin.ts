import { getAuthUserId } from "@convex-dev/auth/server";

import type { QueryCtx } from "../_generated/server";

export async function requireAdmin(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get(userId) : null;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!user?.email || !adminEmail || user.email.toLowerCase() !== adminEmail) {
    throw new Error("Administrator access required.");
  }
}
