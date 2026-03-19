"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { getFirebaseConfigErrorMessage } from "@/lib/firebase";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const firebaseConfigError = getFirebaseConfigErrorMessage();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/setup-profile");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async () => {
    setError("");
    if (firebaseConfigError) {
      setError(`認証設定エラー: ${firebaseConfigError}`);
      return;
    }

    if (!email.trim()) {
      setError("メールアドレスを入力してください");
      return;
    }
    if (!password) {
      setError("パスワードを入力してください");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません");
      return;
    }

    setFormLoading(true);
    try {
      await signUpWithEmail(email.trim(), password);
      router.replace("/setup-profile");
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code ?? "")
          : "";
      const msg =
        code === "auth/email-already-in-use"
          ? "このメールアドレスはすでに登録されています"
          : code === "auth/unauthorized-domain"
            ? "認証ドメインが未許可です。Firebase Console の Authentication > Settings > Authorized domains に本番ドメインを追加してください。"
            : code === "auth/invalid-api-key" || code === "auth/api-key-not-valid.-please-pass-a-valid-api-key."
              ? "APIキー設定が不正です。デプロイ先の環境変数 NEXT_PUBLIC_FIREBASE_API_KEY を確認してください。"
              : err && typeof err === "object" && "message" in err
                ? String((err as { message?: string }).message ?? "アカウント作成に失敗しました")
                : "アカウント作成に失敗しました";
      setError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  if (authLoading || user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div
        className={cn(
          "w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm",
          "shadow-[0_4px_12px_rgba(0,0,0,0.04)]"
        )}
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-7" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">ガクチカビジョン</h1>
          <p className="text-sm text-muted-foreground">新規アカウント作成</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-email">メールアドレス</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={formLoading}
              className="border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">パスワード</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="6文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={formLoading}
                className="border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password-confirm">パスワード（確認用）</Label>
            <div className="relative">
              <Input
                id="signup-password-confirm"
                type={showPasswordConfirm ? "text" : "password"}
                placeholder="パスワードを再入力"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={formLoading}
                className="border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasswordConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showPasswordConfirm ? "パスワードを隠す" : "パスワードを表示"}
                tabIndex={-1}
              >
                {showPasswordConfirm ? (
                  <EyeOff className="size-4" aria-hidden />
                ) : (
                  <Eye className="size-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {!error && firebaseConfigError && (
            <p className="text-sm text-destructive" role="alert">
              認証設定エラー: {firebaseConfigError}
            </p>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={formLoading}
          >
            アカウントを作成
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちの方は
          <Link
            href="/login"
            className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            こちら（ログイン）
          </Link>
        </p>
      </div>
    </div>
  );
}
