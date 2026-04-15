"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { JournalRichEditor } from "@/components/journal-rich-editor";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";

type FirestoreEntry = {
  id: string;
  title: string;
  content: string;
  isPublic: boolean;
  userId: string;
};

export default function JournalEditPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const id = String(params.id ?? "");

  const [entry, setEntry] = useState<FirestoreEntry | null | undefined>(
    undefined
  );
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Firestoreからジャーナルを読み込む
  useEffect(() => {
    if (!id) {
      setEntry(null);
      return;
    }
    let cancelled = false;
    getDoc(doc(getDb(), "journals", id))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setEntry(null);
          return;
        }
        const data = snap.data();
        const e: FirestoreEntry = {
          id: snap.id,
          title: typeof data.title === "string" ? data.title : "",
          content: typeof data.content === "string" ? data.content : "",
          isPublic: data.isPublic === true,
          userId: typeof data.userId === "string" ? data.userId : "",
        };
        setEntry(e);
        setTitle(e.title);
      })
      .catch(() => {
        if (!cancelled) setEntry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSave = async () => {
    if (!entry || !user?.uid || isSaving) return;
    if (entry.userId !== user.uid) return;

    const html = (editorRef.current?.getHTML() ?? "").trim();
    // TipTap が空の場合 "<p></p>" を返すため、空判定を行う
    const isEmpty =
      !html || html === "<p></p>" || html === "<p><br></p>";
    if (isEmpty && !title.trim()) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(getDb(), "journals", id), {
        title: title.trim(),
        content: isEmpty ? "" : html,
        updatedAt: Timestamp.now(),
      });
      toast.success("保存しました");
      router.push("/mypage");
    } catch (e) {
      console.error("[edit] save error:", e);
      toast.error("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const loading = authLoading || entry === undefined;
  const notFound = !loading && !entry;
  const isOwner = entry?.userId === user?.uid;

  // ---- ローディング ----
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            戻る
          </button>
          <h1 className="flex-1 text-center text-base font-semibold">
            ジャーナルを編集
          </h1>
          <span className="w-14" />
        </header>
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  // ---- 見つからない ----
  if (notFound) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <Link
            href="/mypage"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            My Page に戻る
          </Link>
          <h1 className="flex-1 text-center text-base font-semibold">
            ジャーナルを編集
          </h1>
          <span className="w-14" />
        </header>
        <main className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">
            指定されたジャーナルが見つかりませんでした。
          </p>
        </main>
      </div>
    );
  }

  // ---- 権限なし ----
  if (entry && !isOwner) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
          <Link
            href="/mypage"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            My Page に戻る
          </Link>
          <h1 className="flex-1 text-center text-base font-semibold">
            ジャーナルを編集
          </h1>
          <span className="w-14" />
        </header>
        <main className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">
            このジャーナルを編集する権限がありません。
          </p>
        </main>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="flex flex-1 flex-col">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <Link
          href="/mypage"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">My Page に戻る</span>
          <span className="sm:hidden">戻る</span>
        </Link>
        <h1 className="text-base font-semibold text-foreground">
          ジャーナルを編集
        </h1>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="shrink-0 gap-1.5"
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              保存中…
            </>
          ) : (
            <>
              <Save className="size-4" />
              保存
            </>
          )}
        </Button>
      </header>

      {/* エディタエリア */}
      <main className="flex flex-1 flex-col overflow-auto">
        <div className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-16 md:px-12 md:pt-14">
          {/* タイトル入力 */}
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "Enter") {
                e.preventDefault();
                editorRef.current?.commands.focus("start");
              }
            }}
            placeholder="タイトルを入力…"
            className={cn(
              "w-full resize-none border-none bg-transparent text-2xl font-bold leading-snug tracking-tight outline-none",
              "placeholder:text-slate-300 dark:placeholder:text-slate-700",
              "text-slate-900 dark:text-slate-100",
              "mb-6"
            )}
            disabled={isSaving}
          />

          {/* リッチエディタ */}
          <JournalRichEditor
            initialContent={entry.content}
            onEditorReady={(editor) => {
              editorRef.current = editor;
            }}
            onSave={handleSave}
            onFocusTitleRequested={() => titleInputRef.current?.focus()}
            placeholder="ここから編集できます…"
          />
        </div>
      </main>

      {/* 保存中オーバーレイ */}
      {isSaving && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 px-8 py-6 shadow-2xl dark:bg-slate-900/90">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              保存中…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
