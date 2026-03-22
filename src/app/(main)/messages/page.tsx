"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/journal";
import { Loader2, MessageSquare } from "lucide-react";

type Conversation = {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage: string;
  lastMessageAt: string;
};

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getDb();
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Conversation[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            participants: (data.participants as string[]) ?? [],
            participantNames: (data.participantNames as Record<string, string>) ?? {},
            lastMessage: String(data.lastMessage ?? ""),
            lastMessageAt: toIso(data.lastMessageAt),
          };
        });
        setConversations(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user?.uid]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <h1 className="text-base font-semibold sm:text-lg">メッセージ</h1>
      </header>

      <main className="flex flex-1 flex-col overflow-auto bg-gray-50 dark:bg-slate-950/60">
        <div className="mx-auto w-full max-w-2xl px-0 py-4 sm:px-0">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && conversations.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <MessageSquare className="size-10 opacity-30" />
              <p className="text-sm">まだメッセージがありません</p>
              <p className="text-xs">フィードでユーザーのプロフィールを開いてDMを送りましょう</p>
            </div>
          )}

          {conversations.map((conv) => {
            const otherId = conv.participants.find((p) => p !== user?.uid) ?? "";
            const otherName = conv.participantNames[otherId] ?? "ユーザー";
            const initial = otherName.charAt(0).toUpperCase();

            return (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className="flex items-center gap-3 border-b border-border bg-background px-4 py-4 transition-colors hover:bg-muted/50 sm:px-6"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {otherName}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDate(conv.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {conv.lastMessage || "メッセージを開始しましょう"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
