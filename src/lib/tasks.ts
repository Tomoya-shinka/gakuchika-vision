/** 7日間の達成履歴（日付 -> 完了数） */
export const COMPLETION_STORAGE_KEY = "gakuchika-tasks-completion";

export type CompletionHistory = Record<string, number>;

export function loadCompletionHistory(): CompletionHistory {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(COMPLETION_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const result: CompletionHistory = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && v >= 0) result[k] = v;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveCompletionHistory(history: CompletionHistory): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(history));
}

/** タスクを完了にしたとき呼ぶ（今日のカウントを+1） */
export function incrementCompletion(completedAt: string): void {
  const key = completedAt.slice(0, 10);
  const history = loadCompletionHistory();
  history[key] = (history[key] ?? 0) + 1;
  saveCompletionHistory(history);
}

/** タスクを未完了に戻したとき呼ぶ（その日のカウントを-1） */
export function decrementCompletion(completedAt: string): void {
  const key = completedAt.slice(0, 10);
  const history = loadCompletionHistory();
  const n = (history[key] ?? 1) - 1;
  if (n <= 0) delete history[key];
  else history[key] = n;
  saveCompletionHistory(history);
}

/** 過去7日間の日付キーを生成 */
export function getLast7DaysKeys(): string[] {
  const keys: string[] = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    keys.push(x.toISOString().slice(0, 10));
  }
  return keys;
}

/** 過去7日間のチャート用データ */
export interface ChartDataItem {
  date: string;
  count: number;
  label: string; // "2/20" など
}

export function get7DayChartData(): ChartDataItem[] {
  const history = loadCompletionHistory();
  return getLast7DaysKeys().map((date) => {
    const d = new Date(date + "T12:00:00Z");
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    return {
      date,
      count: history[date] ?? 0,
      label,
    };
  });
}

/** 期限の表示用ラベル（今日/明日など） */
export function formatDueDate(dueDate: string | undefined): string {
  if (!dueDate) return "－";
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate === "today" || dueDate === today) return "今日";
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dueDate === "tomorrow" || dueDate === tomorrow) return "明日";
  try {
    const d = new Date(dueDate + "T12:00:00Z");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return dueDate;
  }
}

export const TASK_CATEGORIES = ["#学習", "#生活", "#就活", "#その他"] as const;
