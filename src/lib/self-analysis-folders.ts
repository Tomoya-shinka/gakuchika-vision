export interface SelfAnalysisFolder {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  order: number;
  createdAt: string;
  isDefault: boolean;
}

export const DEFAULT_FOLDERS: SelfAnalysisFolder[] = [
  {
    id: "small-wins",
    name: "小さな成功体験",
    emoji: "🌟",
    description: "自分が達成感を感じたこと",
    order: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    isDefault: true,
  },
  {
    id: "fun",
    name: "楽しかったこと",
    emoji: "❤️",
    description: "時間を忘れて没頭したこと",
    order: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    isDefault: true,
  },
  {
    id: "strength",
    name: "強み",
    emoji: "💪",
    description: "自分が得意なこと・人より上手なこと",
    order: 2,
    createdAt: "2024-01-01T00:00:00.000Z",
    isDefault: true,
  },
  {
    id: "dream",
    name: "夢",
    emoji: "🌈",
    description: "将来やりたいこと・なりたい自分",
    order: 3,
    createdAt: "2024-01-01T00:00:00.000Z",
    isDefault: true,
  },
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
