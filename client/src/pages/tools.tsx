import { useState, useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Trash2, Save, Globe, Code, Wrench, Webhook,
  ChevronDown, ChevronRight, Settings2, Zap, Hammer,
  Sheet, Calendar, Mail, CheckCircle, XCircle, Database,
  Brain, FileText, Upload, Search, Phone, Languages,
  SkipForward, UserPlus, Voicemail, Hash, Server,
  Mic, AudioLines, Bot, Key, Shield, Sparkles, Settings,
  Info, RefreshCw, File
} from "lucide-react";
import type { Agent, CustomTool } from "@shared/schema";
import { SystemToolConfigModal } from "@/components/tools/system-tool-config-modal";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { MCPServerDialog } from "@/components/mcp-server-dialog";
import { WebhookToolDialog } from "@/components/webhook-tool-dialog";

interface WebhookParameter {
  name: string;
  type?: string;
  required?: boolean;
  valueType?: string;
  description?: string;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description?: string;
  enabled?: boolean;
  type?: 'webhook';
  webhookConfig?: {
    responseTimeout?: number;
    disableInterruptions?: boolean;
    preToolSpeech?: 'auto' | 'force' | 'none';
    authentication?: {
      type?: string;
      credentials?: any;
    };
    headers?: Array<{
      key: string;
      value: string;
      enabled: boolean;
    }>;
    pathParameters?: Array<{
      key: string;
      description?: string;
    }>;
    queryParameters?: Array<{
      key: string;
      description?: string;
      required?: boolean;
      dataType?: 'String' | 'Number' | 'Boolean' | 'Object' | 'Array';
      valueType?: 'LLM Prompt' | 'Static' | 'Dynamic Variable';
    }>;
    bodyParameters?: Array<{
      identifier: string;
      dataType: 'String' | 'Number' | 'Boolean' | 'Object' | 'Array';
      description?: string;
      required?: boolean;
      valueType: 'LLM Prompt' | 'Static' | 'Dynamic Variable';
    }>;
    dynamicVariables?: Record<string, string>;
    dynamicVariableAssignments?: Array<{
      variable: string;
      jsonPath: string;
    }>;
  };
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

interface GoogleGmailConfig {
  email?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  operations?: string[]; // read, send, reply, forward, delete
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
  const [systemToolModal, setSystemToolModal] = useState<{
    isOpen: boolean;
    toolType: string;
    toolName: string;
  }>({ isOpen: false, toolType: "", toolName: "" });
  const [mcpServerDialog, setMcpServerDialog] = useState<{
    isOpen: boolean;
    server?: CustomTool;
  }>({ isOpen: false });
  const [webhookDialog, setWebhookDialog] = useState<{
    isOpen: boolean;
    webhook?: any;
  }>({ isOpen: false });

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const selectedAgent = agents.find(a => a.id === selectedAgentId);


  // Tool configurations state
  const [toolsConfig, setToolsConfig] = useState({
    systemTools: {
      endCall: { enabled: true, description: 'Allows agent to end the call' },
      detectLanguage: { enabled: true, description: 'Automatically detect and switch languages', supportedLanguages: [] },
      skipTurn: { enabled: true, description: 'Skip agent turn when user needs a moment' },
      transferToAgent: { enabled: false, description: 'Transfer to another AI agent', targetAgentId: '' },
      transferToNumber: { enabled: false, description: 'Transfer to human operator', phoneNumbers: [] },
      playKeypadTone: { enabled: false, description: 'Play keypad touch tones' },
      voicemailDetection: { enabled: false, description: 'Detect voicemail systems', leaveMessage: false, messageContent: '' },
    },
    conversationInitiationWebhook: {
      enabled: false,
      url: '',
      description: 'Fetch initiation client data from webhook when receiving Twilio or SIP trunk calls',
    },
    postCallWebhook: {
      enabled: false,
      url: '',
      description: 'Override the post-call webhook configured in settings for this agent',
    },
    webhooks: [] as WebhookConfig[],
    integrations: [] as ToolConfig[],
    customTools: [] as ToolConfig[],
    mcpServers: [] as CustomTool[],
    googleSheets: {
      enabled: false,
      config: {} as GoogleSheetsConfig,
    },
    googleCalendar: {
      enabled: false,
      config: {} as GoogleCalendarConfig,
    },
    googleGmail: {
      enabled: false,
      config: {} as GoogleGmailConfig,
    },
  });

  // Load agent's tools configuration when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      const tools = selectedAgent.tools as any || {};
      const googleSheetsIntegration = tools.integrations?.find((i: any) => i.type === 'google-sheets');
      const googleCalendarIntegration = tools.integrations?.find((i: any) => i.type === 'google-calendar');
      const googleGmailIntegration = tools.integrations?.find((i: any) => i.type === 'google-gmail');
            const mcpServers = tools.customTools?.filter((t: any) => t.type === 'mcp') || [];
      
      // Ensure each system tool has proper defaults
      const systemTools = tools.systemTools || {};
      
      setToolsConfig({
        systemTools: {
          endCall: systemTools.endCall || { enabled: true, description: 'Allows agent to end the call' },
          detectLanguage: systemTools.detectLanguage || { enabled: true, description: 'Automatically detect and switch languages', supportedLanguages: [] },
          skipTurn: systemTools.skipTurn || { enabled: true, description: 'Skip agent turn when user needs a moment' },
          transferToAgent: systemTools.transferToAgent || { enabled: false, description: 'Transfer to another AI agent', targetAgentId: '' },
          transferToNumber: systemTools.transferToNumber || { enabled: false, description: 'Transfer to human operator', phoneNumbers: [] },
          playKeypadTone: systemTools.playKeypadTone || { enabled: false, description: 'Play keypad touch tones' },
          voicemailDetection: systemTools.voicemailDetection || { enabled: false, description: 'Detect voicemail systems', leaveMessage: false, messageContent: '' },
        },
        conversationInitiationWebhook: tools.conversationInitiationWebhook || {
          enabled: false,
          url: '',
          description: 'Fetch initiation client data from webhook when receiving Twilio or SIP trunk calls',
        },
        postCallWebhook: tools.postCallWebhook || {
          enabled: false,
          url: '',
          description: 'Override the post-call webhook configured in settings for this agent',
        },
        webhooks: tools.webhooks || [],
        integrations: tools.integrations || [],
        customTools: tools.customTools?.filter((t: any) => t.type !== 'mcp') || [],
        mcpServers: mcpServers,
        googleSheets: {
          enabled: googleSheetsIntegration?.enabled || false,
          config: googleSheetsIntegration?.configuration || {},
        },
        googleCalendar: {
          enabled: googleCalendarIntegration?.enabled || false,
          config: googleCalendarIntegration?.configuration || {},
        },
        googleGmail: {
          enabled: googleGmailIntegration?.enabled || false,
          config: googleGmailIntegration?.configuration || {},
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
      i => i.type !== 'google-sheets' && i.type !== 'google-calendar' && i.type !== 'google-gmail'
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
    
    // Add Gmail if configured
    if (toolsConfig.googleGmail.enabled) {
      filteredIntegrations.push({
        id: 'google-gmail',
        name: 'Gmail',
        type: 'google-gmail',
        configuration: toolsConfig.googleGmail.config,
        enabled: true,
      });
    }

    // Build custom tools array
    const customTools = [...toolsConfig.customTools.filter(t => t.type !== 'mcp')];
    
    // Add MCP servers to custom tools
    if (toolsConfig.mcpServers && toolsConfig.mcpServers.length > 0) {
      customTools.push(...toolsConfig.mcpServers);
    }

    updateAgentMutation.mutate({
      tools: {
        systemTools: toolsConfig.systemTools,
        conversationInitiationWebhook: toolsConfig.conversationInitiationWebhook,
        postCallWebhook: toolsConfig.postCallWebhook,
        webhooks: toolsConfig.webhooks,
        integrations: filteredIntegrations as any,
        customTools: customTools as any,
        toolIds: [], // Maintain backward compatibility
      } as any,
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const addWebhook = () => {
    setWebhookDialog({ isOpen: true });
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
        <Tabs defaultValue="system" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="system" className="gap-2">
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
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

          {/* System Tools Tab */}
          <TabsContent value="system" className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-base sm:text-lg font-semibold">ElevenLabs System Tools</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Configure built-in conversational AI tools that control agent behavior
                </p>
              </div>

              <div className="space-y-3">
                {/* End Call Tool */}
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">End call</p>
                      <p className="text-sm text-muted-foreground">
                        Gives agent the ability to end the call with the user
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSystemToolModal({ isOpen: true, toolType: "endCall", toolName: "End call" })}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Switch
                      checked={toolsConfig.systemTools?.endCall?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          systemTools: {
                            ...toolsConfig.systemTools,
                            endCall: { ...(toolsConfig.systemTools?.endCall || {}), enabled: checked },
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-tool-end-call"
                    />
                  </div>
                </div>

                {/* Detect Language Tool */}
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Languages className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Detect language</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically detects and switches to the user's language
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSystemToolModal({ isOpen: true, toolType: "detectLanguage", toolName: "Detect language" })}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Switch
                      checked={toolsConfig.systemTools?.detectLanguage?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          systemTools: {
                            ...toolsConfig.systemTools,
                            detectLanguage: { ...(toolsConfig.systemTools?.detectLanguage || {}), enabled: checked },
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-tool-detect-language"
                    />
                  </div>
                </div>

                {/* Skip Turn Tool */}
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <SkipForward className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Skip turn</p>
                      <p className="text-sm text-muted-foreground">
                        Agent will skip its turn if user explicitly indicates they need a moment
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSystemToolModal({ isOpen: true, toolType: "skipTurn", toolName: "Skip turn" })}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Switch
                      checked={toolsConfig.systemTools?.skipTurn?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          systemTools: {
                            ...toolsConfig.systemTools,
                            skipTurn: { ...(toolsConfig.systemTools?.skipTurn || {}), enabled: checked },
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-tool-skip-turn"
                    />
                  </div>
                </div>

                {/* Transfer to Agent Tool */}
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <UserPlus className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Transfer to agent</p>
                      <p className="text-sm text-muted-foreground">
                        Gives agent the ability to transfer the call to another AI agent
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSystemToolModal({ isOpen: true, toolType: "transferToAgent", toolName: "Transfer to agent" })}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Switch
                      checked={toolsConfig.systemTools?.transferToAgent?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          systemTools: {
                            ...toolsConfig.systemTools,
                            transferToAgent: { ...(toolsConfig.systemTools?.transferToAgent || {}), enabled: checked },
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-tool-transfer-agent"
                    />
                  </div>
                </div>

                {/* Transfer to Number Tool */}
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Phone className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Transfer to number</p>
                      <p className="text-sm text-muted-foreground">
                        Gives agent the ability to transfer the call to a human
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSystemToolModal({ isOpen: true, toolType: "transferToNumber", toolName: "Transfer to number" })}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Switch
                      checked={toolsConfig.systemTools?.transferToNumber?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          systemTools: {
                            ...toolsConfig.systemTools,
                            transferToNumber: { ...(toolsConfig.systemTools?.transferToNumber || {}), enabled: checked },
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-tool-transfer-number"
                    />
                  </div>
                </div>

                {/* Play Keypad Touch Tone Tool */}
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                      <Hash className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Play keypad touch tone</p>
                      <p className="text-sm text-muted-foreground">
                        Gives agent the ability to play keypad touch tones during a phone call
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSystemToolModal({ isOpen: true, toolType: "playKeypadTone", toolName: "Play keypad touch tone" })}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Switch
                      checked={toolsConfig.systemTools?.playKeypadTone?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          systemTools: {
                            ...toolsConfig.systemTools,
                            playKeypadTone: { ...(toolsConfig.systemTools?.playKeypadTone || {}), enabled: checked },
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-tool-keypad-tone"
                    />
                  </div>
                </div>

                {/* Voicemail Detection Tool */}
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <Voicemail className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Voicemail detection</p>
                      <p className="text-sm text-muted-foreground">
                        Allows agent to detect voicemail systems and optionally leave a message
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSystemToolModal({ isOpen: true, toolType: "voicemailDetection", toolName: "Voicemail detection" })}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Switch
                      checked={toolsConfig.systemTools?.voicemailDetection?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          systemTools: {
                            ...toolsConfig.systemTools,
                            voicemailDetection: { ...(toolsConfig.systemTools?.voicemailDetection || {}), enabled: checked },
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-tool-voicemail"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Platform Webhooks Section */}
            <Card className="p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-base sm:text-lg font-semibold">Platform Webhooks</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Configure webhook settings for conversation initiation and post-call processing
                </p>
              </div>

              <div className="space-y-3">
                {/* Conversation Initiation Webhook */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Fetch initiation client data from webhook</p>
                      <p className="text-sm text-muted-foreground">
                        If enabled, the conversation initiation client data will be fetched from the webhook defined in the settings when receiving Twilio or SIP trunk calls
                      </p>
                    </div>
                    <Switch
                      checked={toolsConfig.conversationInitiationWebhook?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          conversationInitiationWebhook: {
                            ...toolsConfig.conversationInitiationWebhook,
                            enabled: checked,
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-conversation-initiation-webhook"
                    />
                  </div>
                  {toolsConfig.conversationInitiationWebhook?.enabled && (
                    <Input
                      placeholder="Webhook URL (e.g., https://api.example.com/initiation)"
                      value={toolsConfig.conversationInitiationWebhook?.url || ''}
                      onChange={(e) => {
                        setToolsConfig({
                          ...toolsConfig,
                          conversationInitiationWebhook: {
                            ...toolsConfig.conversationInitiationWebhook,
                            url: e.target.value,
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      className="text-sm"
                      data-testid="input-conversation-initiation-webhook-url"
                    />
                  )}
                </div>

                {/* Post-Call Webhook */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Post-Call Webhook</p>
                      <p className="text-sm text-muted-foreground">
                        Override the post-call webhook configured in settings for this agent
                      </p>
                    </div>
                    <Switch
                      checked={toolsConfig.postCallWebhook?.enabled || false}
                      onCheckedChange={(checked) => {
                        setToolsConfig({
                          ...toolsConfig,
                          postCallWebhook: {
                            ...toolsConfig.postCallWebhook,
                            enabled: checked,
                          },
                        });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid="switch-post-call-webhook"
                    />
                  </div>
                  {toolsConfig.postCallWebhook?.enabled && (
                    <div className="space-y-3">
                      <Input
                        placeholder="Webhook URL (e.g., https://api.example.com/post-call)"
                        value={toolsConfig.postCallWebhook?.url || ''}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            postCallWebhook: {
                              ...toolsConfig.postCallWebhook,
                              url: e.target.value,
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm"
                        data-testid="input-post-call-webhook-url"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          // Add webhook creation logic here
                          toast({
                            title: "Create Webhook",
                            description: "This will open the webhook creation modal",
                          });
                        }}
                      >
                        Create Webhook
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

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
                  onClick={() => setWebhookDialog({ isOpen: true })}
                  data-testid="button-add-webhook"
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Webhook</span>
                </Button>
              </div>

              <div className="space-y-3">
                {toolsConfig.webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Webhook className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No webhooks configured</p>
                    <p className="text-sm mt-1">Add a webhook to get started</p>
                  </div>
                ) : (
                  toolsConfig.webhooks.map((webhook, index) => (
                    <div key={webhook.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{webhook.name || 'Unnamed Webhook'}</p>
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                              {webhook.method || 'GET'}
                            </span>
                            {webhook.enabled && (
                              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
                                Active
                              </span>
                            )}
                          </div>
                          {webhook.description && (
                            <p className="text-sm text-muted-foreground mt-1">{webhook.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            URL: {webhook.url || 'Not configured'}
                          </p>
                          {webhook.webhookConfig?.responseTimeout && (
                            <p className="text-xs text-muted-foreground">
                              Timeout: {webhook.webhookConfig.responseTimeout}s
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Switch
                            checked={webhook.enabled !== false}
                            onCheckedChange={(checked) => {
                              const updatedWebhooks = [...toolsConfig.webhooks];
                              updatedWebhooks[index] = { ...webhook, enabled: checked };
                              setToolsConfig({
                                ...toolsConfig,
                                webhooks: updatedWebhooks,
                              });
                              setHasUnsavedChanges(true);
                            }}
                            data-testid={`switch-webhook-${index}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setWebhookDialog({ isOpen: true, webhook })}
                            data-testid={`button-edit-webhook-${index}`}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteWebhook(index)}
                            data-testid={`button-delete-webhook-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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

                    <GoogleAuthButton
                      onAuthSuccess={() => {
                        toast({ title: "Google account connected successfully" });
                      }}
                      onAuthError={(error) => {
                        toast({ 
                          title: "Failed to connect Google account",
                          description: error,
                          variant: "destructive"
                        });
                      }}
                    />

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

                    <GoogleAuthButton
                      onAuthSuccess={() => {
                        toast({ title: "Google account connected successfully" });
                      }}
                      onAuthError={(error) => {
                        toast({ 
                          title: "Failed to connect Google account",
                          description: error,
                          variant: "destructive"
                        });
                      }}
                    />

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

              {/* Gmail Integration */}
              <Card className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold">Gmail</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Read, send, and manage Gmail messages
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={toolsConfig.googleGmail.enabled}
                    onCheckedChange={(checked) => {
                      setToolsConfig({
                        ...toolsConfig,
                        googleGmail: {
                          ...toolsConfig.googleGmail,
                          enabled: checked,
                        },
                      });
                      setHasUnsavedChanges(true);
                    }}
                    data-testid="switch-google-gmail"
                  />
                </div>

                {toolsConfig.googleGmail.enabled && (
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <Label htmlFor="gmail-email" className="text-sm">Email Address</Label>
                      <Input
                        id="gmail-email"
                        type="email"
                        placeholder="your.email@gmail.com"
                        value={toolsConfig.googleGmail.config.email || ""}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            googleGmail: {
                              ...toolsConfig.googleGmail,
                              config: {
                                ...toolsConfig.googleGmail.config,
                                email: e.target.value,
                              },
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1"
                        data-testid="input-gmail-email"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        The Gmail account to connect to
                      </p>
                    </div>

                    <GoogleAuthButton
                      onAuthSuccess={() => {
                        toast({ title: "Google account connected successfully" });
                      }}
                      onAuthError={(error) => {
                        toast({ 
                          title: "Failed to connect Google account",
                          description: error,
                          variant: "destructive"
                        });
                      }}
                    />

                    <div>
                      <Label className="text-sm">Operations</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['read', 'send', 'reply', 'forward', 'delete'].map((operation) => {
                          const operations = toolsConfig.googleGmail.config.operations || [];
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
                                  googleGmail: {
                                    ...toolsConfig.googleGmail,
                                    config: {
                                      ...toolsConfig.googleGmail.config,
                                      operations: newOperations,
                                    },
                                  },
                                });
                                setHasUnsavedChanges(true);
                              }}
                              data-testid={`button-gmail-operation-${operation}`}
                            >
                              {isSelected && <CheckCircle className="w-3 h-3 mr-1" />}
                              {operation.charAt(0).toUpperCase() + operation.slice(1)}
                            </Button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select which operations the agent can perform on Gmail
                      </p>
                    </div>

                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex gap-2">
                        <Mail className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                        <div className="text-sm text-red-800 dark:text-red-200">
                          <p className="font-medium">Setup Instructions</p>
                          <ol className="text-xs mt-1 space-y-1 list-decimal list-inside">
                            <li>Enable Gmail API in Google Cloud Console</li>
                            <li>Create an API key with Gmail permissions</li>
                            <li>Configure OAuth 2.0 consent screen if needed</li>
                            <li>Enter your email address and API credentials above</li>
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
            {/* Empty State - Custom Tools Coming Soon */}
            <Card className="p-8">
              <div className="flex flex-col items-center text-center">
                <Wrench className="h-12 w-12 text-muted-foreground mb-3" />
                <h4 className="text-lg font-semibold mb-2">Custom Tools</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Custom tools and integrations are coming soon
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  For RAG (Retrieval-Augmented Generation) configuration, please use the dedicated RAG System tab from the navigation menu.
                </p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* System Tool Configuration Modal */}
      {systemToolModal.isOpen && (
        <SystemToolConfigModal
          isOpen={systemToolModal.isOpen}
          onClose={() => setSystemToolModal({ isOpen: false, toolType: "", toolName: "" })}
          toolType={systemToolModal.toolType}
          toolName={systemToolModal.toolName}
          config={toolsConfig.systemTools?.[systemToolModal.toolType as keyof typeof toolsConfig.systemTools] || { enabled: false }}
          onSave={(config) => {
            setToolsConfig({
              ...toolsConfig,
              systemTools: {
                ...toolsConfig.systemTools,
                [systemToolModal.toolType]: config,
              },
            });
            setHasUnsavedChanges(true);
            setSystemToolModal({ isOpen: false, toolType: "", toolName: "" });
          }}
          availableAgents={agents}
        />
      )}

      {/* MCP Server Dialog */}
      {mcpServerDialog.isOpen && (
        <MCPServerDialog
          isOpen={mcpServerDialog.isOpen}
          onClose={() => setMcpServerDialog({ isOpen: false })}
          server={mcpServerDialog.server}
          onSave={(server) => {
            const updatedServers = [...(toolsConfig.mcpServers || [])];
            if (mcpServerDialog.server) {
              // Edit existing server
              const index = updatedServers.findIndex(s => s.id === mcpServerDialog.server?.id);
              if (index !== -1) {
                updatedServers[index] = server;
              }
            } else {
              // Add new server
              updatedServers.push(server);
            }
            setToolsConfig({
              ...toolsConfig,
              mcpServers: updatedServers,
            });
            setHasUnsavedChanges(true);
            setMcpServerDialog({ isOpen: false });
          }}
        />
      )}

      {/* Webhook Tool Dialog */}
      {webhookDialog.isOpen && (
        <WebhookToolDialog
          isOpen={webhookDialog.isOpen}
          onClose={() => setWebhookDialog({ isOpen: false })}
          webhook={webhookDialog.webhook}
          onSave={(webhook) => {
            const updatedWebhooks = [...(toolsConfig.webhooks || [])];
            if (webhookDialog.webhook) {
              // Edit existing webhook
              const index = updatedWebhooks.findIndex(w => w.id === webhookDialog.webhook?.id);
              if (index !== -1) {
                updatedWebhooks[index] = webhook;
              }
            } else {
              // Add new webhook
              updatedWebhooks.push(webhook);
            }
            setToolsConfig({
              ...toolsConfig,
              webhooks: updatedWebhooks,
            });
            setHasUnsavedChanges(true);
            setWebhookDialog({ isOpen: false });
          }}
        />
      )}
    </div>
  );
}