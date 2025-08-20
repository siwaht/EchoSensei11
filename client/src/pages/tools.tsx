import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Trash2, Save, Globe, Webhook, Code, Wrench, 
  ChevronDown, ChevronRight, Settings2, Zap, Hammer,
  Sheet, Calendar, CheckCircle, XCircle
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
  });

  // Load agent's tools configuration when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      const googleSheetsIntegration = selectedAgent.tools?.integrations?.find(i => i.type === 'google-sheets');
      const googleCalendarIntegration = selectedAgent.tools?.integrations?.find(i => i.type === 'google-calendar');
      
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

    updateAgentMutation.mutate({
      tools: {
        webhooks: toolsConfig.webhooks,
        integrations: filteredIntegrations,
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