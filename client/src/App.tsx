import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Agents from "@/pages/agents";
import Voices from "@/pages/voices";
import History from "@/pages/history";
import Integrations from "@/pages/integrations";
import Billing from "@/pages/billing";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin-new";
import Checkout from "@/pages/checkout";
import Playground from "@/pages/playground";
import PhoneNumbers from "@/pages/phone-numbers";
import OutboundCalling from "@/pages/outbound-calling";
import Tools from "@/pages/tools";
import KnowledgeBase from "@/pages/knowledge-base";
import AgentSettings from "@/pages/agent-settings";
import AppShell from "@/components/layout/app-shell";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import AgencyDashboard from "@/pages/agency-dashboard";
import ClientDashboard from "@/pages/client-dashboard";

function Router() {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Route based on user role
  if (userRole === 'super_admin') {
    return (
      <AppShell>
        <Switch>
          <Route path="/" component={SuperAdminDashboard} />
          <Route path="/agencies" component={SuperAdminDashboard} />
          <Route path="/admin" component={Admin} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    );
  }

  if (userRole === 'agency') {
    return (
      <AppShell>
        <Switch>
          <Route path="/" component={AgencyDashboard} />
          <Route path="/clients" component={AgencyDashboard} />
          <Route path="/billing" component={Billing} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    );
  }

  // Default routes for clients and legacy users
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={userRole === 'client' ? ClientDashboard : Dashboard} />
        <Route path="/agents" component={Agents} />
        <Route path="/agent-settings" component={AgentSettings} />
        <Route path="/voices" component={Voices} />
        <Route path="/phone-numbers" component={PhoneNumbers} />
        <Route path="/outbound-calling" component={OutboundCalling} />
        <Route path="/tools" component={Tools} />
        <Route path="/knowledge-base" component={KnowledgeBase} />
        <Route path="/playground" component={Playground} />
        <Route path="/history" component={History} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/billing" component={Billing} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
