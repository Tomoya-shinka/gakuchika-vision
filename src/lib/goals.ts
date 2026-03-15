/** 目標1件のデータ（content/image/deadline に対応） */
export interface GoalItem {
  /** 目標の内容（必須）。旧 text からマイグレーション */
  content: string;
  /** 達成時の具体的なイメージ（任意） */
  image: string;
  /** 達成予定日 YYYY-MM-DD（任意） */
  deadline: string;
  updatedAt: string;
}

/** @deprecated GoalItem を使用 */
export type GoalTextItem = GoalItem;

export interface SmallStepItem {
  id: string;
  label: string;
  done: boolean;
  /** カテゴリ（#学習 #生活 #就活 など） */
  category?: string;
  /** 期限（ISO日付 "2025-02-26" または "today" | "tomorrow"） */
  dueDate?: string;
  /** 完了日時（ISO文字列）完了時に設定 */
  completedAt?: string;
}

export interface GoalsData {
  longTermVision: GoalItem;
  oneYearGoal: GoalItem;
  oneMonthGoal: GoalItem;
  smallSteps: SmallStepItem[];
}

export const GOALS_STORAGE_KEY = "gakuchika-goals";

/** AIチャットから目標入力フォームへ提案を渡すための sessionStorage キー（接尾辞に type を付与） */
export const GOAL_AI_PROPOSAL_KEY = "gakuchika-goal-ai-proposal";

const defaultGoalItem = (): GoalItem => ({
  content: "",
  image: "",
  deadline: "",
  updatedAt: "",
});

const defaultGoalsData = (): GoalsData => ({
  longTermVision: defaultGoalItem(),
  oneYearGoal: defaultGoalItem(),
  oneMonthGoal: defaultGoalItem(),
  smallSteps: [],
});

/** 旧形式（text）から新形式（content/image/deadline）へマイグレーション */
function migrateGoalItem(raw: Record<string, unknown> | undefined): GoalItem {
  const base = defaultGoalItem();
  if (!raw || typeof raw !== "object") return base;
  const text = raw.text ?? raw.content;
  return {
    content: String(text ?? ""),
    image: String(raw.image ?? ""),
    deadline: String(raw.deadline ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
}

function parseSteps(rawSteps: Record<string, unknown>[]): SmallStepItem[] {
  return rawSteps.map((s: Record<string, unknown>) => ({
    id: String(s.id ?? crypto.randomUUID()),
    label: String(s.label ?? ""),
    done: Boolean(s.done),
    category: s.category ? String(s.category) : undefined,
    dueDate: s.dueDate ? String(s.dueDate) : undefined,
    completedAt: s.completedAt ? String(s.completedAt) : undefined,
  }));
}

export function loadGoals(): GoalsData {
  if (typeof window === "undefined") return defaultGoalsData();
  try {
    const stored = localStorage.getItem(GOALS_STORAGE_KEY);
    if (!stored) return defaultGoalsData();
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const longTermVision = migrateGoalItem(parsed.longTermVision as Record<string, unknown> | undefined);
    const oneYearGoal = migrateGoalItem(parsed.oneYearGoal as Record<string, unknown> | undefined);
    const oneMonthGoal = migrateGoalItem(parsed.oneMonthGoal as Record<string, unknown> | undefined);
    const rawSteps = Array.isArray(parsed.smallSteps) ? parsed.smallSteps : [];
    const smallSteps = parseSteps(rawSteps as Record<string, unknown>[]);
    return {
      longTermVision,
      oneYearGoal,
      oneMonthGoal,
      smallSteps,
    };
  } catch {
    return defaultGoalsData();
  }
}

export function saveGoals(data: GoalsData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(data));
}

/** 達成予定日 YYYY-MM-DD を 202X/MM/DD 形式で返す（カード表示用） */
export function formatDeadlineShort(deadline: string): string {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return "";
  return deadline.replace(/-/g, "/");
}

/** 達成予定日 YYYY-MM-DD を表示用に整形 */
export function formatDeadline(deadline: string): string {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return "";
  try {
    return new Date(deadline + "T12:00:00Z").toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return deadline;
  }
}

export function formatUpdatedAt(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ja-JP", {
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
