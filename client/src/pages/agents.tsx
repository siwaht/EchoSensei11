import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus } from "lucide-react";
import { AddAgentModal } from "@/components/modals/add-agent-modal";
import { useToast } from "@/hooks/use-toast";
import type { Agent } from "@shared/schema";

export default function Agents() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Voice Agents
          </h2>
          <p className="text-gray-600 dark:text-gray-400" data-testid="text-page-description">
            Manage your ElevenLabs voice agents
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} data-testid="button-add-agent">
          <Plus className="w-4 h-4 mr-2" />
          Add Agent
        </Button>
      </div>

      {/* Agents Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!agents || agents.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2" data-testid="text-no-agents-title">
              No agents configured
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4" data-testid="text-no-agents-description">
              Add your first ElevenLabs agent to start monitoring voice interactions.
            </p>
            <Button onClick={() => setShowAddModal(true)} data-testid="button-add-first-agent">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Agent
            </Button>
          </div>
        ) : (
          agents.map((agent) => (
            <Card key={agent.id} className="p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center">
                  <Bot className="w-6 h-6 text-primary-600" />
                </div>
                <Badge className={getStatusColor(agent.isActive)} data-testid={`badge-status-${agent.id}`}>
                  {getStatusText(agent.isActive)}
                </Badge>
              </div>
              
              <h3 className="text-lg font-semibold mb-2" data-testid={`text-agent-name-${agent.id}`}>
                {agent.name}
              </h3>
              
              {agent.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4" data-testid={`text-agent-description-${agent.id}`}>
                  {agent.description}
                </p>
              )}
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">ElevenLabs ID:</span>
                  <span className="font-medium font-mono text-xs" data-testid={`text-agent-id-${agent.id}`}>
                    {agent.elevenLabsAgentId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <span className="font-medium" data-testid={`text-agent-created-${agent.id}`}>
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" size="sm" data-testid={`button-view-details-${agent.id}`}>
                  View Details
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <AddAgentModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
      />
    </div>
  );
}
