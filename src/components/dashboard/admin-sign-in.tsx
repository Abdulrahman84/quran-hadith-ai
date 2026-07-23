"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { FormEvent, useState } from "react";

import type { TranslationKey } from "@/lib/i18n";

type AdminSignInProps = {
  t: (key: TranslationKey) => string;
};

export function AdminSignIn({ t }: AdminSignInProps) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch {
      setError(t("dashboard.auth.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-lg place-items-center px-5 py-10 sm:px-8">
      <section className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_20px_54px_rgba(22,58,95,0.1)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-green-soft)]">{t("dashboard.auth.eyebrow")}</p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--color-green)]">{t("dashboard.auth.title")}</h1>
        <p className="mt-3 text-sm font-medium leading-7 text-[var(--color-muted)]">{t("dashboard.auth.description")}</p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-bold text-[var(--color-ink)]">
            {t("dashboard.auth.email")}
            <input
              autoComplete="username"
              className="h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)] px-4 font-medium outline-none transition focus:border-[var(--color-gold)]"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-[var(--color-ink)]">
            {t("dashboard.auth.password")}
            <input
              autoComplete="current-password"
              className="h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)] px-4 font-medium outline-none transition focus:border-[var(--color-gold)]"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="rounded-lg border border-[var(--color-red)]/25 bg-[var(--color-error-soft)] p-3 text-sm font-semibold text-[var(--color-red)]" role="alert">{error}</p> : null}

          <button
            className="h-12 rounded-xl bg-[var(--color-green)] px-5 text-sm font-bold text-white transition hover:bg-[var(--color-ink)] disabled:cursor-wait disabled:opacity-70"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t("dashboard.auth.signingIn") : t("dashboard.auth.signIn")}
          </button>
        </form>
      </section>
    </div>
  );
}
