// 後方互換性のために型エイリアスは残す。新規フォルダは任意の string ID を使用する
export type SectionId = string;

export interface SelfAnalysisItem {
  id: string;
  sectionId: string; // folderId として使用（既存の "small-wins" | "fun" | "strength" | "dream" も引き続き動作）
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
        sectionId: String(x.sectionId ?? "small-wins"),
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

export function getCountBySection(items: SelfAnalysisItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.sectionId] = (counts[item.sectionId] ?? 0) + 1;
  }
  return counts;
}
