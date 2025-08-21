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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Trash2, Save, Globe, Webhook, Code, Wrench, 
  ChevronDown, ChevronRight, Settings2, Zap, Hammer,
  Sheet, Calendar, Mail, CheckCircle, XCircle, Database,
  Brain, FileText, Upload, Search, Phone, Languages,
  SkipForward, UserPlus, Voicemail, Hash, Server,
  Mic, AudioLines, Bot, Key, Shield, Sparkles, Settings
} from "lucide-react";
import type { Agent } from "@shared/schema";
import { SystemToolConfigModal } from "@/components/tools/system-tool-config-modal";

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

interface GoogleGmailConfig {
  email?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  operations?: string[]; // read, send, reply, forward, delete
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    googleGmail: {
      enabled: false,
      config: {} as GoogleGmailConfig,
    },
    ragTool: {
      enabled: false,
      name: 'Knowledge Base RAG',
      description: '',
      vectorDatabase: 'lancedb' as 'pinecone' | 'weaviate' | 'chroma' | 'qdrant' | 'lancedb',
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
      const tools = selectedAgent.tools as any || {};
      const googleSheetsIntegration = tools.integrations?.find((i: any) => i.type === 'google-sheets');
      const googleCalendarIntegration = tools.integrations?.find((i: any) => i.type === 'google-calendar');
      const googleGmailIntegration = tools.integrations?.find((i: any) => i.type === 'google-gmail');
      const ragToolConfig = tools.customTools?.find((t: any) => t.type === 'rag');
      
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
        webhooks: tools.webhooks || [],
        integrations: tools.integrations || [],
        customTools: tools.customTools || [],
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
        ragTool: ragToolConfig?.configuration || {
          enabled: false,
          name: 'Knowledge Base RAG',
          description: '',
          vectorDatabase: 'lancedb',
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
        systemTools: toolsConfig.systemTools,
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!selectedAgentId) {
      toast({
        title: "No agent selected",
        description: "Please select an agent before uploading documents",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      // Initialize the vector database if needed
      await fetch('/api/vector-db/initialize', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          apiKey: toolsConfig.ragTool.apiKey || undefined 
        }),
      });

      // Prepare FormData for file upload
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      formData.append('agentId', selectedAgentId);

      // Upload the files
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload documents');
      }

      const data = await response.json();
      
      // Count successful uploads
      const successCount = data.results.filter((r: any) => r.success).length;
      const failedCount = data.results.filter((r: any) => !r.success).length;
      
      if (successCount > 0) {
        // Update knowledge bases list
        const newKnowledgeBase = {
          id: `kb_${Date.now()}`,
          name: `Upload ${new Date().toLocaleString()}`,
          description: `${successCount} document${successCount > 1 ? 's' : ''} uploaded`,
          documentCount: successCount,
          lastUpdated: new Date().toISOString(),
        };
        
        setToolsConfig({
          ...toolsConfig,
          ragTool: {
            ...toolsConfig.ragTool,
            knowledgeBases: [...(toolsConfig.ragTool.knowledgeBases || []), newKnowledgeBase],
          },
        });
        setHasUnsavedChanges(true);
        
        toast({
          title: "Documents uploaded successfully",
          description: `${successCount} document${successCount > 1 ? 's' : ''} processed and indexed${failedCount > 0 ? `. ${failedCount} failed.` : ''}`,
        });
      } else {
        throw new Error('All document uploads failed');
      }
      
      // Display individual errors if any
      data.results.filter((r: any) => !r.success).forEach((r: any) => {
        toast({
          title: `Failed to process ${r.fileName}`,
          description: r.error,
          variant: "destructive"
        });
      });
      
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload documents",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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

                    <div>
                      <Label htmlFor="gmail-api-key" className="text-sm">
                        API Key
                      </Label>
                      <Input
                        id="gmail-api-key"
                        type="password"
                        placeholder="Enter your Google API key"
                        value={toolsConfig.googleGmail.config.apiKey || ""}
                        onChange={(e) => {
                          setToolsConfig({
                            ...toolsConfig,
                            googleGmail: {
                              ...toolsConfig.googleGmail,
                              config: {
                                ...toolsConfig.googleGmail.config,
                                apiKey: e.target.value,
                              },
                            },
                          });
                          setHasUnsavedChanges(true);
                        }}
                        className="text-sm mt-1"
                        data-testid="input-gmail-api-key"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Required for accessing Gmail. Get it from Google Cloud Console.
                      </p>
                    </div>

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
                    
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                        <div className="text-sm text-green-800 dark:text-green-200">
                          <p className="font-medium">Open Source LanceDB (Free)</p>
                          <p className="text-xs mt-1">No external services required - runs locally on your server</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="openai-api-key" className="text-sm">
                        OpenAI API Key (Optional - for better embeddings)
                      </Label>
                      <Input
                        id="openai-api-key"
                        type="password"
                        placeholder="sk-... (Leave empty to use free local embeddings)"
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
                        data-testid="input-openai-api-key"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        If provided, OpenAI embeddings will be used for better search accuracy
                      </p>
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
                        Knowledge Base Documents
                      </h4>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          multiple
                          accept=".txt,.pdf,.docx,.doc,.md,.csv,.json"
                          className="hidden"
                          data-testid="input-file-upload"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          data-testid="button-upload-documents"
                        >
                          {uploading ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3" />
                              Upload Documents
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Supported formats: Text (.txt), PDF (.pdf), Word (.docx, .doc), Markdown (.md), CSV (.csv), JSON (.json)
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
                        <p className="font-medium">Quick Start Guide</p>
                        <ol className="text-xs mt-1 space-y-1 list-decimal list-inside">
                          <li>Upload your documents (PDFs, Word docs, text files, etc.)</li>
                          <li>Documents are automatically processed and indexed</li>
                          <li>Optionally add an OpenAI API key for better search accuracy</li>
                          <li>Configure retrieval settings for optimal performance</li>
                          <li>Your agent can now answer questions using the knowledge base</li>
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
    </div>
  );
}