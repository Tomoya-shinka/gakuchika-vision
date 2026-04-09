# Firebase データ構造ドキュメント

> 最終更新: 2026-04-09

---

## 概要

このアプリ（LIFE VISION JOURNAL）では Firebase Firestore をメインデータストアとして使用しています。  
一部のデータ（目標・自己分析ローカルキャッシュ等）は localStorage にも保存されています。

---

## Firestore コレクション構成

```
Firestore
├── users/                        ← ユーザープロフィール
│   └── {userId}/
│       ├── [フィールド群]
│       ├── self_analysis/        ← 自己分析アイテム（サブコレクション）
│       │   └── {itemId}/
│       └── self_analysis_folders/ ← カスタムフォルダ（サブコレクション）
│           └── {folderId}/
│
└── journals/                     ← ジャーナル・Snap・つぶやき統合コレクション
    └── {journalId}/
        ├── [フィールド群]
        └── comments/             ← コメント（サブコレクション）
            └── {commentId}/
```

---

## 1. `users` コレクション

**ドキュメント ID**: Firebase Auth の UID

### フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `displayName` | string | ○ | 表示名 |
| `university` | string | — | 所属大学 |
| `grade` | string | — | 学年（数字のみ。例: `"3"` → 表示時に「3年生」） |
| `isProfileCompleted` | boolean | ○ | プロフィール設定完了フラグ |
| `enrollmentDate` | string (YYYY-MM-DD) | — | 入学年月日（大学生活日数計算に使用） |
| `graduationDate` | string (YYYY-MM-DD) | — | 卒業予定日（カウントダウン計算に使用） |
| `birthDate` | string (YYYY-MM-DD) | — | 生年月日（人生カウントダウン用） |
| `isStudent` | boolean | — | 大学生フラグ（UI表示制御） |
| `avatarUrl` | string | — | アバター画像 URL |
| `commentsEnabled` | `"all"` \| `"followers"` \| `"off"` | — | コメント受付設定 |
| `dmEnabled` | `"all"` \| `"followers"` \| `"off"` | — | DM 受付設定 |
| `commentNotificationsEnabled` | `"all"` \| `"followers"` \| `"off"` | — | コメント通知設定 |
| `dmNotificationsEnabled` | `"all"` \| `"followers"` \| `"off"` | — | DM 通知設定 |
| `updatedAt` | string (ISO) | — | 最終更新日時 |

### 主な操作

```ts
// 取得
getDoc(doc(db, "users", uid))

// 保存
setDoc(doc(db, "users", uid), { ...data }, { merge: true })
```

**関連ファイル**: `src/lib/user-profile-firestore.ts`

---

## 2. `journals` コレクション

**ドキュメント ID**: 自動生成

**説明**: ジャーナル・Snap・つぶやきをすべてこのコレクションで管理。`type` フィールドで種別を区別する。

### フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `userId` | string | ○ | 投稿者の UID |
| `content` | string | ○ | 本文（ジャーナルは HTML リッチテキスト、Snap/つぶやきはプレーンテキスト） |
| `title` | string | — | タイトル（ジャーナルのみ。未設定時は「タイトル未設定のジャーナル」として表示） |
| `createdAt` | Timestamp | ○ | 作成日時 |
| `isPublic` | boolean | ○ | 公開フラグ（`true` = フィードに表示） |
| `type` | `"snap"` \| `"tweet"` \| undefined | — | 投稿種別。未設定 = ジャーナル |
| `likes` | string[] | — | いいねしたユーザー UID の配列 |
| `audioUrl` | string | — | 音声ファイル URL |
| `audioDurationSec` | number | — | 音声の長さ（秒） |
| `imageUrls` | string[] | — | 添付画像 URL の配列 |

### `type` フィールドの値一覧

| 値 | 意味 | 特徴 |
|---|---|---|
| `undefined`（未設定） | ジャーナル | タイトルあり、HTML リッチテキスト、MyPage「ジャーナル」タブに表示 |
| `"snap"` | Snap | ジャーナルから AI 抽出した洞察メモ。チャット AI のコンテキストにも使用 |
| `"tweet"` | つぶやき | 短い自由投稿 |

### 主な操作

```ts
// 自分の全投稿取得
query(collection(db, "journals"), where("userId", "==", uid))

// フィード（公開投稿）取得
query(
  collection(db, "journals"),
  where("isPublic", "==", true),
  orderBy("createdAt", "desc"),
  limit(50)
)

// Snap のみ取得（チャット AI コンテキスト用）
query(
  collection(db, "journals"),
  where("userId", "==", uid),
  where("type", "==", "snap")
)

// 1件取得
getDoc(doc(db, "journals", journalId))

// 追加
addDoc(collection(db, "journals"), { userId, content, createdAt: serverTimestamp(), isPublic, ... })

// 更新（公開設定変更・いいねなど）
updateDoc(doc(db, "journals", journalId), { isPublic: true })

// 削除
deleteDoc(doc(db, "journals", journalId))
```

**関連ファイル**:
- `src/app/(main)/journal/page.tsx`
- `src/app/(main)/journal/[id]/page.tsx`
- `src/app/(main)/mypage/page.tsx`
- `src/app/api/feed/journals/route.ts`

---

## 3. `journals/{journalId}/comments` サブコレクション

**ドキュメント ID**: 自動生成

### フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `userId` | string | ○ | コメント投稿者の UID |
| `userName` | string | ○ | 投稿者名 |
| `text` | string | ○ | コメント本文 |
| `createdAt` | Timestamp | ○ | 投稿日時 |

### 主な操作

```ts
// 取得
collection(db, "journals", journalId, "comments")

// 追加
addDoc(collection(db, "journals", journalId, "comments"), { userId, userName, text, createdAt: serverTimestamp() })
```

**関連ファイル**: `src/app/api/feed/journals/[id]/route.ts`

---

## 4. `users/{userId}/self_analysis` サブコレクション

**ドキュメント ID**: 自動生成

**説明**: ユーザーの自己分析シートに記録された各アイテム。

### フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `sectionId` | string | ○ | 所属フォルダの ID（デフォルト4種 or カスタムフォルダ ID） |
| `content` | string | ○ | アイテム本文 |
| `createdAt` | Timestamp | ○ | 作成日時 |

### デフォルト `sectionId` 一覧

| ID | 表示名 |
|---|---|
| `"small-wins"` | 小さな成功体験 |
| `"fun"` | 楽しかったこと |
| `"strength"` | 強み・得意なこと |
| `"dream"` | 夢・やりたいこと |

### 主な操作

```ts
// 取得
query(
  collection(db, "users", userId, "self_analysis"),
  orderBy("createdAt", "desc")
)

// 追加
addDoc(collection(db, "users", userId, "self_analysis"), {
  sectionId,
  content,
  createdAt: serverTimestamp(),
})
```

**関連ファイル**: `src/lib/self-analysis-firestore.ts`, `src/lib/snap-to-self-analysis.ts`

---

## 5. `users/{userId}/self_analysis_folders` サブコレクション

**ドキュメント ID**: ユーザー指定（フォルダ ID）

**説明**: ユーザーが作成したカスタム自己分析フォルダ。

### フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | ○ | フォルダ名 |
| `emoji` | string | ○ | アイコン（Lucide React アイコン名） |
| `description` | string | — | フォルダ説明（Snap 自動分類の AI 判定に使用） |
| `order` | number | ○ | 表示順序 |
| `createdAt` | Timestamp \| string | ○ | 作成日時 |
| `isDefault` | boolean | — | デフォルトフォルダ判定フラグ |

### 主な操作

```ts
// 取得
query(
  collection(db, "users", userId, "self_analysis_folders"),
  orderBy("order", "asc")
)

// 保存
setDoc(doc(db, "users", userId, "self_analysis_folders", folderId), { ...data })
```

**関連ファイル**: `src/lib/self-analysis-firestore.ts`

---

## 6. `notifications` コレクション

**ドキュメント ID**: 自動生成

### フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `toUserId` | string | ○ | 通知受信者の UID |
| `fromUserId` | string | ○ | 通知送信者の UID |
| `type` | `"comment"` \| `"dm"` | ○ | 通知種別 |
| `read` | boolean | ○ | 既読フラグ |
| `createdAt` | Timestamp | ○ | 作成日時 |

### 主な操作

```ts
// 未読コメント通知取得
query(
  collection(db, "notifications"),
  where("toUserId", "==", uid),
  where("type", "==", "comment"),
  where("read", "==", false)
)
```

**関連ファイル**: `src/hooks/useCommentNotifications.ts`

---

## localStorage（クライアントサイド）

Firestore と並行してローカルキャッシュ・一部データの localStorage 管理が残っています。

| キー | 型 | 説明 |
|---|---|---|
| `gakuchika-journal-entries` | `JournalEntry[]` | ジャーナルのローカルキャッシュ（バージョン管理あり） |
| `gakuchika-journal-version` | string | キャッシュバージョン（現在: `"2"`） |
| `user_profile` | `UserProfile` | ユーザープロフィールのローカルキャッシュ |
| `gakuchika-goals` | `GoalsData` | 目標データ（長期ビジョン・1年後・今月・小さな一歩） |
| `gakuchika-self-analysis-items` | `SelfAnalysisItem[]` | 自己分析アイテムのローカルキャッシュ |
| `gakuchika-self-analysis-folders` | `SelfAnalysisFolder[]` | カスタムフォルダのローカルキャッシュ |
| `gakuchika-tasks-completion` | `CompletionHistory` | タスク完了履歴 |

> **注意**: `gakuchika-journal-entries` はバージョン `"2"` 以外が保存されていた場合、初回アクセス時に自動削除されます。ジャーナルの実データは Firestore が正とします。

---

## API エンドポイントとデータ操作

| エンドポイント | メソッド | Firestore 操作 |
|---|---|---|
| `/api/feed/journals` | GET | `journals`（isPublic=true）+ `users`（著者情報） |
| `/api/feed/journals/[id]` | GET | `journals/{id}` + `journals/{id}/comments` + `users` |
| `/api/extract-insights` | POST | なし（フロント側で Snap を `journals` に保存） |
| `/api/snap-to-folder` | POST | なし（フロント側で `self_analysis` に保存） |
| `/api/upload-image` | POST | なし（Firebase Storage のみ） |
| `/api/upload-audio` | POST | なし（Firebase Storage のみ） |
| `/api/upload-avatar` | POST | なし（Firebase Storage のみ） |
| `/api/ai-chat` | POST | なし（コンテキストはフロントから受け取り） |

---

## チャット AI のコンテキスト構成

チャット AI（`/api/ai-chat`）に渡されるコンテキストは以下の通りです。

| データ | 取得元 | 上限 |
|---|---|---|
| Snap メモ | Firestore `journals`（`type == "snap"`） | 50件 |
| 自己分析メモ | localStorage | 全件 |
| 目標データ | localStorage | 全件 |

> ジャーナル全文ではなく Snap（要点抽出済み）のみを渡すことでトークンを最小化しています。

---

## Firebase セキュリティルール（推奨設定メモ）

```
// journals: 自分のドキュメントのみ読み書き可。isPublic=true のものは全員読み取り可
// users: 自分のドキュメントのみ読み書き可
// users/{uid}/self_analysis: 自分のサブコレクションのみ読み書き可
// users/{uid}/self_analysis_folders: 同上
// notifications: toUserId が自分のドキュメントのみ読み取り可
```
