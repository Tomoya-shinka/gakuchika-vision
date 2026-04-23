/** カスタムカウントダウンカード（localStorage: gakuchika-countdown-settings） */

export type CountdownCardColor =
  | "sky"
  | "violet"
  | "amber"
  | "rose"
  | "emerald"
  | "indigo";

export interface CustomCountdownCard {
  id: string;
  /** 表示ラベル。例: "就活解禁まで" */
  label: string;
  /** 期限日 YYYY-MM-DD */
  deadline: string;
  color: CountdownCardColor;
  /** カード作成日時 ISO 文字列（プログレスバーの起点） */
  createdAt: string;
}

export interface CountdownSettings {
  /** 人生の残りカウントダウンを表示するか */
  showLifeCountdown: boolean;
  customCards: CustomCountdownCard[];
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const STORAGE_KEY = "gakuchika-countdown-settings";

/** 色ごとのスタイル定義（Tailwind JIT のため完全クラス文字列で記述） */
export const COLOR_OPTIONS: Array<{
  value: CountdownCardColor;
  label: string;
  /** カウントダウン数字の文字色 */
  numberClass: string;
  /** Progress バーの色オーバーライド */
  progressClass: string;
  /** 設定画面・ドットの背景色 */
  dotClass: string;
  /** 色選択スウォッチの背景色 */
  swatchClass: string;
}> = [
  {
    value: "sky",
    label: "空色",
    numberClass: "text-sky-600 dark:text-sky-400",
    progressClass: "",
    dotClass: "bg-sky-500",
    swatchClass: "bg-sky-400",
  },
  {
    value: "violet",
    label: "紫",
    numberClass: "text-violet-600 dark:text-violet-400",
    progressClass: "[&>div]:bg-violet-500",
    dotClass: "bg-violet-500",
    swatchClass: "bg-violet-400",
  },
  {
    value: "amber",
    label: "橙",
    numberClass: "text-amber-500 dark:text-amber-400",
    progressClass: "[&>div]:bg-amber-500",
    dotClass: "bg-amber-500",
    swatchClass: "bg-amber-400",
  },
  {
    value: "rose",
    label: "赤",
    numberClass: "text-rose-600 dark:text-rose-400",
    progressClass: "[&>div]:bg-rose-500",
    dotClass: "bg-rose-500",
    swatchClass: "bg-rose-400",
  },
  {
    value: "emerald",
    label: "緑",
    numberClass: "text-emerald-600 dark:text-emerald-400",
    progressClass: "[&>div]:bg-emerald-500",
    dotClass: "bg-emerald-500",
    swatchClass: "bg-emerald-400",
  },
  {
    value: "indigo",
    label: "藍",
    numberClass: "text-indigo-600 dark:text-indigo-400",
    progressClass: "[&>div]:bg-indigo-500",
    dotClass: "bg-indigo-500",
    swatchClass: "bg-indigo-400",
  },
];

export function loadCountdownSettings(): CountdownSettings {
  if (typeof window === "undefined")
    return { showLifeCountdown: true, customCards: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { showLifeCountdown: true, customCards: [] };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      showLifeCountdown: parsed.showLifeCountdown !== false,
      customCards: Array.isArray(parsed.customCards)
        ? (parsed.customCards as CustomCountdownCard[])
        : [],
    };
  } catch {
    return { showLifeCountdown: true, customCards: [] };
  }
}

export function saveCountdownSettings(settings: CountdownSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** 期限日からカウントダウンを計算（日本時間 00:00:00 基準） */
export function getCountdownPartsFromDeadline(deadline: string): CountdownParts {
  const target = new Date(`${deadline}T00:00:00+09:00`).getTime();
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

/** カード作成日〜期限日の進捗率（%）を返す */
export function getProgressFromDeadline(
  deadline: string,
  createdAt: string
): number {
  const start = new Date(createdAt).getTime();
  const end = new Date(`${deadline}T00:00:00+09:00`).getTime();
  const now = Date.now();
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}
