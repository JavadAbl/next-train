"use client";

import React from "react";
import { TrainFront, LogOut, LayoutDashboard, TrainFront as TrainsIcon, Map, ClipboardList, Users, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type SessionUser } from "@/lib/client";

export type View = "dashboard" | "trains" | "builder" | "navigator" | "records" | "users" | "report";

interface NavItem {
  key: View;
  label: string;
  icon: React.ElementType;
  roles?: SessionUser["role"][];
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { key: "navigator", label: "ثبت سرویس", icon: Map },
  { key: "trains", label: "لوکوموتیوها", icon: TrainsIcon, roles: ["ADMIN", "OPERATOR"] },
  { key: "records", label: "سوابق سرویس", icon: ClipboardList },
  { key: "users", label: "کاربران", icon: Users, roles: ["ADMIN"] },
];

interface ShellProps {
  user: SessionUser;
  activeView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Shell({ user, activeView, onNavigate, onLogout, children }: ShellProps) {
  const { theme, setTheme } = useTheme();
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  const initials = user.fullName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 no-print">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <span className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <TrainFront className="size-5" aria-hidden />
              </span>
              <span className="hidden sm:inline">سامانه سرویس لوکوموتیو</span>
              <span className="sm:hidden">سرویس لوکوموتیو</span>
            </div>

            <nav className="flex-1 flex items-center justify-center max-lg:order-3 max-lg:overflow-x-auto" aria-label="ناوبری اصلی">
              <div className="flex items-center gap-1 max-lg:pb-0.5">
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate(item.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                      activeView === item.key || (activeView === "builder" && item.key === "trains") || (activeView === "report" && item.key === "records")
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    aria-current={activeView === item.key ? "page" : undefined}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                ))}
              </div>
            </nav>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="تغییر پوسته روشن/تاریک"
              >
                <Sun className="size-4 dark:hidden" />
                <Moon className="hidden size-4 dark:block" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border py-1 ps-1 pe-3 hover:bg-accent transition-colors"
                    aria-label="منوی کاربر"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs bg-secondary">{initials || "؟"}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium hidden sm:inline max-w-28 truncate">{user.fullName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>
                    <p>{user.fullName}</p>
                    <p className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[user.role]}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout}>
                    <LogOut className="size-4" /> خروج از حساب
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">{children}</main>

      <footer className="mt-auto border-t bg-muted/30 no-print">
        <div className="mx-auto max-w-7xl px-4 py-3 text-center text-xs text-muted-foreground">
          سامانه سرویس و تعمیرات لوکوموتیوهای دیزلی — نسخه نمایشی
        </div>
      </footer>
    </div>
  );
}
