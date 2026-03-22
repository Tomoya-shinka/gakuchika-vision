"use client";

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  doc,
  getDocs,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";

/**
 * 自分の投稿へのコメント未読通知を管理するフック。
 * - hasUnread: 未読コメント通知があるか
 * - markAllRead: すべての通知を既読にする
 */
export function useCommentNotifications() {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setHasUnread(false);
      return;
    }
    const db = getDb();
    const q = query(
      collection(db, "notifications"),
      where("toUserId", "==", user.uid),
      where("type", "==", "comment"),
      where("read", "==", false)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setHasUnread(!snap.empty),
      () => setHasUnread(false) // エラー時は非表示
    );
    return unsub;
  }, [user?.uid]);

  const markAllRead = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const db = getDb();
      const q = query(
        collection(db, "notifications"),
        where("toUserId", "==", user.uid),
        where("type", "==", "comment"),
        where("read", "==", false)
      );
      const snap = await getDocs(q);
      if (snap.empty) return;
      const batch = writeBatch(db);
      snap.docs.forEach((d) =>
        batch.update(doc(db, "notifications", d.id), { read: true })
      );
      await batch.commit();
    } catch {
      // 既読化失敗は非クリティカル
    }
  }, [user?.uid]);

  return { hasUnread, markAllRead };
}
