export const tafsirSources = [
  { id: "tabary", labelAr: "تفسير الطبري", labelEn: "Tafsir al-Tabari" },
  { id: "katheer", labelAr: "تفسير ابن كثير", labelEn: "Tafsir Ibn Kathir" },
  { id: "baghawy", labelAr: "تفسير البغوي", labelEn: "Tafsir al-Baghawi" },
  { id: "saadi", labelAr: "تفسير السعدي", labelEn: "Tafsir al-Saadi" },
  { id: "moyassar", labelAr: "التفسير الميسر", labelEn: "Al-Muyassar" },
  { id: "mukhtasar_ar", labelAr: "المختصر في التفسير", labelEn: "Mukhtasar Arabic" },
  { id: "mukhtasar_en", labelAr: "المختصر بالإنجليزية", labelEn: "Mukhtasar English" },
] as const;

export type TafsirSourceId = (typeof tafsirSources)[number]["id"];
export type TafsirSourceSelection = "all" | TafsirSourceId;

const tafsirSourceIds = new Set<string>(tafsirSources.map((source) => source.id));

export function isTafsirSourceSelection(value: unknown): value is TafsirSourceSelection {
  return value === "all" || (typeof value === "string" && tafsirSourceIds.has(value));
}

export function resolveTafsirSources(selection: TafsirSourceSelection | undefined) {
  if (!selection || selection === "all") {
    return tafsirSources.map((source) => source.id);
  }

  return [selection];
}
