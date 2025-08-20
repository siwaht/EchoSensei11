import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Trash2, Save, Globe, Webhook, Code, Wrench, 
  ChevronDown, ChevronRight, Settings2, Zap, Hammer
} from "lucide-react";
import type { Agent } from "@shared/schema";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: string;
  description?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
}

interface ToolConfig {
  id: string;
  name: string;
  type: string;
  configuration: Record<string, any>;
  enabled: boolean;
}

export default function Tools() {
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    webhooks: true,
    integrations: false,
    custom: false,
  });

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  // Tool configurations state
  const [toolsConfig, setToolsConfig] = useState({
    webhooks: [] as WebhookConfig[],
    integrations: [] as ToolConfig[],
    customTools: [] as ToolConfig[],
  });

  // Load agent's tools configuration when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      setToolsConfig({
        webhooks: selectedAgent.tools?.webhooks || [],
        integrations: selectedAgent.tools?.integrations || [],
        customTools: selectedAgent.tools?.customTools || [],
      });
    }
  }, [selectedAgent]);

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async (updates: Partial<Agent>) => {
      if (!selectedAgentId) throw new Error("No agent selected");
      return await apiRequest("PATCH", `/api/agents/${selectedAgentId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Tools configuration updated successfully" });
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update tools configuration", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const handleSave = () => {
    if (!selectedAgentId) {
      toast({ 
        title: "No agent selected", 
        description: "Please select an agent first",
        variant: "destructive" 
      });
      return;
    }

    updateAgentMutation.mutate({
      tools: {
        webhooks: toolsConfig.webhooks,
        integrations: toolsConfig.integrations,
        customTools: toolsConfig.customTools,
        toolIds: [], // Maintain backward compatibility
      },
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addWebhook = () => {
    const newWebhook: WebhookConfig = {
      id: `webhook_${Date.now()}`,
      name: "",
      url: "",
      method: "POST",
      description: "",
      headers: {},
      enabled: true,
    };
    setToolsConfig({
      ...toolsConfig,
      webhooks: [...toolsConfig.webhooks, newWebhook],
    });
    setHasUnsavedChanges(true);
  };

  const updateWebhook = (index: number, updates: Partial<WebhookConfig>) => {
    const updated = [...toolsConfig.webhooks];
    updated[index] = { ...updated[index], ...updates };
    setToolsConfig({ ...toolsConfig, webhooks: updated });
    setHasUnsavedChanges(true);
  };

  const deleteWebhook = (index: number) => {
    setToolsConfig({
      ...toolsConfig,
      webhooks: toolsConfig.webhooks.filter((_, i) => i !== index),
    });
    setHasUnsavedChanges(true);
  };

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading tools configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Tools Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure webhooks, integrations, and custom tools for your agents
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={selectedAgentId || ""}
            onValueChange={setSelectedAgentId}
          >
            <SelectTrigger className="flex-1 sm:w-[200px]" data-testid="select-agent">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || !selectedAgentId || updateAgentMutation.isPending}
            data-testid="button-save"
          >
            {updateAgentMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You have unsaved changes. Click "Save" to apply them.
          </p>
        </div>
      )}

      {!selectedAgentId ? (
        <Card className="p-8">
          <div className="text-center">
            <Hammer className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-2">Select an Agent</h3>
            <p className="text-muted-foreground">
              Choose an agent from the dropdown above to configure its tools
            </p>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="webhooks" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="w-4 h-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">Custom</span>
            </TabsTrigger>
          </TabsList>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">Webhooks</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Configure external API endpoints that your agent can trigger
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={addWebhook}
                  data-testid="button-add-webhook"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Webhook</span>
                </Button>
              </div>

              <div className="space-y-3">
                {toolsConfig.webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No webhooks configured</p>
                    <p className="text-sm mt-1">Add a webhook to get started</p>
                  </div>
                ) : (
                  toolsConfig.webhooks.map((webhook, index) => (
                    <div key={webhook.id} className="p-4 border rounded-lg space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          placeholder="Webhook name"
                          value={webhook.name}
                          onChange={(e) => updateWebhook(index, { name: e.target.value })}
                          className="text-sm"
                          data-testid={`input-webhook-name-${index}`}
                        />
                        <Select
                          value={webhook.method}
                          onValueChange={(value) => updateWebhook(index, { method: value })}
                        >
                          <SelectTrigger className="text-sm" data-testid={`select-webhook-method-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Input
                        placeholder="https://api.example.com/webhook"
                        value={webhook.url}
                        onChange={(e) => updateWebhook(index, { url: e.target.value })}
                        className="text-sm"
                        data-testid={`input-webhook-url-${index}`}
                      />
                      
                      <div className="flex gap-2">
                        <Input
                          placeholder="Description (optional)"
                          value={webhook.description || ""}
                          onChange={(e) => updateWebhook(index, { description: e.target.value })}
                          className="flex-1 text-sm"
                          data-testid={`input-webhook-description-${index}`}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteWebhook(index)}
                          data-testid={`button-delete-webhook-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">Integrations</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Connect your agent to external services and APIs
                  </p>
                </div>
              </div>

              <div className="text-center py-12 text-muted-foreground">
                <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h4 className="text-lg font-medium mb-2">Coming Soon</h4>
                <p className="text-sm">
                  Integration with popular services like Slack, Teams, CRM systems, and more
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* Custom Tools Tab */}
          <TabsContent value="custom" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold">Custom Tools</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Build and configure custom tools for your agent
                  </p>
                </div>
              </div>

              <div className="text-center py-12 text-muted-foreground">
                <Code className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h4 className="text-lg font-medium mb-2">Coming Soon</h4>
                <p className="text-sm">
                  Create custom functions, scripts, and tools for advanced agent capabilities
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}