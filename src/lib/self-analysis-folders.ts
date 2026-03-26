export interface SelfAnalysisFolder {
  id: string;
  name: string;
  emoji: string;
  color?: string; // カラーキー（例 "amber" / "pink" / "emerald" など）
  description?: string;
  order: number;
  createdAt: string;
  isDefault: boolean;
}

/** 選択可能なカラーセット */
export const FOLDER_COLOR_OPTIONS = [
  { id: "amber",   label: "オレンジ", accent: "text-amber-700 dark:text-amber-400",   bgAccent: "bg-amber-50 dark:bg-amber-950/40",   borderAccent: "border-amber-200/60 dark:border-amber-800/50",   swatch: "bg-amber-400"   },
  { id: "pink",    label: "ピンク",   accent: "text-pink-700 dark:text-pink-400",     bgAccent: "bg-pink-50 dark:bg-pink-950/40",     borderAccent: "border-pink-200/60 dark:border-pink-800/50",     swatch: "bg-pink-400"    },
  { id: "emerald", label: "グリーン", accent: "text-emerald-700 dark:text-emerald-400", bgAccent: "bg-emerald-50 dark:bg-emerald-950/40", borderAccent: "border-emerald-200/60 dark:border-emerald-800/50", swatch: "bg-emerald-400" },
  { id: "sky",     label: "ブルー",   accent: "text-sky-700 dark:text-sky-400",       bgAccent: "bg-sky-50 dark:bg-sky-950/40",       borderAccent: "border-sky-200/60 dark:border-sky-800/50",       swatch: "bg-sky-400"     },
  { id: "purple",  label: "パープル", accent: "text-purple-700 dark:text-purple-400", bgAccent: "bg-purple-50 dark:bg-purple-950/40", borderAccent: "border-purple-200/60 dark:border-purple-800/50", swatch: "bg-purple-400"  },
  { id: "rose",    label: "レッド",   accent: "text-rose-700 dark:text-rose-400",     bgAccent: "bg-rose-50 dark:bg-rose-950/40",     borderAccent: "border-rose-200/60 dark:border-rose-800/50",     swatch: "bg-rose-400"    },
  { id: "indigo",  label: "インディゴ", accent: "text-indigo-700 dark:text-indigo-400", bgAccent: "bg-indigo-50 dark:bg-indigo-950/40", borderAccent: "border-indigo-200/60 dark:border-indigo-800/50", swatch: "bg-indigo-400" },
  { id: "teal",    label: "ティール", accent: "text-teal-700 dark:text-teal-400",     bgAccent: "bg-teal-50 dark:bg-teal-950/40",     borderAccent: "border-teal-200/60 dark:border-teal-800/50",     swatch: "bg-teal-400"    },
] as const;

type ColorId = typeof FOLDER_COLOR_OPTIONS[number]["id"];

/** カラーキー → スタイルオブジェクト */
export function getFolderAccent(colorId?: string, fallbackIndex = 0) {
  const found = FOLDER_COLOR_OPTIONS.find((c) => c.id === colorId);
  if (found) return { accent: found.accent, bgAccent: found.bgAccent, borderAccent: found.borderAccent };
  // フォールバック: インデックスローテーション
  const fb = FOLDER_COLOR_OPTIONS[fallbackIndex % FOLDER_COLOR_OPTIONS.length];
  return { accent: fb.accent, bgAccent: fb.bgAccent, borderAccent: fb.borderAccent };
}

/** 絵文字候補一覧（カテゴリ別） */
export const EMOJI_OPTIONS = [
  // 感情・気持ち
  "😊","😄","😍","🥰","😎","🤩","🤗","😁","🙂","😇",
  // 強さ・達成
  "💪","🔥","✨","💫","⭐","🌟","💥","🎉","🏆","🥇",
  // 自然
  "🌸","🌺","🌻","🌹","🌷","🍀","🌿","🌱","🌲","🌈",
  "🌊","🌙","☀️","🌤️","🍁","🦋","🐝","🌍","🏔️","🌴",
  // 勉強・仕事・成長
  "📚","📖","✏️","📝","💡","🧠","🎓","💼","📊","🔬",
  "🎯","🛠️","🔍","📌","🗒️","📐","🔭","💻","📱","⚙️",
  // 趣味・スポーツ
  "🎮","🎵","🎨","🎭","🎬","⚽","🏀","🎾","🚴","🏃",
  "🏊","🧘","🎸","🎹","🎷","🎯","🛹","🏄","🧗","⛷️",
  // 食べ物
  "🍎","🍊","🍋","🍇","🍓","🍕","🍜","🍣","🍰","☕",
  // ハート・愛
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💕","💞",
  "💓","💗","💖","💝","💘","🫶","👑","🎁","💌","🔑",
  // フォルダ・整理
  "📁","📂","🗂️","🗃️","🧩","🎲","🎪","🏠","🚀","💎",
];

const DEFAULT_COLOR_ORDER: ColorId[] = ["amber", "pink", "emerald", "sky"];

export const DEFAULT_FOLDERS: SelfAnalysisFolder[] = [
  { id: "small-wins", name: "小さな成功体験", emoji: "🌟", color: "amber",   description: "自分が達成感を感じたこと",          order: 0, createdAt: "2024-01-01T00:00:00.000Z", isDefault: true },
  { id: "fun",        name: "楽しかったこと", emoji: "❤️",  color: "pink",    description: "時間を忘れて没頭したこと",          order: 1, createdAt: "2024-01-01T00:00:00.000Z", isDefault: true },
  { id: "strength",   name: "強み",           emoji: "💪",  color: "emerald", description: "自分が得意なこと・人より上手なこと", order: 2, createdAt: "2024-01-01T00:00:00.000Z", isDefault: true },
  { id: "dream",      name: "夢",             emoji: "🌈",  color: "sky",     description: "将来やりたいこと・なりたい自分",    order: 3, createdAt: "2024-01-01T00:00:00.000Z", isDefault: true },
];

const STORAGE_KEY = "gakuchika-self-analysis-folders";

export function loadFolders(): SelfAnalysisFolder[] {
  if (typeof window === "undefined") return DEFAULT_FOLDERS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_FOLDERS;
    const parsed = JSON.parse(stored) as SelfAnalysisFolder[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_FOLDERS;
    return parsed.sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_FOLDERS;
  }
}

export function saveFolders(folders: SelfAnalysisFolder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}
