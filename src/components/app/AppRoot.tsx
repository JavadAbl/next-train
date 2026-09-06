"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, type SessionUser } from "@/lib/client";
import LoginView from "./LoginView";
import Shell, { type View } from "./Shell";
import DashboardView from "./DashboardView";
import TrainsView from "./TrainsView";
import BuilderView from "./BuilderView";
import NavigatorView from "./NavigatorView";
import RecordsView, { type ReportFilters } from "./RecordsView";
import ReportView from "./ReportView";
import UsersView from "./UsersView";

export default function AppRoot() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booted, setBooted] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [builderTrainId, setBuilderTrainId] = useState<string | null>(null);
  const [navigatorTrainId, setNavigatorTrainId] = useState<string | null>(null);
  const [reportTrainId, setReportTrainId] = useState<string | null>(null);
  const [reportFilters, setReportFilters] = useState<ReportFilters>({ from: "", to: "", type: "" });

  useEffect(() => {
    api<{ user: SessionUser | null }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setBooted(true));
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setView("dashboard");
  }, []);

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-10 animate-spin text-primary" aria-label="در حال بارگذاری" />
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={(u) => { setUser(u); setView("dashboard"); }} />;
  }

  const openBuilder = (trainId: string) => {
    setBuilderTrainId(trainId);
    setView("builder");
  };
  const openNavigator = (trainId: string | null) => {
    setNavigatorTrainId(trainId);
    setView("navigator");
  };
  const openReport = (trainId: string, filters: ReportFilters) => {
    setReportTrainId(trainId);
    setReportFilters(filters);
    setView("report");
  };

  return (
    <Shell user={user} activeView={view} onNavigate={(v) => setView(v)} onLogout={logout}>
      {view === "dashboard" && (
        <DashboardView
          user={user}
          onNavigate={setView}
          onOpenNavigator={() => openNavigator(null)}
          onOpenTrains={() => setView("trains")}
        />
      )}
      {view === "trains" && (
        <TrainsView
          user={user}
          onOpenBuilder={openBuilder}
          onOpenNavigator={(id) => openNavigator(id)}
          onOpenReport={openReport}
        />
      )}
      {view === "builder" && builderTrainId && (
        <BuilderView
          key={builderTrainId}
          trainId={builderTrainId}
          user={user}
          onBack={() => setView("trains")}
          onOpenNavigator={(id) => openNavigator(id)}
        />
      )}
      {view === "navigator" && (
        <NavigatorView
          key={navigatorTrainId || "picker"}
          initialTrainId={navigatorTrainId}
          user={user}
          onExit={() => setView("dashboard")}
        />
      )}
      {view === "records" && (
        <RecordsView user={user} onOpenReport={openReport} onNavigate={setView} />
      )}
      {view === "report" && reportTrainId && (
        <ReportView trainId={reportTrainId} filters={reportFilters} onBack={() => setView("records")} />
      )}
      {view === "users" && <UsersView />}
    </Shell>
  );
}
