"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import {
  loadEntries,
  formatDate,
  getPreview,
  type JournalEntry,
} from "@/lib/journal";
import { ArrowLeft, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { calculateUnivDay } from "@/lib/university-life";

type FirestoreJournal = {
  id: string;
  userId: string;
  title?: string;
  content: string;
  createdAt: string;
  isPublic: boolean;
};

export default function MyPageRecords() {
  const { user } = useAuth();
  const [firestoreEntries, setFirestoreEntries] = useState<FirestoreJournal[]>([]);
  const [localEntries, setLocalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollmentDate, setEnrollmentDate] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setEnrollmentDate(null);
      return;
    }
    let cancelled = false;
    getDoc(doc(getDb(), "users", user.uid))
      .then((snap) => {
        if (cancelled) return;
        const d = snap.data() as Record<string, unknown> | undefined;
        const raw = typeof d?.enrollmentDate === "string" ? d.enrollmentDate : "";
        setEnrollmentDate(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null);
      })
      .catch(() => {
        if (!cancelled) setEnrollmentDate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const loadFirestoreJournals = useCallback(async () => {
    if (!user?.uid) {
      setFirestoreEntries([]);
      return;
    }
    try {
      const db = getDb();
      const q = query(
        collection(db, "journals"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const list: FirestoreJournal[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const createdAt = data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : String(data.createdAt ?? "");
        list.push({
          id: d.id,
          userId: String(data.userId ?? ""),
          title: data.title != null ? String(data.title) : undefined,
          content: String(data.content ?? ""),
          createdAt,
          isPublic: data.isPublic === true,
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFirestoreEntries(list);
    } catch (e) {
      console.error("[mypage/records] failed to load Firestore journals:", e);
      toast.error("記録の取得に失敗しました");
      setFirestoreEntries([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    setLocalEntries(loadEntries());
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadFirestoreJournals().then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.uid, loadFirestoreJournals]);

  const handleToggleVisibility = async (journal: FirestoreJournal) => {
    if (togglingId) return;
    const nextPublic = !journal.isPublic;
    setTogglingId(journal.id);
    const prev = [...firestoreEntries];
    setFirestoreEntries((prevList) =>
      prevList.map((e) =>
        e.id === journal.id ? { ...e, isPublic: nextPublic } : e
      )
    );
    try {
      const db = getDb();
      await updateDoc(doc(db, "journals", journal.id), { isPublic: nextPublic });
      toast.success(nextPublic ? "公開しました" : "非公開にしました");
    } catch (e) {
      console.error("[mypage/records] failed to toggle visibility:", e);
      toast.error("設定の更新に失敗しました");
      setFirestoreEntries(prev);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleDeleteCancel = () => {
    if (!isDeleting) setDeleteTargetId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    const target = firestoreEntries.find((e) => e.id === deleteTargetId);
    setIsDeleting(true);
    const prev = [...firestoreEntries];
    setFirestoreEntries((list) => list.filter((e) => e.id !== deleteTargetId));
    setDeleteTargetId(null);
    try {
      const db = getDb();
      await deleteDoc(doc(db, "journals", deleteTargetId));
      toast.success("削除しました");
    } catch (e) {
      console.error("[mypage/records] failed to delete journal:", e);
      toast.error("削除に失敗しました");
      if (target) setFirestoreEntries((list) => [...list, target].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } finally {
      setIsDeleting(false);
    }
  };

  const useFirestore = Boolean(user?.uid);
  const entries = useFirestore ? firestoreEntries : [];
  const localList = useFirestore ? [] : localEntries;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
        <Link
          href="/mypage"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          戻る
        </Link>
        <h1 className="flex-1 text-center text-lg font-semibold">
          ジャーナルの記録
        </h1>
        <span className="w-14" aria-hidden />
      </header>

      <main className="flex flex-1 overflow-auto bg-[#fafafa] px-4 py-6 dark:bg-slate-950/40 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="flex min-h-[52px] flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              これまで書いたジャーナルを振り返り、自己分析やガクチカ作成に活かしましょう。
            </p>
            {useFirestore && enrollmentDate == null && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                入学年月日を設定すると、各記録に「大学生活 ○日目」が表示されます（My Page のプロフィール編集から設定できます）。
              </p>
            )}
          </div>

          <section>
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
              保存された記録（新しい順）
            </h2>

            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-16 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">読み込み中…</p>
              </div>
            ) : useFirestore && entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-16 text-center shadow-sm">
                <BookOpen className="mb-4 size-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  まだ記録がありません
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ジャーナルページで書いた記録がここに表示されます
                </p>
                <Link
                  href="/journal"
                  className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  ジャーナルを書く →
                </Link>
              </div>
            ) : useFirestore ? (
              <ul className="flex flex-col gap-4">
                {entries.map((entry) => {
                  const preview = getPreview(entry.content, 60);
                  const badgeLabel = entry.isPublic ? "公開" : "非公開";
                  const badgeEmoji = entry.isPublic ? "🌏" : "🔒";
                  const isToggling = togglingId === entry.id;
                  const univDay =
                    enrollmentDate != null
                      ? calculateUnivDay(new Date(entry.createdAt), enrollmentDate)
                      : null;

                  return (
                    <li key={entry.id}>
                      <div className="flex items-stretch gap-2 rounded-2xl border border-border bg-white shadow-sm transition-shadow dark:bg-slate-900/80">
                        <Link
                          href={`/journal/${entry.id}`}
                          className="min-w-0 flex-1 px-5 py-4 transition-transform hover:-translate-y-0.5 sm:py-4"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                                {entry.title?.trim() || preview}
                              </p>
                              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatDate(entry.createdAt)}</span>
                                {typeof univDay === "number" && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                    大学生活 {univDay}日目
                                  </span>
                                )}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                              {preview}
                            </p>
                          </div>
                        </Link>
                        <div className="flex shrink-0 items-center gap-1 border-l border-border pr-2 sm:gap-2 sm:pr-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleToggleVisibility(entry);
                            }}
                            disabled={isToggling}
                            className={cn(
                              "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                              entry.isPublic
                                ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                            )}
                            aria-label={entry.isPublic ? "非公開に切り替え" : "公開に切り替え"}
                            title={entry.isPublic ? "非公開にする" : "公開する"}
                          >
                            <span className="px-2 py-1 text-[10px] font-medium sm:text-xs">
                              <span className="mr-1" aria-hidden>{badgeEmoji}</span>
                              {isToggling ? "…" : badgeLabel}
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteClick(entry.id);
                            }}
                            aria-label="削除"
                          >
                            <Trash2 className="size-5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="flex flex-col gap-4">
                {localList.map((entry) => {
                  const preview = getPreview(entry.content, 60);
                  const visibility =
                    entry.visibility === "public" ? "public" : "private";
                  const badgeLabel =
                    visibility === "public" ? "公開" : "非公開";
                  const badgeEmoji =
                    visibility === "public" ? "🌏" : "🔒";

                  return (
                    <li key={entry.id}>
                      <Link
                        href={`/journal/${entry.id}`}
                        className="block rounded-2xl border border-border bg-white px-5 py-4 shadow-sm transition-transform transition-shadow hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                                {entry.title || preview}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(entry.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                              {preview}
                            </p>
                          </div>
                          <span
                            className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            aria-label={`この記録は${badgeLabel}です`}
                          >
                            <span className="mr-1" aria-hidden>
                              {badgeEmoji}
                            </span>
                            {badgeLabel}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {!useFirestore && localList.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background py-16 text-center shadow-sm">
                <BookOpen className="mb-4 size-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  まだ記録がありません
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  ジャーナルページで書き溜めた記録がここに表示されます
                </p>
                <Link
                  href="/journal"
                  className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  ジャーナルを書く →
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              公開中の投稿も削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "削除中…" : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
