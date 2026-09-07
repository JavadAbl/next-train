"use client";

import { useState } from "react";
import { TrainFront, Loader2, LogIn, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, SessionUser } from "@/lib/client";

interface Props {
  onLogin: (user: SessionUser) => void;
}

export default function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود ناموفق بود");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-accent/40 to-background">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
            <TrainFront className="size-9" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold">سامانه سرویس لوکوموتیو</h1>
          <p className="text-sm text-muted-foreground">
            ثبت تعمیر، بازدید و تعویض قطعات بر پایه نقشه‌های فنی
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ورود به سامانه</CardTitle>
            <CardDescription>نام کاربری و رمز عبور خود را وارد کنید</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" dir="rtl">
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  dir="ltr"
                  className="text-left"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  disabled={busy}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={busy}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive rounded-md bg-destructive/10 p-2" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                ورود
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="size-3.5" aria-hidden /> حساب‌های نمایشی
          </p>
          <div className="grid grid-cols-3 gap-2 text-center" dir="ltr">
            <div className="rounded bg-background p-1.5">
              <p className="font-semibold">admin</p>
              <p>admin123</p>
            </div>
            <div className="rounded bg-background p-1.5">
              <p className="font-semibold">operator1</p>
              <p>op123456</p>
            </div>
            <div className="rounded bg-background p-1.5">
              <p className="font-semibold">repairman1</p>
              <p>rp123456</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
