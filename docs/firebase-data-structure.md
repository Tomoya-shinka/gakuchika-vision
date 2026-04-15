# Firebase データ構造ドキュメント

> 最終更新: 2026-04-16

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
| `isPublic` | boolean | — | 公開フラグ（`true` = フィードに表示）。ジャーナル投稿では必須。Snap・つぶやきは省略可（省略時は非公開扱い） |
| `type` | `"snap"` \| `"tweet"` \| undefined | — | 投稿種別。未設定 = ジャーナル |
| `likes` | string[] | — | いいねしたユーザー UID の配列 |
| `audioUrl` | string | — | 音声ファイル URL（Firebase Storage） |
| `audioDurationSec` | number | — | 音声の長さ（秒） |
| `transcription` | string | — | 音声の文字起こしテキスト（Whisper API による。音声添付時のみ保存） |
| `imageUrls` | string[] | — | 添付画像 URL の配列 |
| `visibility` | `"public"` \| `"private"` | — | 公開設定。`isPublic` と対応（`"public"` = `isPublic: true`） |
| `commentsEnabled` | boolean | — | コメント受付フラグ（保存時にユーザーの通知設定から継承） |
| `updatedAt` | Timestamp | — | 最終編集日時（`/journal/[id]/edit` での更新時のみ付与） |

### `type` フィールドの値一覧

| 値 | 意味 | 特徴 |
|---|---|---|
| `undefined`（未設定） | ジャーナル | タイトルあり、HTML リッチテキスト、MyPage「ジャーナル」タブに表示 |
| `"snap"` | Snap | ジャーナルの AI 抽出、またはコーチングセッションで得た洞察メモ。AI チャットのコンテキストにも使用。`snap-to-folder` による自己分析シート自動分類のトリガーにもなる |
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

// 追加（ジャーナル）
addDoc(collection(db, "journals"), { userId, content, title, isPublic, createdAt: serverTimestamp(), ... })

// 追加（Snap: ジャーナルページ）
addDoc(collection(db, "journals"), { userId, content, type: "snap", isPublic: false, likes: [], createdAt: Timestamp.now() })

// 追加（Snap: AIコーチページ — isPublic 未設定のため非公開扱い）
addDoc(collection(db, "journals"), { userId, content, type: "snap", likes: [], createdAt: Timestamp.now() })

// 更新（公開設定変更・いいねなど）
updateDoc(doc(db, "journals", journalId), { isPublic: true })

// 更新（ジャーナル編集ページ: タイトル・本文を修正）
updateDoc(doc(db, "journals", journalId), {
  title,
  content,            // HTML リッチテキスト
  updatedAt: Timestamp.now(),
})

// 削除
deleteDoc(doc(db, "journals", journalId))
```

**関連ファイル**:
- `src/app/(main)/journal/page.tsx`（新規作成）
- `src/app/(main)/journal/[id]/page.tsx`（詳細表示）
- `src/app/(main)/journal/[id]/edit/page.tsx`（タイトル・本文の編集）
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

アイテムの追加経路は2通りある：
1. **AIコーチ・直接追加**: コーチングセッションの洞察を Snap として `journals` に保存 → `addSnapToSelfAnalysis()` が `/api/snap-to-folder` を呼び出し、AI がフォルダを判定して自動追加
2. **直接追加**: `saveSelfAnalysisToFirestore()` を介してシートに直接追加

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
| `/api/snap-to-folder` | POST | `users/{uid}/self_analysis_folders` を読み込み、フォルダ判定結果を返す（`self_analysis` への保存はフロント側） |
| `/api/self-analysis/chat` | POST | なし（AIコーチのストリーミング応答。保存はフロント側） |
| `/api/chat/complete` | POST | なし（コーチ会話のまとめ文章を生成して返す） |
| `/api/ai-chat` | POST | なし（コンテキストはフロントから受け取り） |
| `/api/upload-image` | POST | なし（Firebase Storage のみ） |
| `/api/upload-audio` | POST | なし（Firebase Storage のみ） |
| `/api/upload-avatar` | POST | なし（Firebase Storage のみ） |
| `/api/transcribe` | POST | なし（Whisper API で音声文字起こし。結果はフロント側で利用。`maxDuration=60`s） |

---

## AI 機能とデータの関係

### 音声録音・文字起こしの制約

| 項目 | 値 | 理由 |
|---|---|---|
| 最大録音時間 | **8分** | Vercel タイムアウト（60秒）内に Whisper 処理を収めるため |
| 録音ビットレート | **32 kbps** | Vercel の request body 上限 4.5MB 以内に収めるため（192kbps では 6 分超で超過） |
| Vercel `maxDuration` | **60秒**（Hobby 上限） | Pro プランなら 300秒まで設定可能 |

> 8分録音時のファイルサイズ目安: 32kbps × 480秒 ÷ 8 ≈ **1.9 MB**

---

### チャット AI のコンテキスト構成（`/api/ai-chat`）

| データ | 取得元 | 上限 |
|---|---|---|
| Snap メモ | Firestore `journals`（`type == "snap"`） | 50件 |
| 自己分析メモ | localStorage | 全件 |
| 目標データ | localStorage | 全件 |

> ジャーナル全文ではなく Snap（要点抽出済み）のみを渡すことでトークンを最小化しています。

### AIコーチ → Snap → 自己分析シート 自動分類フロー

```
[/self-analysis/chat]（AIコーチ）
    ↓ 洞察検知（[INSIGHT_FOUND] シグナル）
    ↓ ユーザーが「Snapとして保存」をクリック
journals/{id}（type: "snap"）に保存
    ↓ バックグラウンドで addSnapToSelfAnalysis() を実行
    ↓ users/{uid}/self_analysis_folders を取得（カスタム or デフォルト4セクション）
    ↓ /api/snap-to-folder で AI がフォルダを判定
    ↓
users/{uid}/self_analysis/{itemId} に自動追加
```

### Snap 自動分類の判定ロジック（`/api/snap-to-folder`）

1. Firestore からユーザーのカスタムフォルダ一覧を取得
2. カスタムフォルダがない場合はデフォルト4セクション（`SELF_ANALYSIS_SECTIONS`）にフォールバック
3. OpenAI（Responses API）がフォルダ番号を返す
4. 対応する `folderId`（または `sectionId`）に `saveSelfAnalysisToFirestore()` で保存

---

## Firebase セキュリティルール（推奨設定メモ）

```
// journals: 自分のドキュメントのみ読み書き可。isPublic=true のものは全員読み取り可
// users: 自分のドキュメントのみ読み書き可
// users/{uid}/self_analysis: 自分のサブコレクションのみ読み書き可
// users/{uid}/self_analysis_folders: 同上
// notifications: toUserId が自分のドキュメントのみ読み取り可
```
