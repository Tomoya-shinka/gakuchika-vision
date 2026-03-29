"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { stripHtml, formatDate } from "@/lib/journal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Heart,
  Loader2,
  MessageCircle,
  MessageSquare,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

const COMMENTS_PREVIEW = 3;

type ProfileData = {
  displayName: string;
  university: string;
  grade: string;
  enrollmentDate?: string;
  graduationDate?: string;
  avatarUrl?: string;
};

type JournalItem = {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  likes: string[];
  commentCount: number;
};

type Comment = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
};

function buildGrade(grade: string): string {
  const normalized = grade.replace(/年生$/, "");
  return normalized ? `${normalized}年生` : "";
}

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === "string") return val;
  if (typeof val === "object" && "seconds" in (val as object)) {
    return new Date((val as { seconds: number }).seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

export default function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [totalJournalCount, setTotalJournalCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followDocId, setFollowDocId] = useState<string | null>(null);

  // コメント関連
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [showAllCommentsId, setShowAllCommentsId] = useState<string | null>(null);
  // いいね関連
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());

  const isOwnProfile = user?.uid === uid;

  // プロフィールデータ取得（API経由）
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${uid}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as {
          profile: ProfileData | null;
          journals: JournalItem[];
          totalJournalCount: number;
          streakDays: number;
          followersCount: number;
          followingCount: number;
        };
        setProfile(data.profile);
        setJournals(data.journals ?? []);
        setTotalJournalCount(data.totalJournalCount ?? 0);
        setStreakDays(data.streakDays ?? 0);
        setFollowersCount(data.followersCount ?? 0);
        setFollowingCount(data.followingCount ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // フォロー状態確認
  const checkFollowing = useCallback(async () => {
    if (!user?.uid || isOwnProfile) return;
    try {
      const db = getDb();
      const q = query(
        collection(db, "follows"),
        where("followerId", "==", user.uid),
        where("followedId", "==", uid),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setIsFollowing(true);
        setFollowDocId(snap.docs[0].id);
      } else {
        setIsFollowing(false);
        setFollowDocId(null);
      }
    } catch {
      // silent
    }
  }, [user?.uid, uid, isOwnProfile]);

  useEffect(() => {
    loadProfile();
    checkFollowing();
  }, [loadProfile, checkFollowing]);

  // フォロー/アンフォロー
  const handleFollow = async () => {
    if (!user?.uid || followLoading) return;
    setFollowLoading(true);
    try {
      const db = getDb();
      if (isFollowing && followDocId) {
        await deleteDoc(doc(db, "follows", followDocId));
        setIsFollowing(false);
        setFollowDocId(null);
      } else {
        const ref = await addDoc(collection(db, "follows"), {
          followerId: user.uid,
          followedId: uid,
          createdAt: Timestamp.now(),
        });
        setIsFollowing(true);
        setFollowDocId(ref.id);
      }
    } catch {
      // silent
    } finally {
      setFollowLoading(false);
    }
  };

  // DM開始
  const handleDM = async () => {
    if (!user?.uid) return;
    try {
      const db = getDb();
      const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", user.uid),
        limit(20)
      );
      const snap = await getDocs(q);
      const existing = snap.docs.find((d) => {
        const participants = d.data().participants as string[];
        return participants.includes(uid);
      });

      if (existing) {
        router.push(`/messages/${existing.id}`);
      } else {
        const targetProfile = profile;
        const myProfileSnap = await getDoc(doc(db, "users", user.uid));
        const myData = myProfileSnap.data() as Record<string, unknown> | undefined;
        const myName = String(myData?.displayName ?? user.email ?? "ユーザー");

        const convRef = await addDoc(collection(db, "conversations"), {
          participants: [user.uid, uid],
          participantNames: {
            [user.uid]: myName,
            [uid]: targetProfile?.displayName ?? "ユーザー",
          },
          lastMessage: "",
          lastMessageAt: Timestamp.now(),
          createdAt: Timestamp.now(),
        });
        router.push(`/messages/${convRef.id}`);
      }
    } catch {
      // silent
    }
  };

  // コメント取得
  const loadComments = useCallback(async (journalId: string) => {
    try {
      const db = getDb();
      const commentsRef = collection(db, "journals", journalId, "comments");
      const snap = await getDocs(
        query(commentsRef, orderBy("createdAt", "desc"), limit(50))
      );
      const list: Comment[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userId: String(data.userId ?? ""),
          userName: String(data.userName ?? "ユーザー"),
          text: String(data.text ?? ""),
          createdAt: toIso(data.createdAt),
        };
      });
      setComments((prev) => ({ ...prev, [journalId]: list }));
    } catch {
      // silent
    }
  }, []);

  // コメントボタンクリック
  const handleCommentClick = (journalId: string) => {
    if (expandedCommentId === journalId) {
      setExpandedCommentId(null);
      return;
    }
    setExpandedCommentId(journalId);
    if (!comments[journalId]) loadComments(journalId);
  };

  // いいね
  const handleLike = async (journalId: string) => {
    if (!user?.uid) return;
    const item = journals.find((j) => j.id === journalId);
    if (!item) return;
    setLikingIds((prev) => new Set(prev).add(journalId));
    const isLiked = item.likes.includes(user.uid);
    const nextLikes = isLiked
      ? item.likes.filter((id) => id !== user.uid)
      : [...item.likes, user.uid];
    setJournals((prev) =>
      prev.map((j) => (j.id === journalId ? { ...j, likes: nextLikes } : j))
    );
    try {
      const db = getDb();
      const ref = doc(db, "journals", journalId);
      if (isLiked) {
        await updateDoc(ref, { likes: arrayRemove(user.uid) });
      } else {
        await updateDoc(ref, { likes: arrayUnion(user.uid) });
      }
    } catch {
      // ロールバック
      setJournals((prev) =>
        prev.map((j) => (j.id === journalId ? { ...j, likes: item.likes } : j))
      );
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(journalId);
        return next;
      });
    }
  };

  if (loading) {
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
          <h1 className="text-base font-semibold sm:text-lg">プロフィール</h1>
        </header>
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  const name = profile?.displayName ?? "ユーザー";
  const initial = name.charAt(0).toUpperCase();
  const subtitle = [profile?.university, profile?.grade ? buildGrade(profile.grade) : ""]
    .filter(Boolean)
    .join(" ・ ");

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
        <h1 className="text-base font-semibold sm:text-lg">{name}</h1>
      </header>

      <main className="flex flex-1 flex-col overflow-auto bg-gray-50 dark:bg-slate-950/60">
        <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 sm:pt-8">
          {/* プロフィールヘッダー */}
          <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-8">
            {/* アバター */}
            <Avatar className="size-24 shrink-0 shadow-lg ring-4 ring-white dark:ring-slate-900 sm:size-28">
              <AvatarImage src={profile?.avatarUrl} alt={name} />
              <AvatarFallback className="bg-sky-100 text-3xl font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                {initial}
              </AvatarFallback>
            </Avatar>

            {/* プロフィール情報 */}
            <div className="flex flex-1 flex-col items-center gap-3 pb-1 sm:items-start">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">{name}</h2>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}

              {/* 統計 */}
              <div className="flex items-end gap-6 sm:gap-8">
                <div className="flex flex-col items-center gap-0.5 text-center">
                  <span className="text-lg font-bold text-primary">{totalJournalCount}</span>
                  <span className="text-xs text-muted-foreground">総ジャーナル数</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-center">
                  <span className="text-lg font-bold text-primary">{streakDays}</span>
                  <span className="text-xs text-muted-foreground">継続日数</span>
                </div>
                <div className="mb-0.5 flex gap-3 text-[11px] text-muted-foreground">
                  <span><span className="font-semibold text-foreground">{followersCount}</span> フォロワー</span>
                  <span><span className="font-semibold text-foreground">{followingCount}</span> フォロー中</span>
                </div>
              </div>

              {/* アクションボタン */}
              {!isOwnProfile && (
                <div className="flex gap-2">
                  <Button size="sm" variant={isFollowing ? "outline" : "default"} onClick={handleFollow} disabled={followLoading} className="gap-1.5">
                    {followLoading ? <Loader2 className="size-3.5 animate-spin" /> : isFollowing ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                    {isFollowing ? "フォロー中" : "フォロー"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDM} className="gap-1.5">
                    <MessageSquare className="size-3.5" />DM
                  </Button>
                </div>
              )}
              {isOwnProfile && (
                <Link href="/mypage">
                  <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/5">
                    プロフィールを編集
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* 公開ジャーナルセクション見出し */}
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-2">
            <div className="h-4 w-1 rounded-full bg-primary" />
            <h3 className="text-sm font-semibold text-foreground">公開ジャーナル</h3>
            <span className="ml-auto text-xs text-muted-foreground">{journals.length}件</span>
          </div>

          {journals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">まだ公開ジャーナルがありません。</p>
          ) : (
            <div className="flex flex-col gap-3 pb-8">
              {journals.map((journal) => {
                const plain = stripHtml(journal.content);
                const isLiked = journal.likes.includes(user?.uid ?? "");
                const isExpanded = expandedCommentId === journal.id;
                const journalComments = comments[journal.id];

                return (
                  <Card
                    key={journal.id}
                    className="border-l-[3px] border-l-primary/60 bg-white shadow-sm dark:bg-slate-900"
                  >
                    <CardContent className="px-5 py-4">
                      {/* タイトル + 日時 */}
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {journal.title || formatDate(journal.createdAt)}
                        </p>
                        {journal.title && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDate(journal.createdAt)}
                          </span>
                        )}
                      </div>

                      {/* 本文 */}
                      <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {plain}
                      </p>

                      {/* いいね・コメントボタン */}
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        {/* いいね */}
                        <button
                          type="button"
                          onClick={() => handleLike(journal.id)}
                          disabled={!user || likingIds.has(journal.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1 py-1 transition-colors hover:text-rose-500 disabled:opacity-50",
                            isLiked ? "text-rose-500" : ""
                          )}
                          aria-label={isLiked ? "いいねを解除" : "いいね"}
                        >
                          <Heart
                            className={cn("size-3.5", isLiked && "fill-rose-500")}
                            aria-hidden
                          />
                          {journal.likes.length}
                        </button>

                        {/* コメント */}
                        <button
                          type="button"
                          onClick={() => handleCommentClick(journal.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1 py-1 hover:text-sky-500",
                            isExpanded && "text-sky-500"
                          )}
                          aria-label="コメント"
                        >
                          <MessageCircle className="size-3.5" aria-hidden />
                          {journalComments !== undefined
                            ? journalComments.length
                            : (journal.commentCount ?? 0)}
                        </button>
                      </div>

                      {/* コメント展開エリア（スムーズドロップアニメーション） */}
                      <div
                        className={cn(
                          "grid transition-all duration-300 ease-in-out",
                          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                            {journalComments === undefined ? (
                              <div className="flex justify-center py-2">
                                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                              </div>
                            ) : journalComments.length === 0 ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                まだコメントがありません
                              </p>
                            ) : (
                              (showAllCommentsId === journal.id
                                ? journalComments
                                : journalComments.slice(0, COMMENTS_PREVIEW)
                              ).map((c) => (
                                <div
                                  key={c.id}
                                  className="flex gap-2.5 rounded-md bg-slate-50 px-3 py-2.5 text-xs dark:bg-slate-800/60"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {c.userName}
                                      </span>
                                      <span className="text-slate-400 dark:text-slate-500">
                                        {formatDistanceToNow(new Date(c.createdAt), {
                                          locale: ja,
                                          addSuffix: true,
                                        })}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                                      {c.text}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}

                            {/* すべて見るボタン */}
                            {journalComments &&
                              journalComments.length > COMMENTS_PREVIEW &&
                              showAllCommentsId !== journal.id && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllCommentsId(journal.id)}
                                  className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                                >
                                  すべて見る（{journalComments.length}件）
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
