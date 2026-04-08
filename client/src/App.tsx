import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Assets from "@/pages/Assets";
import Team from "@/pages/Team";
import Settings from "@/pages/Settings";
import Logs from "@/pages/Logs";
import MySchedule from "@/pages/MySchedule";
import Login from "@/pages/Login";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProvider, useUser } from "@/contexts/UserContext";

function clearAppBadge() {
  if (
    "clearAppBadge" in navigator &&
    typeof navigator.clearAppBadge === "function"
  ) {
    navigator.clearAppBadge().catch(() => {});
  }
}

function useClearAppBadge() {
  useEffect(() => {
    clearAppBadge();
    const onVisibility = () => {
      if (document.visibilityState === "visible") clearAppBadge();
    };
    const onFocus = () => clearAppBadge();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}

function AuthenticatedRouter() {
  const { currentUser, isLoading, isAuthenticated } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/assets" component={Assets} />
        <Route path="/schedule" component={MySchedule} />
        <Route path="/team" component={Team} />
        <Route path="/settings" component={Settings} />
        <Route path="/logs" component={Logs} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  useClearAppBadge();
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <AuthenticatedRouter />
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
