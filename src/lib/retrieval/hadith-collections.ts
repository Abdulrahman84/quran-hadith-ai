export type HadithCollectionSelection = "all" | "bukhari" | "muslim" | "abu_dawud" | "tirmidhi" | "nasai" | "ibn_majah";

export const hadithCollections: Array<{ id: Exclude<HadithCollectionSelection, "all">; labelAr: string; labelEn: string }> = [
  { id: "bukhari", labelAr: "صحيح البخاري", labelEn: "Sahih al-Bukhari" },
  { id: "muslim", labelAr: "صحيح مسلم", labelEn: "Sahih Muslim" },
  { id: "abu_dawud", labelAr: "سنن أبي داود", labelEn: "Sunan Abi Dawud" },
  { id: "tirmidhi", labelAr: "جامع الترمذي", labelEn: "Jami at-Tirmidhi" },
  { id: "nasai", labelAr: "سنن النسائي", labelEn: "Sunan an-Nasa'i" },
  { id: "ibn_majah", labelAr: "سنن ابن ماجه", labelEn: "Sunan Ibn Majah" },
];

const hadithCollectionSelections = new Set<HadithCollectionSelection>(["all", ...hadithCollections.map((collection) => collection.id)]);

export function isHadithCollectionSelection(value: unknown): value is HadithCollectionSelection {
  return typeof value === "string" && hadithCollectionSelections.has(value as HadithCollectionSelection);
}
