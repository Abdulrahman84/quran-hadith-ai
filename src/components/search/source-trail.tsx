import { useMemo } from "react";

import type { TranslationKey } from "@/lib/i18n";
import type { SourceRecord } from "@/lib/retrieval/types";

const sourceRoutes: Array<{ id: "Quran" | "Tafsir" | "Hadith"; labelKey: TranslationKey }> = [
  { id: "Quran", labelKey: "routes.quran" },
  { id: "Tafsir", labelKey: "routes.tafsir" },
  { id: "Hadith", labelKey: "routes.hadith" },
];

type SourceTrailProps = {
  records: SourceRecord[] | undefined;
  t: (key: TranslationKey) => string;
};

export function SourceTrail({ records, t }: SourceTrailProps) {
  const activeRoutes = useMemo(() => {
    const kinds = new Set(records?.map((record) => record.sourceKind) ?? []);

    return {
      Quran: kinds.has("quran") || kinds.has("tafsir"),
      Tafsir: kinds.has("tafsir"),
      Hadith: kinds.has("hadith"),
    };
  }, [records]);

  return (
    <div className="animate-rise rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-4 py-3 shadow-[0_14px_34px_rgba(22,58,95,0.05)]">
      <div className="source-trail" aria-label={t("result.routes")}>
        {sourceRoutes.map((route, index) => (
          <span className="contents" key={route.id}>
            <span className="source-trail-item" data-active={activeRoutes[route.id]}>
              <span className="source-trail-dot" aria-hidden="true" />
              <span>{t(route.labelKey)}</span>
            </span>
            {index < sourceRoutes.length - 1 ? <span className="source-trail-separator" aria-hidden="true" /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
