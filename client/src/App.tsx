import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Assets from "@/pages/Assets";
import { AppLayout } from "@/components/layout/AppLayout";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/assets" component={Assets} />
        {/* Placeholder pages */}
        <Route path="/team">
          <div className="flex items-center justify-center h-[50vh] text-muted-foreground">팀 관리 (준비 중)</div>
        </Route>
        <Route path="/settings">
          <div className="flex items-center justify-center h-[50vh] text-muted-foreground">시스템 설정 (준비 중)</div>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
