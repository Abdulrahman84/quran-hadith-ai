import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

        if (!adminEmail || email !== adminEmail) {
          throw new Error("This dashboard is restricted to the configured administrator.");
        }

        return { email, name: "Sanad AI Administrator" };
      },
    }),
  ],
});
