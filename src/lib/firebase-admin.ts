import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

let app: admin.app.App | null = null;

function loadKeyFromPath(keyPath: string): admin.ServiceAccount {
  const resolved = path.isAbsolute(keyPath)
    ? keyPath
    : path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `サービスアカウントのファイルが見つかりません: ${resolved}（FIREBASE_SERVICE_ACCOUNT_KEY_PATH を確認してください）`
    );
  }
  const raw = fs.readFileSync(resolved, "utf8");
  try {
    return JSON.parse(raw) as admin.ServiceAccount;
  } catch (e) {
    throw new Error(`サービスアカウント JSON の形式が不正です: ${resolved}`);
  }
}

/**
 * サーバー側で Firestore にアクセスするため。
 * 次のいずれかを設定してください:
 * - FIREBASE_SERVICE_ACCOUNT_KEY_PATH … ダウンロードした JSON ファイルのパス（推奨・簡単）
 * - FIREBASE_SERVICE_ACCOUNT_JSON … JSON を 1 行にした文字列
 * - GOOGLE_APPLICATION_CREDENTIALS … 鍵ファイルのパス
 */
export function getAdminStorage(): admin.storage.Storage {
  // getAdminDb() でアプリを初期化してから Storage を返す
  getAdminDb();
  return admin.storage();
}

export function getAdminDb(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.app().firestore();
  }
  if (!app) {
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    if (keyPath && typeof keyPath === "string") {
      const key = loadKeyFromPath(keyPath.trim());
      app = admin.initializeApp({ credential: admin.credential.cert(key), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
    } else {
      const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (json && typeof json === "string") {
        try {
          const key = JSON.parse(json) as admin.ServiceAccount;
          app = admin.initializeApp({ credential: admin.credential.cert(key), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET });
        } catch (e) {
          console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON のパースに失敗:", e);
          throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON が不正です");
        }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        app = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
      } else {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_KEY_PATH または FIREBASE_SERVICE_ACCOUNT_JSON を .env.local に設定してください"
        );
      }
    }
  }
  return app.firestore();
}

export function getAdminConfigDebug(): {
  configured: boolean;
  reason: string;
  resolvedPath?: string;
  cwd: string;
} {
  const cwd = process.cwd();
  if (
    typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === "string" &&
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON.length > 0
  ) {
    return { configured: true, reason: "FIREBASE_SERVICE_ACCOUNT_JSON", cwd };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { configured: true, reason: "GOOGLE_APPLICATION_CREDENTIALS", cwd };
  }
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath || typeof keyPath !== "string") {
    return { configured: false, reason: "FIREBASE_SERVICE_ACCOUNT_KEY_PATH が未設定", cwd };
  }
  const resolved = path.isAbsolute(keyPath.trim())
    ? keyPath.trim()
    : path.resolve(cwd, keyPath.trim());
  const exists = fs.existsSync(resolved);
  return {
    configured: exists,
    reason: exists ? "KEY_PATH" : "ファイルが存在しません",
    resolvedPath: resolved,
    cwd,
  };
}

export function hasAdminConfig(): boolean {
  return getAdminConfigDebug().configured;
}
