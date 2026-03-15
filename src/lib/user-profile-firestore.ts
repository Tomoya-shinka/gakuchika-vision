import {
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { getDb } from "./firebase";

export interface FirestoreUserProfile {
  displayName: string;
  university: string;
  grade: string;
  isProfileCompleted: boolean;
  graduationDate?: string;
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
  }
): Promise<void> {
  const ref = doc(db, "users", uid);
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(ref, payload, { merge: true });
}

export async function checkProfileCompleted(db: Firestore, uid: string): Promise<boolean> {
  const profile = await getUserProfile(db, uid);
  return profile?.isProfileCompleted ?? false;
}

export { DEFAULT_GRADUATION };
