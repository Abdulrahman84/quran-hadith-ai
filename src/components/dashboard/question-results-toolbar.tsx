import type { TranslationKey } from "@/lib/i18n";

import type { DashboardStatus } from "./types";

type QuestionResultsToolbarProps = {
  search: string;
  setSearch: (search: string) => void;
  setStatus: (status: DashboardStatus) => void;
  status: DashboardStatus;
  t: (key: TranslationKey) => string;
};

const statuses: DashboardStatus[] = ["all", "completed", "needs_review", "failed"];

function statusKey(status: DashboardStatus): TranslationKey {
  if (status === "completed") return "dashboard.status.completed";
  if (status === "needs_review") return "dashboard.status.warnings";
  if (status === "failed") return "dashboard.status.failed";
  return "dashboard.status.all";
}

export function QuestionResultsToolbar(props: QuestionResultsToolbarProps) {
  const { search, setSearch, setStatus, status, t } = props;

  return (
    <div className="grid gap-3 lg:min-w-[28rem]">
      <label className="grid gap-1.5 text-xs font-bold text-[var(--color-muted)]">
        {t("dashboard.questions.searchLabel")}
        <input
          className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--background)] px-3 text-sm font-semibold text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-green)]"
          dir="auto"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("dashboard.questions.searchPlaceholder")}
          type="search"
          value={search}
        />
      </label>

      <div className="flex flex-wrap gap-2" aria-label={t("dashboard.questions.filterLabel")}>
        {statuses.map((item) => (
          <button
            aria-pressed={status === item}
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--background)] px-3 py-2 text-xs font-bold text-[var(--color-green)] transition hover:border-[var(--color-gold)] data-[active=true]:border-[var(--color-green)] data-[active=true]:bg-[var(--color-green)] data-[active=true]:text-white"
            data-active={status === item}
            key={item}
            onClick={() => setStatus(item)}
            type="button"
          >
            {t(statusKey(item))}
          </button>
        ))}
      </div>
    </div>
  );
}
