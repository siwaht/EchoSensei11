import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Circle, ChevronRight, Key, Bot, Phone, Rocket } from "lucide-react";

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  checkQuery?: string;
}

const steps: Step[] = [
  {
    id: "api-key",
    title: "Connect Your API",
    description: "Add your ElevenLabs API key to enable voice agent monitoring",
    icon: Key,
    link: "/integrations",
    checkQuery: "/api/integrations"
  },
  {
    id: "create-agent",
    title: "Create Your First Agent",
    description: "Set up your voice AI agent with custom prompts and settings",
    icon: Bot,
    link: "/agents",
    checkQuery: "/api/agents"
  },
  {
    id: "add-phone",
    title: "Add Phone Number",
    description: "Configure phone numbers for your voice agents to use",
    icon: Phone,
    link: "/phone-numbers",
    checkQuery: "/api/phone-numbers"
  },
  {
    id: "test-agent",
    title: "Test Your Agent",
    description: "Try out your agent in the playground before going live",
    icon: Rocket,
    link: "/playground"
  }
];

export function GettingStarted() {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(localStorage.getItem("getting-started-dismissed") === "true");

  // Check integration status
  const { data: integration } = useQuery({
    queryKey: ["/api/integrations"],
    enabled: !dismissed
  });

  // Check if agents exist
  const { data: agents } = useQuery({
    queryKey: ["/api/agents"],
    enabled: !dismissed
  });

  // Check if phone numbers exist
  const { data: phoneNumbers } = useQuery({
    queryKey: ["/api/phone-numbers"],
    enabled: !dismissed
  });

  const getStepStatus = (stepId: string) => {
    switch (stepId) {
      case "api-key":
        return (integration as any)?.status === "ACTIVE";
      case "create-agent":
        return agents && Array.isArray(agents) && agents.length > 0;
      case "add-phone":
        return phoneNumbers && Array.isArray(phoneNumbers) && phoneNumbers.length > 0;
      case "test-agent":
        return false; // This is always manual
      default:
        return false;
    }
  };

  const completedSteps = steps.filter(step => getStepStatus(step.id)).length;
  const progress = (completedSteps / steps.length) * 100;

  const handleDismiss = () => {
    localStorage.setItem("getting-started-dismissed", "true");
    setDismissed(true);
  };

  if (dismissed || completedSteps === steps.length) {
    return null;
  }

  return (
    <Card className="p-6 mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Welcome to VoiceAI Dashboard!</h3>
          <p className="text-sm text-muted-foreground">
            Complete these steps to get your voice agents up and running
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </Button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Setup Progress</span>
          <span className="font-medium">{completedSteps} of {steps.length} completed</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const isCompleted = getStepStatus(step.id);
          
          return (
            <button
              key={step.id}
              onClick={() => setLocation(step.link)}
              className="text-left p-3 rounded-lg border bg-card hover:bg-accent transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${isCompleted ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <h4 className="text-sm font-medium">{step.title}</h4>
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {step.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}