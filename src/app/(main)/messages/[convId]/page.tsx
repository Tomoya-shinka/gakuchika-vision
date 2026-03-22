"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from "@/lib/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Send } from "lucide-react";

type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  readBy: string[];
};

type ConvData = {
  participants: string[];
  participantNames: Record<string, string>;
};

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

export default function ChatPage() {
  const { convId } = useParams<{ convId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [convData, setConvData] = useState<ConvData | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 会話メタデータ取得
  useEffect(() => {
    const fetchConv = async () => {
      try {
        const db = getDb();
        const snap = await getDoc(doc(db, "conversations", convId));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          setConvData({
            participants: (data.participants as string[]) ?? [],
            participantNames: (data.participantNames as Record<string, string>) ?? {},
          });
        }
      } catch {
        // silent
      }
    };
    fetchConv();
  }, [convId]);

  // メッセージのリアルタイム購読
  useEffect(() => {
    if (!user?.uid) return;
    const db = getDb();
    const q = query(
      collection(db, "conversations", convId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Message[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            senderId: String(data.senderId ?? ""),
            text: String(data.text ?? ""),
            createdAt: toIso(data.createdAt),
            readBy: (data.readBy as string[]) ?? [],
          };
        });
        setMessages(list);
        setLoading(false);
        // 既読処理
        snap.docs.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const readBy = (data.readBy as string[]) ?? [];
          if (data.senderId !== user.uid && !readBy.includes(user.uid)) {
            updateDoc(doc(db, "conversations", convId, "messages", d.id), {
              readBy: arrayUnion(user.uid),
            }).catch(() => {});
          }
        });
      },
      () => setLoading(false)
    );
    return unsub;
  }, [convId, user?.uid]);

  // 新メッセージが届いたら最下部にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!user?.uid || !inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    try {
      const db = getDb();
      await addDoc(collection(db, "conversations", convId, "messages"), {
        senderId: user.uid,
        text,
        createdAt: Timestamp.now(),
        readBy: [user.uid],
      });
      await updateDoc(doc(db, "conversations", convId), {
        lastMessage: text,
        lastMessageAt: Timestamp.now(),
      });
    } catch {
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [user?.uid, convId, inputText, sending]);

  const otherId = convData?.participants.find((p) => p !== user?.uid) ?? "";
  const otherName = convData?.participantNames[otherId] ?? "ユーザー";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <button
          type="button"
          onClick={() => router.back()}
          className="mr-3 flex size-8 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
            {otherName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-base font-semibold sm:text-lg">{otherName}</h1>
        </div>
      </header>

      {/* メッセージ一覧 */}
      <main className="flex flex-1 flex-col overflow-auto bg-gray-50 px-4 py-4 dark:bg-slate-950/60 sm:px-6">
        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">最初のメッセージを送りましょう！</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div
                key={msg.id}
                className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words",
                    isMe
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  )}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(msg.createdAt)}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* 入力フォーム */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="メッセージを入力..."
            className="flex-1"
            disabled={sending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
