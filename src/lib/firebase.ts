import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const rawProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  // 本番で authDomain 未設定でも projectId から補完できるようにする
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    (rawProjectId ? `${rawProjectId}.firebaseapp.com` : ""),
  projectId: rawProjectId ?? "",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (rawProjectId ? `${rawProjectId}.appspot.com` : ""),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

const requiredConfig: Array<{ key: string; value: string }> = [
  { key: "NEXT_PUBLIC_FIREBASE_API_KEY", value: firebaseConfig.apiKey },
  { key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", value: firebaseConfig.projectId },
  { key: "NEXT_PUBLIC_FIREBASE_APP_ID", value: firebaseConfig.appId },
  { key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", value: firebaseConfig.authDomain },
];

function getMissingFirebaseConfigKeys(): string[] {
  return requiredConfig
    .filter((item) => typeof item.value !== "string" || item.value.trim().length === 0)
    .map((item) => item.key);
}

/** ビルド時（Vercel 等で env 未設定）に Firebase を初期化しないために使用 */
export const hasValidFirebaseConfig =
  getMissingFirebaseConfigKeys().length === 0;

export function getFirebaseConfigErrorMessage(): string | null {
  const missing = getMissingFirebaseConfigKeys();
  if (missing.length === 0) return null;
  return `Firebase設定が不足しています: ${missing.join(", ")}`;
}

let app: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  if (!hasValidFirebaseConfig) {
    const detail = getFirebaseConfigErrorMessage();
    throw new Error(
      detail ?? "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars."
    );
  }
  const existing = getApps();
  if (existing.length > 0) {
    app = getApp() as FirebaseApp;
    return app;
  }
  app = initializeApp(firebaseConfig);
  return app;
}

export function getAuthInstance() {
  if (!hasValidFirebaseConfig) {
    const detail = getFirebaseConfigErrorMessage();
    throw new Error(
      detail ?? "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars."
    );
  }
  return getAuth(getFirebaseApp());
}

export const getDb = () => getFirestore(getFirebaseApp());
export const getStorageInstance = () => getStorage(getFirebaseApp());