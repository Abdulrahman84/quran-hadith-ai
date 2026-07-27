import type { TranslationKey } from "@/lib/i18n";

type DashboardHeaderProps = {
  onSignOut: () => void;
  t: (key: TranslationKey) => string;
};

export function DashboardHeader({ onSignOut, t }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold text-[var(--color-green)]">{t("dashboard.eyebrow")}</p>
          <span className="rounded-md border border-[var(--color-gold)]/50 bg-[var(--color-gold-soft)] px-2 py-1 text-[0.65rem] font-bold text-[var(--color-ink)]">
            {t("dashboard.liveBadge")}
          </span>
        </div>
        <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.18] text-[var(--color-ink)] sm:text-6xl">
          {t("dashboard.title")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[var(--color-muted)] sm:text-base">
          {t("dashboard.intro")}
        </p>
      </div>

      <button
        className="min-h-11 w-fit rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-bold text-[var(--color-red)] transition hover:border-[var(--color-red)]"
        onClick={onSignOut}
        type="button"
      >
        {t("dashboard.auth.signOut")}
      </button>
    </div>
  );
}
