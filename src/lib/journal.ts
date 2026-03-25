export type JournalVisibility = "private" | "public";

export interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;
  category?: string;
  title?: string;
  visibility?: JournalVisibility;
  audioUrl?: string;
  audioDurationSec?: number;
  imageUrls?: string[];
}

export const JOURNAL_STORAGE_KEY = "gakuchika-journal-entries";
const JOURNAL_STORAGE_VERSION_KEY = "gakuchika-journal-version";
const JOURNAL_STORAGE_VERSION = "2";

export function loadEntries(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    // 一度だけ古いローカルデータをリセットして、過去のジャーナルを削除
    const currentVersion = localStorage.getItem(JOURNAL_STORAGE_VERSION_KEY);
    if (currentVersion !== JOURNAL_STORAGE_VERSION) {
      localStorage.removeItem(JOURNAL_STORAGE_KEY);
      localStorage.setItem(JOURNAL_STORAGE_VERSION_KEY, JOURNAL_STORAGE_VERSION);
      return [];
    }

    const stored = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const raw = Array.isArray(parsed) ? parsed : [];

    return raw
      .map((e: Record<string, unknown>) => {
        let content = "";
        if (typeof e.content === "string") {
          const hasExplicitTitle =
            typeof e.title === "string" && (e.title as string).trim().length > 0;
          if (hasExplicitTitle) {
            content = (e.content as string).trim();
          } else {
            const parts = [e.title, e.content, e.reflection].filter(
              (x): x is string => typeof x === "string" && x.length > 0
            );
            content =
              parts.length > 1 ? parts.join("\n\n") : (e.content as string);
          }
        }
        const visibility =
          e.visibility === "public" || e.visibility === "private"
            ? e.visibility
            : "private";
        return {
          id: String(e.id ?? crypto.randomUUID()),
          content,
          createdAt: String(e.createdAt ?? new Date().toISOString()),
          category: "未分類",
          title: typeof e.title === "string" ? (e.title as string).trim() || undefined : undefined,
          visibility,
        } as JournalEntry;
      })
      .filter((e: JournalEntry) => e.content || e.id)
      .sort(
        (a: JournalEntry, b: JournalEntry) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  } catch {
    return [];
  }
}

export function saveEntries(entries: JournalEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** HTML タグを除去してプレーンテキストを返す（リッチテキストのプレビュー用） */
export function stripHtml(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? div.innerText ?? "").replace(/\s+/g, " ").trim();
}

export function getPreview(content: string, maxLen = 60): string {
  const plain = stripHtml(content);
  const trimmed = plain.trim();
  if (!trimmed) return "無題";
  return trimmed.length <= maxLen ? trimmed : `${trimmed.slice(0, maxLen)}…`;
}

export interface JournalStats {
  totalCount: number;
  totalChars: number;
  streakDays: number;
}

export function computeJournalStats(entries: JournalEntry[]): JournalStats {
  const totalCount = entries.length;
  const totalChars = entries.reduce((sum, e) => sum + (e.content?.length ?? 0), 0);

  // 継続日数: 今日から遡って何日連続で記録があるか
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateSet = new Set(
    entries.map((e) => {
      const d = new Date(e.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  let streak = 0;
  const cursor = new Date(today);
  while (dateSet.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { totalCount, totalChars, streakDays: streak };
}
