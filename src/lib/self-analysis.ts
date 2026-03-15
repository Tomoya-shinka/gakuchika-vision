export type SectionId = "small-wins" | "fun" | "strength" | "dream";

export interface SelfAnalysisItem {
  id: string;
  sectionId: SectionId;
  text: string;
  createdAt: string;
}

export const SELF_ANALYSIS_STORAGE_KEY = "gakuchika-self-analysis-items";

export function loadSelfAnalysisItems(): SelfAnalysisItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SELF_ANALYSIS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      .map((x) => ({
        id: String(x.id ?? crypto.randomUUID()),
        sectionId: String(x.sectionId ?? "small-wins") as SectionId,
        text: String(x.text ?? "").trim(),
        createdAt: String(x.createdAt ?? new Date().toISOString()),
      }))
      .filter((x) => x.sectionId && x.text)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export function saveSelfAnalysisItems(items: SelfAnalysisItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELF_ANALYSIS_STORAGE_KEY, JSON.stringify(items));
}

export function getCountBySection(items: SelfAnalysisItem[]): Record<SectionId, number> {
  const counts: Record<SectionId, number> = {
    "small-wins": 0,
    fun: 0,
    strength: 0,
    dream: 0,
  };
  for (const item of items) {
    if (item.sectionId in counts) {
      counts[item.sectionId as SectionId]++;
    }
  }
  return counts;
}
