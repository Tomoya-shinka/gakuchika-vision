/**
 * サービスアカウント JSON から .env.local に追記する行を出力します。
 *
 * 使い方:
 *   1. Firebase Console → プロジェクトの設定 → サービスアカウント → 「新しい秘密鍵の生成」で JSON をダウンロード
 *   2. ターミナルで: node scripts/setup-service-account-env.js ダウンロードしたJSONのパス
 *   3. 表示された 1 行を .env.local の末尾にコピーして保存
 *   4. npm run dev を再起動
 */

const fs = require("fs");
const path = require("path");

// パスにスペースや括弧が含まれるとシェルで分割されるため、残りをすべて結合する
const jsonPath = process.argv.slice(2).join(" ").trim();
if (!jsonPath) {
  console.error("使い方: node scripts/setup-service-account-env.js <サービスアカウントJSONのパス>");
  console.error("例（PowerShell でパスにスペースや括弧がある場合はシングルクォート推奨）:");
  console.error("  node scripts/setup-service-account-env.js 'C:\\Users\\...\\vision-journaling-firebase-adminsdk.json'");
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), jsonPath);
if (!fs.existsSync(resolved)) {
  console.error("ファイルが見つかりません:", resolved);
  process.exit(1);
}

let raw;
try {
  raw = fs.readFileSync(resolved, "utf8");
} catch (e) {
  console.error("ファイルの読み込みに失敗しました:", e.message);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error("JSON のパースに失敗しました:", e.message);
  process.exit(1);
}

if (!parsed.type || !parsed.project_id) {
  console.error("サービスアカウント JSON の形式が正しくありません（type と project_id が必要です）");
  process.exit(1);
}

// 1 行にした JSON
const oneLine = JSON.stringify(parsed);
// .env の値はダブルクォートで囲み、中の " は \ でエスケープ
const value = oneLine.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const line = `FIREBASE_SERVICE_ACCOUNT_JSON="${value}"`;

console.log("");
console.log("以下を .env.local に追記してください（サーバー再起動後に有効になります）:");
console.log("");
console.log(line);
console.log("");
