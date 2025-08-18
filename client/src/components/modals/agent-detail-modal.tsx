import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Calendar, Clock, DollarSign, Activity, Settings } from "lucide-react";
import type { Agent, CallLog } from "@shared/schema";

interface AgentDetailModalProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentDetailModal({ agent, open, onOpenChange }: AgentDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: callLogs } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs", agent?.id],
    enabled: !!agent?.id && open,
  });

  const toggleAgentMutation = useMutation({
    mutationFn: async () => {
      if (!agent) return;
      await apiRequest("/api/agents/" + agent.id, "PATCH", { isActive: !agent.isActive });
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
      <DialogContent className="max-w-4xl">
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

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calls">Call History</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
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

          <TabsContent value="calls" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Recent Calls</h3>
              <p className="text-sm text-muted-foreground">{totalCalls} total calls</p>
            </div>
            
            {agentCalls.length === 0 ? (
              <Card className="p-8 text-center">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2">No calls yet</h4>
                <p className="text-sm text-muted-foreground">
                  Calls will appear here once your agent starts receiving interactions.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {agentCalls.slice(0, 10).map((call) => (
                  <Card key={call.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Call #{call.elevenLabsCallId?.slice(-8) || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">
                          {call.createdAt ? new Date(call.createdAt).toLocaleString() : "Unknown"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{Math.round((call.duration || 0) / 60)} min</p>
                        <p className="text-sm text-muted-foreground">${call.cost || "0.00"}</p>
                      </div>
                    </div>
                    {call.transcript && (
                      <p className="text-sm mt-2 text-muted-foreground line-clamp-2">
                        {call.transcript.substring(0, 150)}...
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Agent Settings
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Agent Status</p>
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
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}