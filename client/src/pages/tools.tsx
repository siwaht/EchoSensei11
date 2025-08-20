import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Trash2, Save, Globe, Webhook, Code, Wrench, 
  ChevronDown, ChevronRight, Settings2, Zap, Hammer,
  Sheet, Calendar, CheckCircle, XCircle, Database,
  Brain, FileText, Upload, Search
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

interface GoogleSheetsConfig {
  spreadsheetId?: string;
  sheetName?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  operations?: string[]; // read, write, append
}

interface GoogleCalendarConfig {
  calendarId?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  operations?: string[]; // read, create, update, delete
}

interface RAGToolConfig {
  enabled: boolean;
  name: string;
  description?: string;
  vectorDatabase?: 'pinecone' | 'weaviate' | 'chroma' | 'qdrant';
  embeddingModel?: 'openai' | 'cohere' | 'huggingface';
  apiKey?: string;
  indexName?: string;
  namespace?: string;
  topK?: number;
  similarityThreshold?: number;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  knowledgeBases?: Array<{
    id: string;
    name: string;
    description?: string;
    documentCount?: number;
    lastUpdated?: string;
  }>;
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
    googleSheets: {
      enabled: false,
      config: {} as GoogleSheetsConfig,
    },
    googleCalendar: {
      enabled: false,
      config: {} as GoogleCalendarConfig,
    },
    ragTool: {
      enabled: false,
      name: 'Knowledge Base RAG',
      description: '',
      vectorDatabase: 'pinecone' as 'pinecone' | 'weaviate' | 'chroma' | 'qdrant',
      embeddingModel: 'openai' as 'openai' | 'cohere' | 'huggingface',
      apiKey: '',
      indexName: '',
      namespace: 'default',
      topK: 5,
      similarityThreshold: 0.7,
      maxTokens: 2000,
      temperature: 0.7,
      systemPrompt: '',
      knowledgeBases: [],
    } as RAGToolConfig,
  });

  // Load agent's tools configuration when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      const googleSheetsIntegration = selectedAgent.tools?.integrations?.find(i => i.type === 'google-sheets');
      const googleCalendarIntegration = selectedAgent.tools?.integrations?.find(i => i.type === 'google-calendar');
      const ragToolConfig = selectedAgent.tools?.customTools?.find(t => t.type === 'rag');
      
      setToolsConfig({
        webhooks: selectedAgent.tools?.webhooks || [],
        integrations: selectedAgent.tools?.integrations || [],
        customTools: selectedAgent.tools?.customTools || [],
        googleSheets: {
          enabled: googleSheetsIntegration?.enabled || false,
          config: googleSheetsIntegration?.configuration || {},
        },
        googleCalendar: {
          enabled: googleCalendarIntegration?.enabled || false,
          config: googleCalendarIntegration?.configuration || {},
        },
        ragTool: ragToolConfig?.configuration || {
          enabled: false,
          name: 'Knowledge Base RAG',
          description: '',
          vectorDatabase: 'pinecone',
          embeddingModel: 'openai',
          apiKey: '',
          indexName: '',
          namespace: 'default',
          topK: 5,
          similarityThreshold: 0.7,
          maxTokens: 2000,
          temperature: 0.7,
          systemPrompt: '',
          knowledgeBases: [],
        },
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

    // Build integrations array including Google services
    const integrations = [...toolsConfig.integrations];
    
    // Remove existing Google integrations
    const filteredIntegrations = integrations.filter(
      i => i.type !== 'google-sheets' && i.type !== 'google-calendar'
    );
    
    // Add Google Sheets if configured
    if (toolsConfig.googleSheets.enabled) {
      filteredIntegrations.push({
        id: 'google-sheets',
        name: 'Google Sheets',
        type: 'google-sheets',
        configuration: toolsConfig.googleSheets.config,
        enabled: true,
      });
    }
    
    // Add Google Calendar if configured
    if (toolsConfig.googleCalendar.enabled) {
      filteredIntegrations.push({
        id: 'google-calendar',
        name: 'Google Calendar',
        type: 'google-calendar',
        configuration: toolsConfig.googleCalendar.config,
        enabled: true,
      });
    }

    // Build custom tools array
    const customTools = [...toolsConfig.customTools.filter(t => t.type !== 'rag')];
    
    // Add RAG tool if configured
    if (toolsConfig.ragTool.enabled) {
      customTools.push({
        id: 'rag-tool',
        name: toolsConfig.ragTool.name,
        type: 'rag',
        configuration: toolsConfig.ragTool,
        enabled: true,
      });
    }

    updateAgentMutation.mutate({
      tools: {
        webhooks: toolsConfig.webhooks,
        integrations: filteredIntegrations,
        customTools: customTools,
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
            <div className="space-y-4">
              {/* Google Sheets Integration */}
              <Card className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <Sheet className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold">Google Sheets</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Read from and write to Google Sheets spreadsheets
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={toolsConfig.googleSheets.enabled}
                    onCheckedChange={(checked) => {
                      setToolsConfig({
                        ...toolsConfig,
                        googleSheets: {
                          ...toolsConfig.googleSheets,
                          enabled: checked,
                        },
                      });
                      setHasUnsavedChanges(true);
                    }}
                    data-testid="switch-google-sheets"
                  />
                </div>

                {toolsConfig.googleSheets.enabled && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sheets-spreadsheet-id" className="text-sm">Spreadsheet ID</Label>
                        <Input
                          id="sheets-spreadsheet-id"
                          placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                          value={toolsConfig.googleSheets.config.spreadsheetId || ""}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              googleSheets: {
                                ...toolsConfig.googleSheets,
                                config: {
                                  ...toolsConfig.googleSheets.config,
                                  spreadsheetId: e.target.value,
                                },
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          className="text-sm mt-1"
                          data-testid="input-sheets-spreadsheet-id"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sheets-sheet-name" className="text-sm">Sheet Name</Label>
                        <Input
                          id="sheets-sheet-name"
                          placeholder="e.g., Sheet1"
                          value={toolsConfig.googleSheets.config.sheetName || ""}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              googleSheets: {
                                ...toolsConfig.googleSheets,
                                config: {
                                  ...toolsConfig.googleSheets.config,
                                  sheetName: e.target.value,
                                },
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          className="text-sm mt-1"
                          data-testid="input-sheets-sheet-name"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="sheets-api-key" className="text-sm">Google Cloud API Key</Label>
                      <Input
                        id="sheets-api-key"
                        type="password"
                        placeholder="Enter your Google Cloud API key"
                        value={toolsConfig.googleSheets.config.apiKey || ""}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            googleSheets: {
                              ...toolsConfig.googleSheets,
                              config: {
                                ...toolsConfig.googleSheets.config,
                                apiKey: e.target.value,
                              },
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1"
                        data-testid="input-sheets-api-key"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Required for accessing your Google Sheets. Get it from Google Cloud Console.
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm">Operations</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['read', 'write', 'append'].map((operation) => {
                          const operations = toolsConfig.googleSheets.config.operations || [];
                          const isSelected = operations.includes(operation);
                          return (
                            <Button
                              key={operation}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                const newOperations = isSelected
                                  ? operations.filter(op => op !== operation)
                                  : [...operations, operation];
                                setToolsConfig({
                                  ...toolsConfig,
                                  googleSheets: {
                                    ...toolsConfig.googleSheets,
                                    config: {
                                      ...toolsConfig.googleSheets.config,
                                      operations: newOperations,
                                    },
                                  },
                                });
                                setHasUnsavedChanges(true);
                              }}
                              data-testid={`button-sheets-operation-${operation}`}
                            >
                              {isSelected && <CheckCircle className="w-3 h-3 mr-1" />}
                              {operation.charAt(0).toUpperCase() + operation.slice(1)}
                            </Button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select which operations the agent can perform on the spreadsheet
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Google Calendar Integration */}
              <Card className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold">Google Calendar</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Manage calendar events and scheduling
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={toolsConfig.googleCalendar.enabled}
                    onCheckedChange={(checked) => {
                      setToolsConfig({
                        ...toolsConfig,
                        googleCalendar: {
                          ...toolsConfig.googleCalendar,
                          enabled: checked,
                        },
                      });
                      setHasUnsavedChanges(true);
                    }}
                    data-testid="switch-google-calendar"
                  />
                </div>

                {toolsConfig.googleCalendar.enabled && (
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <Label htmlFor="calendar-id" className="text-sm">Calendar ID</Label>
                      <Input
                        id="calendar-id"
                        placeholder="e.g., primary or calendar-id@group.calendar.google.com"
                        value={toolsConfig.googleCalendar.config.calendarId || ""}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            googleCalendar: {
                              ...toolsConfig.googleCalendar,
                              config: {
                                ...toolsConfig.googleCalendar.config,
                                calendarId: e.target.value,
                              },
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1"
                        data-testid="input-calendar-id"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use "primary" for your main calendar or enter a specific calendar ID
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="calendar-api-key" className="text-sm">Google Cloud API Key</Label>
                      <Input
                        id="calendar-api-key"
                        type="password"
                        placeholder="Enter your Google Cloud API key"
                        value={toolsConfig.googleCalendar.config.apiKey || ""}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            googleCalendar: {
                              ...toolsConfig.googleCalendar,
                              config: {
                                ...toolsConfig.googleCalendar.config,
                                apiKey: e.target.value,
                              },
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1"
                        data-testid="input-calendar-api-key"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Required for accessing Google Calendar. Get it from Google Cloud Console.
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm">Operations</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['read', 'create', 'update', 'delete'].map((operation) => {
                          const operations = toolsConfig.googleCalendar.config.operations || [];
                          const isSelected = operations.includes(operation);
                          return (
                            <Button
                              key={operation}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                const newOperations = isSelected
                                  ? operations.filter(op => op !== operation)
                                  : [...operations, operation];
                                setToolsConfig({
                                  ...toolsConfig,
                                  googleCalendar: {
                                    ...toolsConfig.googleCalendar,
                                    config: {
                                      ...toolsConfig.googleCalendar.config,
                                      operations: newOperations,
                                    },
                                  },
                                });
                                setHasUnsavedChanges(true);
                              }}
                              data-testid={`button-calendar-operation-${operation}`}
                            >
                              {isSelected && <CheckCircle className="w-3 h-3 mr-1" />}
                              {operation.charAt(0).toUpperCase() + operation.slice(1)}
                            </Button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select which operations the agent can perform on the calendar
                      </p>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex gap-2">
                        <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                          <p className="font-medium">Setup Instructions</p>
                          <ol className="text-xs mt-1 space-y-1 list-decimal list-inside">
                            <li>Enable Google Calendar API in Google Cloud Console</li>
                            <li>Create an API key with calendar permissions</li>
                            <li>Share your calendar with the service account (if using service account)</li>
                            <li>Enter your calendar ID and API credentials above</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Other Integrations Coming Soon */}
              <Card className="p-4 sm:p-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <h4 className="text-base font-medium mb-2">More Integrations Coming Soon</h4>
                  <p className="text-sm">
                    Slack, Microsoft Teams, Salesforce, HubSpot, and more
                  </p>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Custom Tools Tab */}
          <TabsContent value="custom" className="space-y-4">
            {/* RAG Tool */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">RAG Knowledge Base</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      Retrieval-Augmented Generation with custom knowledge bases
                    </p>
                  </div>
                </div>
                <Switch
                  checked={toolsConfig.ragTool.enabled}
                  onCheckedChange={(checked) => {
                    setToolsConfig({
                      ...toolsConfig,
                      ragTool: {
                        ...toolsConfig.ragTool,
                        enabled: checked,
                      },
                    });
                    setHasUnsavedChanges(true);
                  }}
                  data-testid="switch-rag-tool"
                />
              </div>

              {toolsConfig.ragTool.enabled && (
                <div className="space-y-4 pt-4 border-t">
                  {/* Basic Configuration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="rag-name" className="text-sm">Tool Name</Label>
                      <Input
                        id="rag-name"
                        placeholder="e.g., Product Knowledge Base"
                        value={toolsConfig.ragTool.name}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            ragTool: {
                              ...toolsConfig.ragTool,
                              name: e.target.value,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1"
                        data-testid="input-rag-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rag-description" className="text-sm">Description</Label>
                      <Input
                        id="rag-description"
                        placeholder="Brief description of the knowledge base"
                        value={toolsConfig.ragTool.description || ""}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            ragTool: {
                              ...toolsConfig.ragTool,
                              description: e.target.value,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1"
                        data-testid="input-rag-description"
                      />
                    </div>
                  </div>

                  {/* Vector Database Configuration */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Vector Database Configuration
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="vector-db" className="text-sm">Vector Database</Label>
                        <Select
                          value={toolsConfig.ragTool.vectorDatabase}
                          onValueChange={(value: 'pinecone' | 'weaviate' | 'chroma' | 'qdrant') => {
                            setToolsConfig({
                              ...toolsConfig,
                              ragTool: {
                                ...toolsConfig.ragTool,
                                vectorDatabase: value,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                        >
                          <SelectTrigger className="text-sm mt-1" data-testid="select-vector-db">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pinecone">Pinecone</SelectItem>
                            <SelectItem value="weaviate">Weaviate</SelectItem>
                            <SelectItem value="chroma">Chroma</SelectItem>
                            <SelectItem value="qdrant">Qdrant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="embedding-model" className="text-sm">Embedding Model</Label>
                        <Select
                          value={toolsConfig.ragTool.embeddingModel}
                          onValueChange={(value: 'openai' | 'cohere' | 'huggingface') => {
                            setToolsConfig({
                              ...toolsConfig,
                              ragTool: {
                                ...toolsConfig.ragTool,
                                embeddingModel: value,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                        >
                          <SelectTrigger className="text-sm mt-1" data-testid="select-embedding-model">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI (text-embedding-ada-002)</SelectItem>
                            <SelectItem value="cohere">Cohere (embed-english-v3.0)</SelectItem>
                            <SelectItem value="huggingface">HuggingFace (all-MiniLM-L6-v2)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="rag-api-key" className="text-sm">API Key</Label>
                        <Input
                          id="rag-api-key"
                          type="password"
                          placeholder="Enter your vector database API key"
                          value={toolsConfig.ragTool.apiKey || ""}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              ragTool: {
                                ...toolsConfig.ragTool,
                                apiKey: e.target.value,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          className="text-sm mt-1"
                          data-testid="input-rag-api-key"
                        />
                      </div>
                      <div>
                        <Label htmlFor="index-name" className="text-sm">Index/Collection Name</Label>
                        <Input
                          id="index-name"
                          placeholder="e.g., product-docs-index"
                          value={toolsConfig.ragTool.indexName || ""}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              ragTool: {
                                ...toolsConfig.ragTool,
                                indexName: e.target.value,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          className="text-sm mt-1"
                          data-testid="input-index-name"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="namespace" className="text-sm">Namespace (Optional)</Label>
                      <Input
                        id="namespace"
                        placeholder="e.g., default"
                        value={toolsConfig.ragTool.namespace || ""}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            ragTool: {
                              ...toolsConfig.ragTool,
                              namespace: e.target.value,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1"
                        data-testid="input-namespace"
                      />
                    </div>
                  </div>

                  {/* Retrieval Settings */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      Retrieval Settings
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm">Top K Results</Label>
                          <span className="text-sm text-muted-foreground">{toolsConfig.ragTool.topK}</span>
                        </div>
                        <Slider
                          value={[toolsConfig.ragTool.topK || 5]}
                          onValueChange={(value) => {
                            setToolsConfig({
                              ...toolsConfig,
                              ragTool: {
                                ...toolsConfig.ragTool,
                                topK: value[0],
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          min={1}
                          max={20}
                          step={1}
                          className="w-full"
                          data-testid="slider-top-k"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Number of most relevant documents to retrieve
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm">Similarity Threshold</Label>
                          <span className="text-sm text-muted-foreground">
                            {(toolsConfig.ragTool.similarityThreshold || 0.7).toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={[toolsConfig.ragTool.similarityThreshold || 0.7]}
                          onValueChange={(value) => {
                            setToolsConfig({
                              ...toolsConfig,
                              ragTool: {
                                ...toolsConfig.ragTool,
                                similarityThreshold: value[0],
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          min={0}
                          max={1}
                          step={0.01}
                          className="w-full"
                          data-testid="slider-similarity"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Minimum similarity score for retrieved documents
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Generation Settings */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Generation Settings
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="max-tokens" className="text-sm">Max Response Tokens</Label>
                        <Input
                          id="max-tokens"
                          type="number"
                          placeholder="2000"
                          value={toolsConfig.ragTool.maxTokens || 2000}
                          onChange={(e) => {
                            setToolsConfig({
                              ...toolsConfig,
                              ragTool: {
                                ...toolsConfig.ragTool,
                                maxTokens: parseInt(e.target.value) || 2000,
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          className="text-sm mt-1"
                          data-testid="input-max-tokens"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm">Temperature</Label>
                          <span className="text-sm text-muted-foreground">
                            {(toolsConfig.ragTool.temperature || 0.7).toFixed(2)}
                          </span>
                        </div>
                        <Slider
                          value={[toolsConfig.ragTool.temperature || 0.7]}
                          onValueChange={(value) => {
                            setToolsConfig({
                              ...toolsConfig,
                              ragTool: {
                                ...toolsConfig.ragTool,
                                temperature: value[0],
                              },
                            });
                            setHasUnsavedChanges(true);
                          }}
                          min={0}
                          max={2}
                          step={0.01}
                          className="w-full"
                          data-testid="slider-temperature"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="system-prompt" className="text-sm">System Prompt for RAG</Label>
                      <Textarea
                        id="system-prompt"
                        placeholder="You are a helpful assistant with access to a knowledge base. Use the retrieved context to answer questions accurately..."
                        value={toolsConfig.ragTool.systemPrompt || ""}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            ragTool: {
                              ...toolsConfig.ragTool,
                              systemPrompt: e.target.value,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1 min-h-[100px]"
                        data-testid="textarea-system-prompt"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Instructions for how the agent should use retrieved knowledge
                      </p>
                    </div>
                  </div>

                  {/* Knowledge Base Management */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Knowledge Bases
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        data-testid="button-add-knowledge-base"
                      >
                        <Upload className="w-3 h-3" />
                        Upload Documents
                      </Button>
                    </div>
                    
                    {toolsConfig.ragTool.knowledgeBases?.length === 0 ? (
                      <div className="text-center py-6 border rounded-lg text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No knowledge bases configured</p>
                        <p className="text-xs mt-1">Upload documents to create your first knowledge base</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {toolsConfig.ragTool.knowledgeBases?.map((kb) => (
                          <div key={kb.id} className="p-3 border rounded-lg flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{kb.name}</p>
                              {kb.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{kb.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {kb.documentCount || 0} documents • Last updated {kb.lastUpdated || 'Never'}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-delete-kb-${kb.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="flex gap-2">
                      <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5" />
                      <div className="text-sm text-purple-800 dark:text-purple-200">
                        <p className="font-medium">RAG Setup Guide</p>
                        <ol className="text-xs mt-1 space-y-1 list-decimal list-inside">
                          <li>Choose your vector database provider and get an API key</li>
                          <li>Create an index/collection in your vector database</li>
                          <li>Select an embedding model that matches your use case</li>
                          <li>Upload documents to build your knowledge base</li>
                          <li>Configure retrieval settings for optimal performance</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Other Custom Tools Coming Soon */}
            <Card className="p-4 sm:p-6">
              <div className="text-center py-8 text-muted-foreground">
                <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <h4 className="text-base font-medium mb-2">More Custom Tools Coming Soon</h4>
                <p className="text-sm">
                  API connectors, custom functions, workflow automation, and more
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}