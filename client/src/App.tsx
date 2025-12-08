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
import { AppLayout } from "@/components/layout/AppLayout";
import { UserProvider } from "@/contexts/UserContext";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/assets" component={Assets} />
        <Route path="/team" component={Team} />
        <Route path="/settings" component={Settings} />
        <Route path="/logs" component={Logs} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
