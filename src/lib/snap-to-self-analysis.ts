import { getDb } from "@/lib/firebase";
import { getFoldersFromFirestore, saveSelfAnalysisToFirestore } from "@/lib/self-analysis-firestore";
import { SELF_ANALYSIS_SECTIONS } from "@/lib/self-analysis-sections";

/**
 * Snap1件を自己分析シートの最適なフォルダに自動追加する（バックグラウンド処理）
 * エラーは無視してサイレントに失敗する
 */
export async function addSnapToSelfAnalysis(
  userId: string,
  snapText: string
): Promise<void> {
  try {
    const db = getDb();

    // デフォルトセクション + ユーザー作成フォルダを結合
    const firestoreFolders = await getFoldersFromFirestore(db, userId);
    const allFolders = [
      ...SELF_ANALYSIS_SECTIONS.map((s) => ({
        id: s.id,
        name: s.title,
        description: s.subtitle,
      })),
      ...firestoreFolders.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
      })),
    ];

    if (allFolders.length === 0) return;

    const res = await fetch("/api/snap-to-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapContent: snapText, folders: allFolders }),
    });

    if (!res.ok) return;
    const { folderId } = (await res.json()) as { folderId: string | null };

    if (folderId) {
      await saveSelfAnalysisToFirestore(db, userId, folderId, snapText);
    }
  } catch {
    // 自己分析への追加はノンクリティカルなのでサイレント失敗
  }
}
