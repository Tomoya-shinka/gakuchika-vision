"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { getDb } from "@/lib/firebase";
import {
  saveUserProfile,
  checkProfileCompleted,
} from "@/lib/user-profile-firestore";
import { cn } from "@/lib/utils";

const GRADE_OPTIONS = [
  "1年生",
  "2年生",
  "3年生",
  "4年生",
  "院生",
  "その他",
] as const;

export default function SetupProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [university, setUniversity] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const run = async () => {
      const db = getDb();
      const completed = await checkProfileCompleted(db, user.uid);
      if (completed) {
        router.replace("/");
        return;
      }
      setChecking(false);
    };
    run();
  }, [user, authLoading, router]);

  const handleSubmit = async () => {
    setError("");
    if (!displayName.trim()) {
      setError("ユーザー名を入力してください");
      return;
    }
    if (!university.trim()) {
      setError("大学名を入力してください");
      return;
    }
    if (!grade) {
      setError("学年を選択してください");
      return;
    }
    if (!user?.uid) return;

    setFormLoading(true);
    try {
      const db = getDb();
      await saveUserProfile(db, user.uid, {
        displayName: displayName.trim(),
        university: university.trim(),
        grade,
        isProfileCompleted: true,
      });
      router.replace("/");
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setFormLoading(false);
    }
  };

  if (authLoading || checking || !user) {
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
          <h1 className="text-xl font-semibold text-foreground">プロフィール設定</h1>
          <p className="text-sm text-muted-foreground">
            あなたの情報を入力してください
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="setup-displayName">ユーザー名</Label>
            <Input
              id="setup-displayName"
              placeholder="TOMOYA"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={formLoading}
              className="border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-university">大学名</Label>
            <Input
              id="setup-university"
              placeholder="〇〇大学"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              disabled={formLoading}
              className="border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-grade">学年</Label>
            <Select value={grade} onValueChange={setGrade} disabled={formLoading}>
              <SelectTrigger
                id="setup-grade"
                className="w-full border-border"
              >
                <SelectValue placeholder="学年を選択" />
              </SelectTrigger>
              <SelectContent>
                {GRADE_OPTIONS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            設定を完了する
          </Button>
        </div>
      </div>
    </div>
  );
}
