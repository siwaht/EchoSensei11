import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Calendar, Clock, DollarSign, Activity, Settings, Phone } from "lucide-react";
import type { Agent, CallLog } from "@shared/schema";

interface AgentDetailModalProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentDetailModal({ agent, open, onOpenChange }: AgentDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Reset tab to overview when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab("overview");
    }
  }, [open]);
  
  const { data: callLogs } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
    queryFn: () => fetch(`/api/call-logs?agentId=${agent?.id}`).then(res => res.json()),
    enabled: !!agent?.id && open,
  });

  const toggleAgentMutation = useMutation({
    mutationFn: async () => {
      if (!agent) return;
      await apiRequest("PATCH", "/api/agents/" + agent.id, { isActive: !agent.isActive });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Agent ${agent?.isActive ? 'deactivated' : 'activated'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update agent status",
        variant: "destructive",
      });
    },
  });

  if (!agent) return null;

  const agentCalls = callLogs?.filter(log => log.agentId === agent.id) || [];
  const totalCalls = agentCalls.length;
  const totalMinutes = Math.round(agentCalls.reduce((sum, log) => sum + (log.duration || 0), 0) / 60);
  const totalCost = agentCalls.reduce((sum, log) => sum + parseFloat(log.cost || "0"), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {agent.name}
                <Badge className={agent.isActive ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"}>
                  {agent.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-normal">
                Agent ID: {agent.elevenLabsAgentId}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 overflow-y-auto flex-1">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Calls</p>
                    <p className="text-2xl font-bold">{totalCalls}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Minutes</p>
                    <p className="text-2xl font-bold">{totalMinutes}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cost</p>
                    <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "Unknown"}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Agent Info */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Agent Information</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{agent.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{agent.isActive ? "Active" : "Inactive"}</p>
                  </div>
                </div>
                {agent.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{agent.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">ElevenLabs Agent ID</p>
                  <p className="font-mono text-sm bg-muted p-2 rounded">{agent.elevenLabsAgentId}</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 overflow-y-auto flex-1">
            {/* Agent Status */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Agent Status
              </h3>
              
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Agent Availability</p>
                  <p className="text-sm text-muted-foreground">
                    {agent.isActive ? "Agent is currently active and receiving calls" : "Agent is inactive and not receiving calls"}
                  </p>
                </div>
                <Button
                  variant={agent.isActive ? "destructive" : "default"}
                  onClick={() => toggleAgentMutation.mutate()}
                  disabled={toggleAgentMutation.isPending}
                >
                  {agent.isActive ? "Deactivate" : "Activate"} Agent
                </Button>
              </div>
            </Card>

            {/* Configuration Notice */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Agent Configuration
              </h3>
              
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Configure in ElevenLabs Console</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    To modify agent prompts, voice settings, tools, and other advanced configurations, 
                    you need to access the ElevenLabs console directly.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>System Prompt & Conversation Settings</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Voice Selection & Speech Settings</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Tools & Webhook Configuration</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Knowledge Base & RAG Settings</span>
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => window.open('https://elevenlabs.io/app/conversational-ai', '_blank')}
                  >
                    Open ElevenLabs Console
                  </Button>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Note: Changes made in the ElevenLabs console will automatically sync with this dashboard.
                    Use the "Sync with ElevenLabs" button on the agents page to update the latest configuration.
                  </p>
                </div>
              </div>
            </Card>

            {/* Agent Details */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Agent Details
              </h3>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Agent ID</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-xs bg-muted p-2 rounded">{agent.elevenLabsAgentId}</code>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(agent.elevenLabsAgentId);
                        toast({ title: "Copied", description: "Agent ID copied to clipboard" });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                
                {agent.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm mt-1">{agent.description}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-muted-foreground">Created Date</p>
                  <p className="text-sm mt-1">
                    {agent.createdAt ? new Date(agent.createdAt).toLocaleString() : "Unknown"}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}