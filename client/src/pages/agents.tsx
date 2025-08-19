import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Plus, MoreHorizontal, Search, ExternalLink, TestTube } from "lucide-react";
import { AddAgentModal } from "@/components/modals/add-agent-modal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { format } from "date-fns";
import type { Agent } from "@shared/schema";

export default function Agents() {
  const [location, setLocation] = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: user } = useQuery<{id: string, email?: string, name?: string}>({
    queryKey: ["/api/auth/user"],
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

  const filteredAgents = agents?.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Agents</h2>
            <p className="text-sm text-muted-foreground mt-1">Create and manage your AI agents</p>
          </div>
        </div>
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Agents</h2>
          <p className="text-sm text-muted-foreground mt-1">Create and manage your AI agents</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/playground">
            <Button variant="ghost" className="text-sm" data-testid="button-playground">
              Playground
            </Button>
          </Link>
          <Button 
            onClick={() => setShowAddModal(true)} 
            className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white" 
            data-testid="button-new-agent"
          >
            <Plus className="h-4 w-4 mr-2" />
            New agent
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-agents"
        />
      </div>

      {filteredAgents.length === 0 ? (
        <div className="bg-white dark:bg-gray-950 rounded-lg border">
          <div className="p-24 text-center">
            {searchQuery ? (
              <>
                <h3 className="text-lg font-medium mb-2">No agents found</h3>
                <p className="text-muted-foreground">
                  No agents match your search "{searchQuery}"
                </p>
              </>
            ) : agents && agents.length === 0 ? (
              <>
                <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No agents yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first voice agent to get started
                </p>
                <Button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white"
                  data-testid="button-create-first-agent"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Agent
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium mb-2">Loading agents...</h3>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-950 rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Created by</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Created at</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((agent) => (
                  <tr key={agent.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="p-4">
                      <Link href={`/agents/${agent.id}/settings`}>
                        <a className="font-medium hover:underline cursor-pointer" data-testid={`link-agent-${agent.id}`}>
                          {agent.name}
                        </a>
                      </Link>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {user?.email || user?.name || 'Unknown'}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {agent.createdAt ? format(new Date(agent.createdAt), 'MMM d, yyyy, h:mm a') : 'Unknown'}
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${agent.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => window.open(`/playground?agentId=${agent.id}`, '_blank')}
                            data-testid={`menu-test-${agent.id}`}
                          >
                            <TestTube className="h-4 w-4 mr-2" />
                            Test AI agent
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              const url = `/api/agents/${agent.id}/link?returnUrl=${encodeURIComponent(window.location.href)}`;
                              window.open(url, '_blank');
                            }}
                            data-testid={`menu-copy-link-${agent.id}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Copy link
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600 dark:text-red-400"
                            onClick={() => setAgentToDelete(agent)}
                            data-testid={`menu-delete-${agent.id}`}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddAgentModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
      />
      
      <AlertDialog open={!!agentToDelete} onOpenChange={(open) => !open && setAgentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{agentToDelete?.name}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => agentToDelete && deleteMutation.mutate(agentToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
