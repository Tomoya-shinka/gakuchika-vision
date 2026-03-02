export interface JournalEntry {
  id: string;
  content: string;
  createdAt: string;
  category?: string;
}

export const JOURNAL_STORAGE_KEY = "gakuchika-journal-entries";

export function loadEntries(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const raw = Array.isArray(parsed) ? parsed : [];

    return raw
      .map((e: Record<string, unknown>) => {
        let content = "";
        if (typeof e.content === "string") {
          const parts = [e.title, e.content, e.reflection].filter(
            (x): x is string => typeof x === "string" && x.length > 0
          );
          content = parts.length > 1 ? parts.join("\n\n") : (e.content as string);
        }
        return {
          id: String(e.id ?? crypto.randomUUID()),
          content,
          createdAt: String(e.createdAt ?? new Date().toISOString()),
          category: "未分類",
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

export function getPreview(content: string, maxLen = 60): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
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
