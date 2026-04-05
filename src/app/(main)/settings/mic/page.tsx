"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "preferred_mic_device_id";

export default function MicSettingsPage() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    const loadDevices = async () => {
      let all = await navigator.mediaDevices.enumerateDevices();
      const mics = all.filter((d) => d.kind === "audioinput");
      if (mics.length > 0 && !mics[0].label) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        all = await navigator.mediaDevices.enumerateDevices();
      }
      const finalMics = all.filter((d) => d.kind === "audioinput");
      setDevices(finalMics);
      const validId = finalMics.find((d) => d.deviceId === stored)?.deviceId;
      if (validId) {
        setSelectedId(validId);
      } else if (finalMics.length > 0) {
        const firstId = finalMics[0].deviceId;
        setSelectedId(firstId);
        localStorage.setItem(STORAGE_KEY, firstId);
      }
    };
    loadDevices().catch(() => {});
  }, []);

  const handleSelect = (deviceId: string) => {
    setSelectedId(deviceId);
    localStorage.setItem(STORAGE_KEY, deviceId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-background px-4">
        <Link
          href="/settings"
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          設定
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold sm:text-base">マイク設定</h1>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="text-sm text-muted-foreground">
                音声録音時に使用するマイクを選択してください。
              </p>

              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  マイクが見つかりません。ブラウザのマイク権限を確認してください。
                </p>
              ) : (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <label
                      key={device.deviceId}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <input
                        type="radio"
                        name="mic"
                        value={device.deviceId}
                        checked={selectedId === device.deviceId}
                        onChange={() => handleSelect(device.deviceId)}
                        className="accent-sky-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {device.label || `マイク ${devices.indexOf(device) + 1}`}
                        </p>
                      </div>
                      {selectedId === device.deviceId && (
                        <CheckCircle2 className="size-4 shrink-0 text-sky-500" />
                      )}
                    </label>
                  ))}
                </div>
              )}

              {saved && (
                <p className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
                  <CheckCircle2 className="size-3.5" />
                  保存しました
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
