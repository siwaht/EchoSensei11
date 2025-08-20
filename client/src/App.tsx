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
import AgentSettings from "@/pages/agent-settings";
import Voices from "@/pages/voices";
import History from "@/pages/history";
import Integrations from "@/pages/integrations";
import Billing from "@/pages/billing";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";
import Checkout from "@/pages/checkout";
import Playground from "@/pages/playground";
import PhoneNumbers from "@/pages/phone-numbers";
import OutboundCalling from "@/pages/outbound-calling";
import Tools from "@/pages/tools";
import AppShell from "@/components/layout/app-shell";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/:agentId/settings" component={AgentSettings} />
        <Route path="/voices" component={Voices} />
        <Route path="/phone-numbers" component={PhoneNumbers} />
        <Route path="/outbound-calling" component={OutboundCalling} />
        <Route path="/tools" component={Tools} />
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
