import {
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "./firebase";

export type PermissionLevel = "all" | "followers" | "off";

/** Firestore に boolean で保存されている旧データも許容する */
export function toPermissionLevel(v: unknown): PermissionLevel {
  if (v === false || v === "off") return "off";
  if (v === "followers") return "followers";
  return "all";
}

export interface FirestoreUserProfile {
  displayName: string;
  university: string;
  grade: string;
  isProfileCompleted: boolean;
  graduationDate?: string;
  enrollmentDate?: string;
  birthDate?: string;
  isStudent?: boolean;
  avatarUrl?: string;
  commentsEnabled?: PermissionLevel;
  dmEnabled?: PermissionLevel;
  commentNotificationsEnabled?: PermissionLevel;
  dmNotificationsEnabled?: PermissionLevel;
}

const DEFAULT_GRADUATION = "2028-03-31";

export async function getUserProfile(
  db: Firestore,
  uid: string
): Promise<FirestoreUserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    displayName: String(d?.displayName ?? ""),
    university: String(d?.university ?? ""),
    grade: String(d?.grade ?? ""),
    isProfileCompleted: Boolean(d?.isProfileCompleted),
    graduationDate:
      typeof d?.graduationDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.graduationDate)
        ? d.graduationDate
        : undefined,
    enrollmentDate:
      typeof d?.enrollmentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.enrollmentDate)
        ? d.enrollmentDate
        : undefined,
    birthDate:
      typeof d?.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.birthDate)
        ? d.birthDate
        : undefined,
    isStudent: d?.isStudent !== undefined ? Boolean(d.isStudent) : true,
    avatarUrl: typeof d?.avatarUrl === "string" && d.avatarUrl ? d.avatarUrl : undefined,
    commentsEnabled: toPermissionLevel(d?.commentsEnabled),
    dmEnabled: toPermissionLevel(d?.dmEnabled),
    commentNotificationsEnabled: toPermissionLevel(d?.commentNotificationsEnabled),
    dmNotificationsEnabled: toPermissionLevel(d?.dmNotificationsEnabled),
  };
}

export async function saveUserProfile(
  db: Firestore,
  uid: string,
  data: {
    displayName: string;
    university: string;
    grade: string;
    isProfileCompleted: boolean;
    graduationDate?: string;
    enrollmentDate?: string;
    birthDate?: string;
    isStudent?: boolean;
    avatarUrl?: string;
    commentsEnabled?: PermissionLevel;
    dmEnabled?: PermissionLevel;
    commentNotificationsEnabled?: PermissionLevel;
    dmNotificationsEnabled?: PermissionLevel;
  }
): Promise<void> {
  const ref = doc(db, "users", uid);
  // undefined値をFirestoreに渡すとSDKがエラーになるため除外する
  const payload: Record<string, unknown> = Object.fromEntries(
    Object.entries({ ...data, updatedAt: new Date().toISOString() }).filter(
      ([, v]) => v !== undefined
    )
  );
  await setDoc(ref, payload, { merge: true });
}

export async function checkProfileCompleted(db: Firestore, uid: string): Promise<boolean> {
  const profile = await getUserProfile(db, uid);
  return profile?.isProfileCompleted ?? false;
}

export { DEFAULT_GRADUATION };
