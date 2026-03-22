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
  query,
  where,
  limit,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { stripHtml, formatDate } from "@/lib/journal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, MessageSquare, UserCheck, UserPlus } from "lucide-react";

type ProfileData = {
  displayName: string;
  university: string;
  grade: string;
  enrollmentDate?: string;
  graduationDate?: string;
};

type JournalItem = {
  id: string;
  title?: string;
  content: string;
  createdAt: string;
  likes: string[];
  commentCount: number;
};

function buildGrade(grade: string): string {
  const normalized = grade.replace(/年生$/, "");
  return normalized ? `${normalized}年生` : "";
}

export default function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followDocId, setFollowDocId] = useState<string | null>(null);

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
          followersCount: number;
          followingCount: number;
        };
        setProfile(data.profile);
        setJournals(data.journals ?? []);
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
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        const ref = await addDoc(collection(db, "follows"), {
          followerId: user.uid,
          followedId: uid,
          createdAt: Timestamp.now(),
        });
        setIsFollowing(true);
        setFollowDocId(ref.id);
        setFollowersCount((c) => c + 1);
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
      // 既存の会話を探す
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
        // 相手の表示名を取得
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
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          {/* プロフィールヘッダー */}
          <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
            {/* アバター */}
            <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-slate-200 text-3xl font-bold text-slate-600 shadow-sm dark:bg-slate-700 dark:text-slate-200 sm:size-28">
              {initial}
            </div>

            {/* プロフィール情報 */}
            <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">{name}</h2>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}

              {/* 統計 */}
              <div className="flex gap-6 text-center sm:gap-8">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg font-bold text-foreground">{journals.length}</span>
                  <span className="text-xs text-muted-foreground">投稿</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg font-bold text-foreground">{followersCount}</span>
                  <span className="text-xs text-muted-foreground">フォロワー</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-lg font-bold text-foreground">{followingCount}</span>
                  <span className="text-xs text-muted-foreground">フォロー中</span>
                </div>
              </div>

              {/* アクションボタン */}
              {!isOwnProfile && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={isFollowing ? "outline" : "default"}
                    onClick={handleFollow}
                    disabled={followLoading}
                    className="gap-1.5"
                  >
                    {followLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isFollowing ? (
                      <UserCheck className="size-3.5" />
                    ) : (
                      <UserPlus className="size-3.5" />
                    )}
                    {isFollowing ? "フォロー中" : "フォロー"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDM}
                    className="gap-1.5"
                  >
                    <MessageSquare className="size-3.5" />
                    DM
                  </Button>
                </div>
              )}
              {isOwnProfile && (
                <Link href="/mypage">
                  <Button size="sm" variant="outline">
                    プロフィールを編集
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* 区切り */}
          <div className="mb-4 border-t border-border" />

          {/* 公開ジャーナル一覧 */}
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            公開ジャーナル（{journals.length}件）
          </h3>

          {journals.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ公開ジャーナルがありません。</p>
          ) : (
            <div className="flex flex-col gap-3">
              {journals.map((journal) => {
                const plain = stripHtml(journal.content);
                return (
                  <Card
                    key={journal.id}
                    className="border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <CardContent className="px-5 py-4">
                      {journal.title && (
                        <p className="mb-1.5 text-sm font-semibold text-foreground">
                          {journal.title}
                        </p>
                      )}
                      <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {plain}
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatDate(journal.createdAt)}</span>
                        <span>❤ {journal.likes.length}</span>
                        <span>💬 {journal.commentCount}</span>
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
