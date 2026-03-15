"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/setup-profile");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async () => {
    setError("");

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
      const msg =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code === "auth/email-already-in-use"
            ? "このメールアドレスはすでに登録されています"
            : (err as { message?: string }).message ?? "アカウント作成に失敗しました"
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
            <Input
              id="signup-password"
              type="password"
              placeholder="6文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={formLoading}
              className="border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password-confirm">パスワード（確認用）</Label>
            <Input
              id="signup-password-confirm"
              type="password"
              placeholder="パスワードを再入力"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={formLoading}
              className="border-border"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
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
