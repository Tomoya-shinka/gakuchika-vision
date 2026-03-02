/** 習慣タスクの定義（ID、名前、アイコン） */
export interface HabitTask {
  id: string;
  name: string;
  /** Lucideアイコン名 "BookOpen" または 絵文字 "📚" */
  icon: string;
}

/** 完了記録：key = taskId_date (YYYY-MM-DD), value = true */
export type HabitCompletions = Record<string, boolean>;

export const HABIT_TASKS_KEY = "gakuchika-habits-tasks";
export const HABIT_COMPLETIONS_KEY = "gakuchika-habits-completions";

export function loadHabitTasks(): HabitTask[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(HABIT_TASKS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      .map((x) => ({
        id: String(x.id ?? crypto.randomUUID()),
        name: String(x.name ?? ""),
        icon: String(x.icon ?? "📋"),
      }))
      .filter((t) => t.name.trim() !== "");
  } catch {
    return [];
  }
}

export function saveHabitTasks(tasks: HabitTask[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HABIT_TASKS_KEY, JSON.stringify(tasks));
}

export function loadHabitCompletions(): HabitCompletions {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(HABIT_COMPLETIONS_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const result: HabitCompletions = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "boolean" && v) result[k] = true;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveHabitCompletions(completions: HabitCompletions): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HABIT_COMPLETIONS_KEY, JSON.stringify(completions));
}

function completionKey(taskId: string, date: string): string {
  return `${taskId}_${date}`;
}

export function getCompletion(taskId: string, date: string, completions: HabitCompletions): boolean {
  return !!completions[completionKey(taskId, date)];
}

export function toggleCompletion(
  taskId: string,
  date: string,
  completions: HabitCompletions
): HabitCompletions {
  const key = completionKey(taskId, date);
  const next = { ...completions };
  if (next[key]) {
    delete next[key];
  } else {
    next[key] = true;
  }
  return next;
}

/** 今日の日付 (YYYY-MM-DD) */
export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 今週の日曜日〜土曜日（7日間）の日付キー YYYY-MM-DD */
export function getWeekKeys(): string[] {
  const keys: string[] = [];
  const today = new Date();
  const sundayOffset = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - sundayOffset);
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/** @deprecated 過去4日・今日・未来4日の9日間（getWeekKeys を使用） */
export function get9DaysKeys(): string[] {
  const keys: string[] = [];
  for (let i = -4; i <= 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/** 日付の表示ラベル */
export function formatDateLabel(dateKey: string): string {
  const today = getTodayKey();
  if (dateKey === today) return "今日";
  const d = new Date(dateKey + "T12:00:00Z");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  if (dateKey === yesterdayKey) return "昨日";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  if (dateKey === tomorrowKey) return "明日";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 日付と曜日をコンパクトに表示（2/26 水 など） */
export function formatDateWithWeekday(dateKey: string): { date: string; weekday: string } {
  const today = getTodayKey();
  const d = new Date(dateKey + "T12:00:00Z");
  const date = dateKey === today ? "今日" : `${d.getMonth() + 1}/${d.getDate()}`;
  const weekday = WEEKDAY_LABELS[d.getDay()];
  return { date, weekday };
}

/** チャート用：今週（日〜土）の各日の完了タスク数 */
export interface ChartDataItem {
  date: string;
  count: number;
  label: string;
}

export function get7DayChartData(tasks: HabitTask[], completions: HabitCompletions): ChartDataItem[] {
  return getWeekKeys().map((date) => {
    const { date: dateStr, weekday } = formatDateWithWeekday(date);
    const label = `${dateStr} ${weekday}`;
    const count = tasks.filter((t) => getCompletion(t.id, date, completions)).length;
    return { date, count, label };
  });
}

/** 今日の達成率（0〜100） */
export function getTodayRate(tasks: HabitTask[], completions: HabitCompletions): number {
  if (tasks.length === 0) return 0;
  const today = getTodayKey();
  const done = tasks.filter((t) => getCompletion(t.id, today, completions)).length;
  return Math.round((done / tasks.length) * 100);
}
