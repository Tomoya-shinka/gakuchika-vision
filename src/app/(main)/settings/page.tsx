"use client";

import { useEffect, useState } from "react";
import { Mic, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STORAGE_KEY = "preferred_mic_device_id";

export default function SettingsPage() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    setSelectedId(saved);

    // デバイス一覧を取得（権限がない場合は label が空になる）
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((all) => {
        const mics = all.filter((d) => d.kind === "audioinput");
        setDevices(mics);
        // label が空の場合は権限リクエスト
        if (mics.length > 0 && !mics[0].label) {
          return navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
            s.getTracks().forEach((t) => t.stop());
            return navigator.mediaDevices.enumerateDevices();
          });
        }
        return Promise.resolve(all);
      })
      .then((all) => {
        if (all) setDevices(all.filter((d) => d.kind === "audioinput"));
      })
      .catch(() => {});
  }, []);

  const handleSelect = (deviceId: string) => {
    setSelectedId(deviceId);
    if (deviceId) {
      localStorage.setItem(STORAGE_KEY, deviceId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 sm:h-14">
        <h1 className="text-base font-semibold sm:text-lg">設定</h1>
      </header>
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* マイク設定 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="size-4 text-sky-500" />
                マイク入力
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                音声録音時に使用するマイクを選択できます。
              </p>

              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  マイクが見つかりません。ブラウザのマイク権限を確認してください。
                </p>
              ) : (
                <div className="space-y-2">
                  {/* デフォルト（システム設定に従う）*/}
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
                    <input
                      type="radio"
                      name="mic"
                      value=""
                      checked={selectedId === ""}
                      onChange={() => handleSelect("")}
                      className="accent-sky-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">システムデフォルト</p>
                      <p className="text-xs text-muted-foreground">OSの設定に従って入力デバイスを選択します</p>
                    </div>
                    {selectedId === "" && <CheckCircle2 className="size-4 shrink-0 text-sky-500" />}
                  </label>

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
                        {device.groupId && (
                          <p className="text-xs text-muted-foreground truncate">ID: {device.deviceId.slice(0, 16)}…</p>
                        )}
                      </div>
                      {selectedId === device.deviceId && <CheckCircle2 className="size-4 shrink-0 text-sky-500" />}
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
