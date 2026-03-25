# データベース設計ドキュメント（Firestore）

> 最終更新: 2026-03-23

---

## 1. Firebase 初期化

| 項目 | 内容 |
|------|------|
| 使用サービス | Firestore、Firebase Auth |
| 初期化ファイル | `src/lib/firebase.ts` |
| 設定方法 | 環境変数 `NEXT_PUBLIC_FIREBASE_*` |

### 必要な環境変数（`.env.local`）

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## 2. コレクション一覧

### 2.1 `users/{userId}`

ユーザーのプロフィール情報。ドキュメントIDはFirebase AuthのUID。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| displayName | string | ○ | 表示名 |
| university | string | ○ | 大学名 |
| grade | string | ○ | 学年（数字のみ保存。例: `"3"`。表示時に「年生」を付加） |
| isProfileCompleted | boolean | ○ | プロフィール入力完了フラグ |
| enrollmentDate | string | △ | 入学日（`YYYY-MM-DD`形式）。大学生活日数の計算に使用 |
| graduationDate | string | △ | 卒業予定日（`YYYY-MM-DD`形式）。デフォルト: `2028-03-31` |
| updatedAt | string | △ | 最終更新日時（ISO 8601形式） |

**アクセス制御:** 本人のみ読み書き可（サーバーAPIを経由すれば間接的に他者が参照可能）

**関連ファイル:**
- `src/lib/user-profile-firestore.ts` — 保存・取得ロジック
- `src/app/(main)/mypage/page.tsx` — マイページ表示
- `src/app/api/profile/[uid]/route.ts` — 他ユーザーのプロフィール取得API

---

### 2.2 `journals/{journalId}`

ジャーナル（日記）の本体。公開フラグ付き。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| userId | string | ○ | 投稿者のUID |
| title | string | △ | タイトル（任意） |
| content | string | ○ | 本文（TipTapが生成するHTML形式） |
| createdAt | Timestamp | ○ | 作成日時 |
| isPublic | boolean | ○ | 公開フラグ（`true` = フィードに表示） |
| visibility | string | ○ | `"public"` \| `"private"`（`isPublic`と常に同期） |
| likes | string[] | ○ | いいねしたユーザーのUID配列（初期値: `[]`） |

> **注意:** `isPublic`と`visibility`は冗長だが整合性のため両方保持。書き込み時は必ず同期させること。

**アクセス制御:**
- 読み取り: 現在は全員可（デバッグ設定。本番では `isPublic == true` または本人のみに変更予定）
- 作成: 認証済みユーザーのみ（自分のUIDで）
- 更新: 本人（全フィールド）または認証済みユーザー（`likes`フィールドのみ）
- 削除: 本人のみ

**関連ファイル:**
- `src/app/(main)/journal/page.tsx` — 作成・編集
- `src/app/(main)/mypage/records/page.tsx` — 一覧・削除・公開切替
- `src/app/api/feed/journals/route.ts` — 公開ジャーナル取得API

---

### 2.3 `journals/{journalId}/comments/{commentId}`

`journals`のサブコレクション。各投稿へのコメント。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| userId | string | ○ | コメント投稿者のUID |
| userName | string | ○ | 投稿者の表示名（非正規化キャッシュ） |
| text | string | ○ | コメント本文 |
| createdAt | Timestamp | ○ | 投稿日時 |

**アクセス制御:**
- 読み取り: 認証済みユーザーのみ
- 作成: 認証済みユーザー（自分のUIDで）
- 更新・削除: 本人のみ

**関連ファイル:**
- `src/app/(main)/feed/page.tsx` — コメント表示・投稿

---

### 2.4 `notifications/{notifId}`

コメント通知。いいねは通知対象外。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| toUserId | string | ○ | 通知受信者のUID（ジャーナル投稿者） |
| fromUserId | string | ○ | 通知送信者のUID（コメントしたユーザー） |
| journalId | string | ○ | 対象のジャーナルID |
| type | string | ○ | 通知種別。現在は `"comment"` のみ |
| read | boolean | ○ | 既読フラグ（初期値: `false`） |
| createdAt | Timestamp | ○ | 作成日時 |

**アクセス制御:**
- 読み取り・更新: 受信者（`toUserId`）本人のみ
- 作成: 認証済みユーザー（自分の`fromUserId`で）
- 削除: 不可

**関連ファイル:**
- `src/app/(main)/feed/page.tsx` — コメント投稿時に通知を作成
- `src/hooks/useCommentNotifications.ts` — 未読数監視・既読更新
- `src/components/app-sidebar.tsx`, `src/components/MobileNav.tsx` — バッジ表示

---

### 2.5 `follows/{followId}`

フォロー関係。1レコード = 1フォロー。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| followerId | string | ○ | フォローした側のUID |
| followedId | string | ○ | フォローされた側のUID |
| createdAt | Timestamp | ○ | フォロー日時 |

**よく使うクエリ:**
```ts
// このユーザーがフォローしている人の一覧
query(collection(db, "follows"), where("followerId", "==", uid))

// このユーザーをフォローしている人の一覧
query(collection(db, "follows"), where("followedId", "==", uid))

// フォロー状態の確認
query(collection(db, "follows"),
  where("followerId", "==", currentUid),
  where("followedId", "==", targetUid))
```

**アクセス制御:**
- 読み取り: 認証済みユーザーすべて
- 作成: 自分が`followerId`のレコードのみ
- 削除: 自分が`followerId`のレコードのみ

**関連ファイル:**
- `src/app/(main)/profile/[uid]/page.tsx` — フォロー/アンフォロー操作
- `src/app/api/profile/[uid]/route.ts` — フォロワー数・フォロー中数の集計

---

### 2.6 `conversations/{convId}`

DM（ダイレクトメッセージ）の会話ルート。現在は1対1のみ対応。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| participants | string[] | ○ | 参加者のUID配列（2人） |
| participantNames | Record\<string, string\> | ○ | `{ [uid]: displayName }` の表示名キャッシュ |
| lastMessage | string | △ | 最後のメッセージ本文 |
| lastMessageAt | Timestamp | △ | 最後のメッセージ日時（会話一覧のソートに使用） |

**アクセス制御:**
- 読み取り・更新: `participants`に含まれるユーザーのみ
- 作成: 自分が`participants`に含まれる場合のみ

**関連ファイル:**
- `src/app/(main)/messages/page.tsx` — 会話一覧
- `src/app/(main)/profile/[uid]/page.tsx` — DM開始（既存会話検索 or 新規作成）

---

### 2.7 `conversations/{convId}/messages/{msgId}`

`conversations`のサブコレクション。個々のDMメッセージ。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| senderId | string | ○ | 送信者のUID |
| text | string | ○ | メッセージ本文 |
| createdAt | Timestamp | ○ | 送信日時 |
| readBy | string[] | ○ | 既読したユーザーのUID配列（初期値: `[senderId]`） |

**アクセス制御:**
- 読み取り・作成・更新: 親会話の`participants`に含まれるユーザーのみ

**関連ファイル:**
- `src/app/(main)/messages/[convId]/page.tsx` — メッセージ送受信・既読管理

---

### 2.8 `users/{userId}/self_analysis/{itemId}`

`users`のサブコレクション。自己分析シートの各エントリ。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| sectionId | string | ○ | カテゴリID（下記参照） |
| content | string | ○ | テキスト内容 |
| createdAt | Timestamp | ○ | 作成日時 |

**sectionId の値:**

| sectionId | 画面上の表示 |
|---|---|
| `"small-wins"` | 成功体験・小さな達成 |
| `"fun"` | 楽しかったこと |
| `"strength"` | 強み |
| `"dream"` | 夢・将来の目標 |

**アクセス制御:** 本人のみ読み書き可（親の`users/{userId}`ルールを継承）

**関連ファイル:**
- `src/lib/self-analysis-firestore.ts` — 保存・取得ロジック
- `src/app/(main)/self-analysis/page.tsx` — 自己分析シート画面

---

## 3. TypeScript 型定義

```typescript
import { Timestamp } from "firebase/firestore";

/** users/{userId} */
interface FirestoreUserProfile {
  displayName: string;
  university: string;
  grade: string;                // 数字のみ。例: "3"
  isProfileCompleted: boolean;
  enrollmentDate?: string;      // YYYY-MM-DD
  graduationDate?: string;      // YYYY-MM-DD
  updatedAt?: string;           // ISO 8601
}

/** journals/{journalId} */
interface FirestoreJournal {
  userId: string;
  title?: string;
  content: string;              // HTML
  createdAt: Timestamp;
  isPublic: boolean;
  visibility: "public" | "private";
  likes: string[];              // UID配列
}

/** journals/{journalId}/comments/{commentId} */
interface FirestoreComment {
  userId: string;
  userName: string;
  text: string;
  createdAt: Timestamp;
}

/** notifications/{notifId} */
interface FirestoreNotification {
  toUserId: string;
  fromUserId: string;
  journalId: string;
  type: "comment";
  read: boolean;
  createdAt: Timestamp;
}

/** follows/{followId} */
interface FirestoreFollow {
  followerId: string;
  followedId: string;
  createdAt: Timestamp;
}

/** conversations/{convId} */
interface FirestoreConversation {
  participants: [string, string];
  participantNames: Record<string, string>;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
}

/** conversations/{convId}/messages/{msgId} */
interface FirestoreMessage {
  senderId: string;
  text: string;
  createdAt: Timestamp;
  readBy: string[];
}

/** users/{userId}/self_analysis/{itemId} */
interface FirestoreSelfAnalysisItem {
  sectionId: "small-wins" | "fun" | "strength" | "dream";
  content: string;
  createdAt: Timestamp;
}
```

---

## 4. Firestore セキュリティルール サマリー

ファイル: `firestore.rules`

| コレクション | read | create | update | delete |
|---|---|---|---|---|
| `users/{userId}` | 本人のみ | 本人のみ | 本人のみ | 本人のみ |
| `users/{userId}/**` | 本人のみ | 本人のみ | 本人のみ | 本人のみ |
| `journals/{journalId}` | 全員（暫定）| 本人のみ | 本人 or likes更新のみ | 本人のみ |
| `journals/.../comments/` | 認証済み | 認証済み（自分UID） | 本人のみ | 本人のみ |
| `notifications/` | 受信者本人 | 認証済み（fromUserId=自分） | 受信者本人 | 不可 |
| `follows/` | 認証済み | 認証済み（followerId=自分） | 不可 | 認証済み（followerId=自分） |
| `conversations/` | 参加者のみ | 参加者として含まれる場合 | 参加者のみ | 不可 |
| `conversations/.../messages/` | 参加者のみ | 参加者のみ | 参加者のみ | 不可 |

> **本番移行時の注意:** `journals`の`read`は現在デバッグ用で全員許可。本番では `isPublic == true || userId == request.auth.uid` に変更する。

---

## 5. API ルート一覧

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/feed/journals` | 公開ジャーナル一覧（著者情報・コメント数付き）。最大50件 |
| GET | `/api/profile/[uid]` | 指定ユーザーのプロフィール・公開ジャーナル・フォロワー/フォロー中数 |
| POST | `/api/transcribe` | 音声データ（WebM）→ テキスト（OpenAI Whisper `whisper-1`、日本語） |
| POST | `/api/ai-chat` | AIチャット（AI SDK + OpenAI、ジャーナル・目標データを参照） |

### GET `/api/feed/journals` レスポンス

```typescript
{
  items: {
    id: string;
    userId: string;
    title?: string;
    content: string;
    createdAt: string;     // ISO 8601
    isPublic: boolean;
    likes: string[];
    commentCount: number;
    daysSinceEnrollment?: number;
  }[];
  authors: Record<string, {
    displayName: string;
    university: string;
    grade: string;
    enrollmentDate?: string;
  }>;
}
```

### GET `/api/profile/[uid]` レスポンス

```typescript
{
  profile: {
    displayName: string;
    university: string;
    grade: string;
    enrollmentDate?: string;
    graduationDate?: string;
  };
  journals: { id: string; title?: string; content: string; createdAt: string; likes: string[]; }[];
  followersCount: number;
  followingCount: number;
}
```

---

## 6. 設計上の注意事項

### `isPublic` と `visibility` の二重管理
ジャーナルには公開状態を表すフィールドが2つある。書き込み時は必ず同期すること。

```ts
// 書き込み例（常に両方セット）
await addDoc(collection(db, "journals"), {
  isPublic: true,
  visibility: "public",
  ...
});
```

### `users` コレクションへのクライアント直接アクセスの制限
セキュリティルールにより `users/{userId}` は本人しか読めない。他ユーザーのプロフィールを表示する場合は必ずサーバーAPI（`/api/profile/[uid]`）経由にすること。

### `Timestamp` の扱い
Firestoreの`Timestamp`型はJSON直列化できない。クライアントへ渡す際は必ず変換する。

```ts
// クライアント表示用に変換
const date = timestamp.toDate();                    // Date型
const iso = timestamp.toDate().toISOString();       // 文字列
```

### コメントの `userName` キャッシュ
コメントに`userName`を非正規化して保存しているため、ユーザーが名前を変更してもコメントの表示名は更新されない。現時点では仕様として許容。

### DM開始フロー
プロフィールページの「DM」ボタンを押したとき:
1. `conversations` コレクションで `participants` に両ユーザーのUIDが含まれる会話を検索
2. 存在すれば `/messages/{convId}` へ遷移
3. 存在しなければ新規ドキュメントを作成してから遷移
