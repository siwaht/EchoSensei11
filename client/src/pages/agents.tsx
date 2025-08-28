import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Trash2, Eye, Play, RefreshCw, ExternalLink, HelpCircle, Settings } from "lucide-react";
import { AddAgentModal } from "@/components/modals/add-agent-modal";
import { AgentDetailModal } from "@/components/modals/agent-detail-modal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Agent } from "@shared/schema";

export default function Agents() {
  const [location, setLocation] = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const { toast } = useToast();

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete agent");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agent Removed",
        description: "The agent has been successfully removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
      setAgentToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to Remove Agent",
        description: error.message || "Could not remove the agent. Please try again.",
        variant: "destructive",
      });
      setAgentToDelete(null);
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/agents/sync", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sync agents");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Completed",
        description: `Successfully synced ${data.syncedCount} agents (${data.createdCount} new, ${data.updatedCount} updated)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/organization"] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync agents with ElevenLabs",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" : 
                     "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? "Active" : "Inactive";
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-full sm:w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Voice Agents
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400" data-testid="text-page-description">
            Manage your ElevenLabs conversational AI agents
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={() => syncMutation.mutate()} 
            variant="outline"
            disabled={syncMutation.isPending}
            className="w-full sm:w-auto" 
            data-testid="button-sync-agents"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync with ElevenLabs'}
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto" data-testid="button-add-agent">
            <Plus className="w-4 h-4 mr-2" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!agents || agents.length === 0 ? (
          <Card className="col-span-full p-12">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2" data-testid="text-no-agents-title">
                No agents configured yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto" data-testid="text-no-agents-description">
                Connect your ElevenLabs voice agents to monitor conversations, manage settings, and track performance.
              </p>
              
              {/* Quick Setup Steps */}
              <div className="max-w-md mx-auto mb-6 text-left space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-semibold">1</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Create an agent in ElevenLabs</p>
                    <p className="text-xs text-muted-foreground">Set up your conversational AI in ElevenLabs</p>
                    <a 
                      href="https://elevenlabs.io/conversational-ai" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      Go to ElevenLabs <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-semibold">2</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Get your Agent ID</p>
                    <p className="text-xs text-muted-foreground">Find it in your agent's settings page</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-semibold">3</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Add to your dashboard</p>
                    <p className="text-xs text-muted-foreground">Click below and enter your Agent ID</p>
                  </div>
                </div>
              </div>
              
              <Button onClick={() => setShowAddModal(true)} data-testid="button-add-first-agent" size="lg">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Agent
              </Button>
            </div>
          </Card>
        ) : (
          agents.map((agent) => (
            <Card 
              key={agent.id} 
              className="group relative flex flex-col h-full p-6 border-0 shadow-lg card-hover hover:shadow-2xl transition-all cursor-pointer overflow-hidden"
              onClick={() => setSelectedAgent(agent)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 gradient-purple rounded-xl flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <Badge className={cn(
                  "shadow-sm",
                  agent.isActive 
                    ? "bg-gradient-to-r from-green-500/20 to-green-600/20 text-green-700 dark:text-green-300 border-green-500/30" 
                    : "bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30"
                )} data-testid={`badge-status-${agent.id}`}>
                  {getStatusText(agent.isActive)}
                </Badge>
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2" data-testid={`text-agent-name-${agent.id}`}>
                  {agent.name}
                </h3>
                
                {agent.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2" data-testid={`text-agent-description-${agent.id}`}>
                    {agent.description}
                  </p>
                )}
                
                <div className="space-y-3 text-sm">
                <div className="flex flex-col space-y-1 min-w-0">
                  <span className="text-gray-600 dark:text-gray-400 text-xs">ElevenLabs ID:</span>
                  <div className="font-medium font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded overflow-hidden" data-testid={`text-agent-id-${agent.id}`}>
                    <span className="block truncate">{agent.elevenLabsAgentId}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="font-medium" data-testid={`text-agent-created-${agent.id}`}>
                    {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "Unknown"}
                  </span>
                </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full hover:bg-primary/10 hover:text-primary hover:border-primary transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/agent-settings?agentId=${agent.id}`);
                  }}
                  data-testid={`button-settings-${agent.id}`}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Agent Settings
                </Button>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 hover:bg-primary/10 hover:text-primary hover:border-primary transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/playground?agentId=${agent.id}`);
                        }}
                        data-testid={`button-test-${agent.id}`}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Test
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Test this agent in the playground</p>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAgentToDelete(agent);
                    }}
                    data-testid={`button-delete-${agent.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>

            </Card>
          ))
        )}
      </div>

      <AddAgentModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
      />
      
      <AgentDetailModal
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!agentToDelete} onOpenChange={(open) => !open && setAgentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{agentToDelete?.name}</strong>? 
              This action cannot be undone. Call logs associated with this agent will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => agentToDelete && deleteMutation.mutate(agentToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Removing..." : "Remove Agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
