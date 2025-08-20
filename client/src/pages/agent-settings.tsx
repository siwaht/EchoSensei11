import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Save, ArrowLeft, Mic, Settings2, MessageSquare, Zap, Search, Play, 
  Volume2, Check, X, RotateCcw, Brain, Plus, Trash2,
  Globe, ChevronDown, ChevronRight, User, Shield, Webhook, Sheet,
  Calendar, Database, FileText, Sparkles, Edit2, Wrench, Phone,
  Languages, SkipForward, UserPlus, Voicemail, Hash
} from "lucide-react";
import type { Agent } from "@shared/schema";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    description?: string;
  };
  preview_url?: string;
}

export default function AgentSettings() {
  const { agentId } = useParams() as { agentId: string };
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    // Conversation settings
    firstMessage: "",
    systemPrompt: "",
    language: "en",
    
    // Voice settings
    voiceId: "",
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
    
    // LLM settings
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 150,
    
    
    // Dynamic variables
    dynamicVariables: {} as Record<string, string>,
    
    // Evaluation criteria
    evaluationEnabled: false,
    evaluationCriteria: [] as string[],
    
    // Data collection
    dataCollectionEnabled: false,
    dataCollectionFields: [] as Array<{ name: string; type: string; description?: string }>,
    
    // Custom prompt templates
    promptTemplates: [] as Array<{ id: string; name: string; content: string }>,
    
    // Tools configuration
    tools: {
      systemTools: {
        endCall: { enabled: true },
        detectLanguage: { enabled: true, supportedLanguages: [] },
        skipTurn: { enabled: true },
        transferToAgent: { enabled: false, targetAgentId: "" },
        transferToNumber: { enabled: false, phoneNumbers: [] },
        playKeypadTone: { enabled: false },
        voicemailDetection: { enabled: false, leaveMessage: false, messageContent: "" },
      },
      customTools: [] as Array<{ id: string; name: string; type: string; url?: string; enabled: boolean }>,
      mcpServers: [] as Array<{ id: string; name: string; url: string; enabled: boolean }>,
    } as any,
  });

  const [voiceSearch, setVoiceSearch] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    prompt: true,
    llm: false,
    variables: false,
    evaluation: false,
    collection: false,
    templates: false,
  });
  
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [systemTemplates, setSystemTemplates] = useState<any[]>([]);
  const [quickActionButtons, setQuickActionButtons] = useState<any[]>([]);

  // Fetch agent data
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agent = agents.find(a => a.id === agentId);

  // Fetch available voices
  const { data: voices = [], isLoading: voicesLoading } = useQuery<Voice[]>({
    queryKey: ["/api/voiceai/voices"],
    enabled: !!agent,
  });

  // Fetch system templates
  useEffect(() => {
    fetch("/api/system-templates")
      .then(res => res.json())
      .then(data => setSystemTemplates(data))
      .catch(err => console.error("Failed to fetch system templates:", err));
  }, []);

  // Fetch quick action buttons
  useEffect(() => {
    fetch("/api/quick-action-buttons")
      .then(res => res.json())
      .then(data => setQuickActionButtons(data.filter((b: any) => b.isActive)))
      .catch(err => console.error("Failed to fetch quick action buttons:", err));
  }, []);

  // Update settings when agent data is loaded
  useEffect(() => {
    if (agent) {
      setSettings({
        firstMessage: agent.firstMessage || "",
        systemPrompt: agent.systemPrompt || "",
        language: agent.language || "en",
        voiceId: agent.voiceId || "",
        stability: agent.voiceSettings?.stability || 0.5,
        similarityBoost: agent.voiceSettings?.similarityBoost || 0.75,
        style: agent.voiceSettings?.style || 0,
        useSpeakerBoost: agent.voiceSettings?.useSpeakerBoost ?? true,
        model: agent.llmSettings?.model || "gpt-4",
        temperature: agent.llmSettings?.temperature || 0.7,
        maxTokens: agent.llmSettings?.maxTokens || 150,
        dynamicVariables: agent.dynamicVariables || {},
        evaluationEnabled: agent.evaluationCriteria?.enabled || false,
        evaluationCriteria: agent.evaluationCriteria?.criteria || [],
        dataCollectionEnabled: agent.dataCollection?.enabled || false,
        dataCollectionFields: agent.dataCollection?.fields || [],
        promptTemplates: (agent as any).promptTemplates || [],
        tools: (agent as any).tools || {
          systemTools: {
            endCall: { enabled: true },
            detectLanguage: { enabled: true, supportedLanguages: [] },
            skipTurn: { enabled: true },
            transferToAgent: { enabled: false, targetAgentId: "" },
            transferToNumber: { enabled: false, phoneNumbers: [] },
            playKeypadTone: { enabled: false },
            voicemailDetection: { enabled: false, leaveMessage: false, messageContent: "" },
          },
          customTools: [],
          mcpServers: [],
        },
      });
    }
  }, [agent]);

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async (updates: Partial<Agent>) => {
      return await apiRequest("PATCH", `/api/agents/${agentId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent settings updated successfully" });
      setHasUnsavedChanges(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update agent settings", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const handleSave = () => {
    updateAgentMutation.mutate({
      firstMessage: settings.firstMessage,
      systemPrompt: settings.systemPrompt,
      language: settings.language,
      voiceId: settings.voiceId,
      voiceSettings: {
        stability: settings.stability,
        similarityBoost: settings.similarityBoost,
        style: settings.style,
        useSpeakerBoost: settings.useSpeakerBoost,
      },
      llmSettings: {
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      },
      dynamicVariables: settings.dynamicVariables,
      evaluationCriteria: {
        enabled: settings.evaluationEnabled,
        criteria: settings.evaluationCriteria,
      },
      dataCollection: {
        enabled: settings.dataCollectionEnabled,
        fields: settings.dataCollectionFields,
      },
      promptTemplates: settings.promptTemplates,
      tools: settings.tools,
    } as any);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const playVoicePreview = (voiceId: string, previewUrl: string) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      setCurrentAudio(null);
      return;
    }

    const audio = new Audio(previewUrl);
    audio.addEventListener('ended', () => {
      setPlayingVoiceId(null);
      setCurrentAudio(null);
    });
    
    audio.play().then(() => {
      setPlayingVoiceId(voiceId);
      setCurrentAudio(audio);
    }).catch(err => {
      toast({ 
        title: "Failed to play preview", 
        description: "Could not play voice preview",
        variant: "destructive" 
      });
    });
  };

  const addDynamicVariable = () => {
    const varName = `var_${Object.keys(settings.dynamicVariables).length + 1}`;
    setSettings({
      ...settings,
      dynamicVariables: { ...settings.dynamicVariables, [varName]: "" },
    });
    setHasUnsavedChanges(true);
  };

  const addEvaluationCriterion = () => {
    setSettings({
      ...settings,
      evaluationCriteria: [...settings.evaluationCriteria, ""],
    });
    setHasUnsavedChanges(true);
  };

  const addPromptTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      toast({
        title: "Template incomplete",
        description: "Please provide both a name and content for the template",
        variant: "destructive",
      });
      return;
    }

    const newTemplate = {
      id: Date.now().toString(),
      name: newTemplateName.trim(),
      content: newTemplateContent.trim(),
    };

    setSettings({
      ...settings,
      promptTemplates: [...settings.promptTemplates, newTemplate],
    });
    setHasUnsavedChanges(true);
    setNewTemplateName("");
    setNewTemplateContent("");
    
    toast({
      title: "Template added",
      description: `"${newTemplate.name}" template has been created`,
    });
  };

  const updatePromptTemplate = (id: string, name: string, content: string) => {
    setSettings({
      ...settings,
      promptTemplates: settings.promptTemplates.map(t => 
        t.id === id ? { ...t, name, content } : t
      ),
    });
    setHasUnsavedChanges(true);
    setEditingTemplateId(null);
  };

  const deletePromptTemplate = (id: string) => {
    const template = settings.promptTemplates.find(t => t.id === id);
    setSettings({
      ...settings,
      promptTemplates: settings.promptTemplates.filter(t => t.id !== id),
    });
    setHasUnsavedChanges(true);
    
    toast({
      title: "Template deleted",
      description: `"${template?.name}" template has been removed`,
    });
  };

  // Legacy function - replaced by system templates
  // Kept for any potential backward compatibility
  const insertSnippet = (type: string) => {
    // Not used anymore - system templates are used instead
  };

  const addDataField = () => {
    const newField = {
      name: "",
      type: "string",
      description: "",
    };
    setSettings({
      ...settings,
      dataCollectionFields: [...settings.dataCollectionFields, newField],
    });
    setHasUnsavedChanges(true);
  };

  const filteredVoices = voices.filter(voice => 
    voice.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    voice.labels?.accent?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    voice.labels?.gender?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    voice.labels?.description?.toLowerCase().includes(voiceSearch.toLowerCase())
  );

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Agent not found</h2>
          <p className="text-muted-foreground mb-4">The agent you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/agents")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setLocation("/agents")}
                data-testid="button-back"
                className="h-8 w-8"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1">
                <h1 className="text-lg font-semibold">Agent Settings</h1>
              </div>
            </div>
            <Button 
              onClick={handleSave}
              disabled={!hasUnsavedChanges || updateAgentMutation.isPending}
              size="sm"
              data-testid="button-save"
              className="h-8"
            >
              {updateAgentMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                  <span className="hidden sm:inline">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 sm:mr-2" />
                  <span className="hidden sm:inline">Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 max-w-6xl">
        {/* Agent Name and Test Button */}
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">{agent.name}</h2>
          <p className="text-sm text-muted-foreground mb-3">Configure your agent's behavior and capabilities</p>
          <Button 
            variant="outline" 
            onClick={() => setLocation('/playground')}
            className="w-full sm:w-auto"
            size="sm"
            data-testid="button-test"
          >
            <Play className="w-4 h-4 mr-2" />
            Test Agent
          </Button>
        </div>

        {hasUnsavedChanges && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
              You have unsaved changes. Click "Save" to apply them.
            </p>
          </div>
        )}

        {/* Settings Tabs */}
        <Tabs defaultValue="conversation" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full p-1">
            <TabsTrigger value="conversation" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1 px-1 py-2 sm:px-3">
              <MessageSquare className="w-4 h-4" />
              <span className="text-[10px] sm:text-sm">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1 px-1 py-2 sm:px-3">
              <FileText className="w-4 h-4" />
              <span className="text-[10px] sm:text-sm">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1 px-1 py-2 sm:px-3">
              <Mic className="w-4 h-4" />
              <span className="text-[10px] sm:text-sm">Voice</span>
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1 px-1 py-2 sm:px-3">
              <Brain className="w-4 h-4" />
              <span className="text-[10px] sm:text-sm">LLM</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1 px-1 py-2 sm:px-3">
              <Settings2 className="w-4 h-4" />
              <span className="text-[10px] sm:text-sm">More</span>
            </TabsTrigger>
          </TabsList>

          {/* Conversation Tab */}
          <TabsContent value="conversation" className="space-y-4 mt-4">
            <Card className="p-4">
              <h3 className="text-base font-semibold mb-4">Conversation Settings</h3>
              <div className="space-y-4">
                {/* First Message */}
                <div>
                  <Label htmlFor="first-message" className="text-sm">First Message</Label>
                  <Textarea
                    id="first-message"
                    placeholder="e.g., Hello! How can I help you today?"
                    value={settings.firstMessage}
                    onChange={(e) => {
                      setSettings({ ...settings, firstMessage: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                    className="min-h-[80px] text-sm"
                    data-testid="textarea-first-message"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The initial message your agent will say when starting a conversation
                  </p>
                </div>

                {/* System Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="system-prompt" className="text-sm">System Prompt</Label>
                    <span className="text-xs text-muted-foreground">Quick Actions</span>
                  </div>
                  
                  {/* Quick Action Buttons - Default Templates */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {/* Quick Action Buttons (System and User) */}
                    {quickActionButtons.map((button) => {
                      const iconMap: Record<string, any> = {
                        User, Shield, Webhook, Sheet, Calendar, Database, 
                        FileText, Sparkles, Zap, Globe, Brain, Wrench
                      };
                      const IconComponent = iconMap[button.icon] || Sparkles;
                      
                      return (
                        <Button
                          key={button.id}
                          type="button"
                          size="sm"
                          className={`h-8 px-3 text-xs gap-1.5 text-white border-0 ${button.color}`}
                          onClick={() => {
                            const currentPrompt = settings.systemPrompt || '';
                            const newPrompt = currentPrompt ? `${currentPrompt}\n\n${button.prompt}` : button.prompt;
                            setSettings({ ...settings, systemPrompt: newPrompt });
                            setHasUnsavedChanges(true);
                            toast({
                              title: "Quick action applied",
                              description: `"${button.name}" has been added to the system prompt`,
                            });
                          }}
                          data-testid={`button-quick-action-${button.id}`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                          {button.name}
                          {button.isSystem && (
                            <Shield className="w-3 h-3 ml-0.5 opacity-60" />
                          )}
                        </Button>
                      );
                    })}
                    
                    {/* Divider if there are quick action buttons */}
                    {quickActionButtons.length > 0 && (settings.promptTemplates.length > 0 || systemTemplates.length > 0) && (
                      <div className="w-full h-px bg-border my-1" />
                    )}
                    
                    {/* Custom Template Buttons */}
                    {settings.promptTemplates.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        size="sm"
                        className="h-8 px-3 text-xs gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white border-0"
                        onClick={() => {
                          const currentPrompt = settings.systemPrompt || '';
                          const newPrompt = currentPrompt ? `${currentPrompt}\n\n${template.content}` : template.content;
                          setSettings({ ...settings, systemPrompt: newPrompt });
                          setHasUnsavedChanges(true);
                          toast({
                            title: "Template inserted",
                            description: `"${template.name}" has been added to the system prompt`,
                          });
                        }}
                        data-testid={`button-custom-template-${template.id}`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {template.name}
                      </Button>
                    ))}
                    
                    {/* Divider if there are custom templates */}
                    {settings.promptTemplates.length > 0 && systemTemplates.length > 0 && (
                      <div className="w-full h-px bg-border my-1" />
                    )}
                    
                    {/* System Template Buttons (Admin-managed) */}
                    {systemTemplates.map((template) => {
                      const iconMap: Record<string, any> = {
                        User, Shield, Webhook, Sheet, Calendar, Database, Sparkles
                      };
                      const IconComponent = iconMap[template.icon] || FileText;
                      
                      return (
                        <Button
                          key={template.id}
                          type="button"
                          size="sm"
                          className={`h-8 px-3 text-xs gap-1.5 text-white border-0 ${template.color || 'bg-gray-500 hover:bg-gray-600'}`}
                          onClick={() => {
                            const currentPrompt = settings.systemPrompt || '';
                            const newPrompt = currentPrompt ? `${currentPrompt}\n\n${template.content}` : template.content;
                            setSettings({ ...settings, systemPrompt: newPrompt });
                            setHasUnsavedChanges(true);
                            toast({
                              title: "Template inserted",
                              description: `"${template.name}" has been added to the system prompt`,
                            });
                          }}
                          data-testid={`button-system-template-${template.id}`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                          {template.name}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Textarea
                    id="system-prompt"
                    placeholder="Define your agent's personality, knowledge, and behavior..."
                    value={settings.systemPrompt}
                    onChange={(e) => {
                      setSettings({ ...settings, systemPrompt: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                    className="min-h-[350px] max-h-[800px] text-sm resize-y font-mono"
                    data-testid="textarea-system-prompt"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Instructions that define how your agent should behave and respond
                  </p>
                </div>

                {/* Language */}
                <div>
                  <Label htmlFor="language" className="text-sm">Language</Label>
                  <Select
                    value={settings.language}
                    onValueChange={(value) => {
                      setSettings({ ...settings, language: value });
                      setHasUnsavedChanges(true);
                    }}
                  >
                    <SelectTrigger id="language" data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                      <SelectItem value="pt">Portuguese</SelectItem>
                      <SelectItem value="pl">Polish</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                      <SelectItem value="ko">Korean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Voice Selection */}
                <div>
                  <Label className="text-sm mb-2">Voice</Label>
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div>
                      <p className="font-medium text-sm">
                        {settings.voiceId ? 
                          (voices.find(v => v.voice_id === settings.voiceId)?.name || "Voice selected") : 
                          "No voice selected"
                        }
                      </p>
                      {settings.voiceId && voices.find(v => v.voice_id === settings.voiceId) && (
                        <p className="text-xs text-gray-500">
                          {voices.find(v => v.voice_id === settings.voiceId)?.labels?.accent || "Conversational"}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={() => setLocation("/voices")}
                      variant="outline"
                      size="sm"
                      data-testid="button-change-voice"
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      Select Voice
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose a voice from the Voice Library
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="voice" className="space-y-4 mt-4">
            <Card className="p-4">
              <h3 className="text-base font-semibold mb-4">Voice Settings</h3>
              
              {/* Voice Selection */}
              <div className="mb-6">
                <Label className="text-sm mb-2">Select Voice</Label>
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search voices..."
                      value={voiceSearch}
                      onChange={(e) => setVoiceSearch(e.target.value)}
                      className="pl-9 text-sm"
                      data-testid="input-voice-search"
                    />
                  </div>
                </div>
                
                {voicesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Loading voices...</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    {filteredVoices.map((voice) => (
                      <div
                        key={voice.voice_id}
                        className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                          settings.voiceId === voice.voice_id ? 'bg-primary/10' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          setSettings({ ...settings, voiceId: voice.voice_id });
                          setHasUnsavedChanges(true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{voice.name}</span>
                              {settings.voiceId === voice.voice_id && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {voice.labels?.accent && (
                                <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                  {voice.labels.accent}
                                </span>
                              )}
                              {voice.labels?.gender && (
                                <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                  {voice.labels.gender}
                                </span>
                              )}
                              {voice.labels?.age && (
                                <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                                  {voice.labels.age}
                                </span>
                              )}
                            </div>
                            {voice.labels?.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {voice.labels.description}
                              </p>
                            )}
                          </div>
                          {voice.preview_url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                playVoicePreview(voice.voice_id, voice.preview_url!);
                              }}
                              data-testid={`button-preview-${voice.voice_id}`}
                            >
                              {playingVoiceId === voice.voice_id ? (
                                <X className="w-4 h-4" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Voice Fine-tuning */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Stability</Label>
                    <span className="text-sm text-muted-foreground">{settings.stability.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[settings.stability]}
                    onValueChange={(value) => {
                      setSettings({ ...settings, stability: value[0] });
                      setHasUnsavedChanges(true);
                    }}
                    max={1}
                    step={0.01}
                    className="w-full"
                    data-testid="slider-stability"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Controls voice consistency. Lower values = more variation
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Similarity Boost</Label>
                    <span className="text-sm text-muted-foreground">{settings.similarityBoost.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[settings.similarityBoost]}
                    onValueChange={(value) => {
                      setSettings({ ...settings, similarityBoost: value[0] });
                      setHasUnsavedChanges(true);
                    }}
                    max={1}
                    step={0.01}
                    className="w-full"
                    data-testid="slider-similarity"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enhances voice similarity. Higher values = closer to original voice
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Style Exaggeration</Label>
                    <span className="text-sm text-muted-foreground">{settings.style.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[settings.style]}
                    onValueChange={(value) => {
                      setSettings({ ...settings, style: value[0] });
                      setHasUnsavedChanges(true);
                    }}
                    max={1}
                    step={0.01}
                    className="w-full"
                    data-testid="slider-style"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Amplifies the style of the original voice
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Speaker Boost</Label>
                    <p className="text-xs text-muted-foreground">Enhance voice clarity</p>
                  </div>
                  <Switch
                    checked={settings.useSpeakerBoost}
                    onCheckedChange={(checked) => {
                      setSettings({ ...settings, useSpeakerBoost: checked });
                      setHasUnsavedChanges(true);
                    }}
                    data-testid="switch-speaker-boost"
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* LLM Tab */}
          <TabsContent value="llm" className="space-y-4 mt-4">
            <Card className="p-4">
              <h3 className="text-base font-semibold mb-4">LLM Settings</h3>
              <div className="space-y-4">
                {/* Model Selection */}
                <div>
                  <Label htmlFor="model" className="text-sm">Model</Label>
                  <Select
                    value={settings.model}
                    onValueChange={(value) => {
                      setSettings({ ...settings, model: value });
                      setHasUnsavedChanges(true);
                    }}
                  >
                    <SelectTrigger id="model" data-testid="select-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                      <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                      <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperature */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Temperature</Label>
                    <span className="text-sm text-muted-foreground">{settings.temperature.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[settings.temperature]}
                    onValueChange={(value) => {
                      setSettings({ ...settings, temperature: value[0] });
                      setHasUnsavedChanges(true);
                    }}
                    max={2}
                    step={0.01}
                    className="w-full"
                    data-testid="slider-temperature"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Controls randomness. 0 = deterministic, 2 = very creative
                  </p>
                </div>

                {/* Max Tokens */}
                <div>
                  <Label htmlFor="max-tokens" className="text-sm">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    value={settings.maxTokens}
                    onChange={(e) => {
                      setSettings({ ...settings, maxTokens: parseInt(e.target.value) || 150 });
                      setHasUnsavedChanges(true);
                    }}
                    min={1}
                    max={4000}
                    className="text-sm"
                    data-testid="input-max-tokens"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum response length in tokens
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-4 mt-4">
            <Card className="p-4">
              <h3 className="text-base font-semibold mb-4">Advanced Settings</h3>
              
              <div className="space-y-4">
                {/* Dynamic Variables */}
                <div>
                  <button
                    onClick={() => toggleSection('variables')}
                    className="flex items-center justify-between w-full py-2 text-left hover:bg-muted/50 rounded-lg px-2 transition-colors"
                  >
                    <span className="text-sm font-medium">Dynamic Variables</span>
                    {expandedSections.variables ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {expandedSections.variables && (
                    <div className="mt-3 space-y-3 pl-2">
                      {Object.entries(settings.dynamicVariables).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <Input
                            value={key}
                            onChange={(e) => {
                              const newVars = { ...settings.dynamicVariables };
                              delete newVars[key];
                              newVars[e.target.value] = value;
                              setSettings({ ...settings, dynamicVariables: newVars });
                              setHasUnsavedChanges(true);
                            }}
                            placeholder="Variable name"
                            className="w-1/3 text-sm"
                          />
                          <Input
                            value={value}
                            onChange={(e) => {
                              setSettings({
                                ...settings,
                                dynamicVariables: { ...settings.dynamicVariables, [key]: e.target.value },
                              });
                              setHasUnsavedChanges(true);
                            }}
                            placeholder="Variable value"
                            className="flex-1 text-sm"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const newVars = { ...settings.dynamicVariables };
                              delete newVars[key];
                              setSettings({ ...settings, dynamicVariables: newVars });
                              setHasUnsavedChanges(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addDynamicVariable}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Variable
                      </Button>
                    </div>
                  )}
                </div>

                {/* Evaluation Criteria */}
                <div>
                  <button
                    onClick={() => toggleSection('evaluation')}
                    className="flex items-center justify-between w-full py-2 text-left hover:bg-muted/50 rounded-lg px-2 transition-colors"
                  >
                    <span className="text-sm font-medium">Evaluation Criteria</span>
                    {expandedSections.evaluation ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {expandedSections.evaluation && (
                    <div className="mt-3 space-y-3 pl-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Enable Evaluation</Label>
                        <Switch
                          checked={settings.evaluationEnabled}
                          onCheckedChange={(checked) => {
                            setSettings({ ...settings, evaluationEnabled: checked });
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                      
                      {settings.evaluationEnabled && (
                        <div className="space-y-2">
                          {settings.evaluationCriteria.map((criterion, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={criterion}
                                onChange={(e) => {
                                  const updated = [...settings.evaluationCriteria];
                                  updated[index] = e.target.value;
                                  setSettings({ ...settings, evaluationCriteria: updated });
                                  setHasUnsavedChanges(true);
                                }}
                                placeholder="Enter evaluation criterion"
                                className="text-sm"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSettings({
                                    ...settings,
                                    evaluationCriteria: settings.evaluationCriteria.filter((_, i) => i !== index),
                                  });
                                  setHasUnsavedChanges(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={addEvaluationCriterion}
                            className="gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Criterion
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Data Collection */}
                <div>
                  <button
                    onClick={() => toggleSection('collection')}
                    className="flex items-center justify-between w-full py-2 text-left hover:bg-muted/50 rounded-lg px-2 transition-colors"
                  >
                    <span className="text-sm font-medium">Data Collection</span>
                    {expandedSections.collection ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {expandedSections.collection && (
                    <div className="mt-3 space-y-3 pl-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Enable Data Collection</Label>
                        <Switch
                          checked={settings.dataCollectionEnabled}
                          onCheckedChange={(checked) => {
                            setSettings({ ...settings, dataCollectionEnabled: checked });
                            setHasUnsavedChanges(true);
                          }}
                        />
                      </div>
                      
                      {settings.dataCollectionEnabled && (
                        <div className="space-y-3">
                          {settings.dataCollectionFields.map((field, index) => (
                            <div key={index} className="p-3 border rounded-lg space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Input
                                  value={field.name}
                                  onChange={(e) => {
                                    const updated = [...settings.dataCollectionFields];
                                    updated[index].name = e.target.value;
                                    setSettings({ ...settings, dataCollectionFields: updated });
                                    setHasUnsavedChanges(true);
                                  }}
                                  placeholder="Field name"
                                  className="text-sm"
                                />
                                <Select
                                  value={field.type}
                                  onValueChange={(value) => {
                                    const updated = [...settings.dataCollectionFields];
                                    updated[index].type = value;
                                    setSettings({ ...settings, dataCollectionFields: updated });
                                    setHasUnsavedChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="boolean">Boolean</SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  value={field.description || ""}
                                  onChange={(e) => {
                                    const updated = [...settings.dataCollectionFields];
                                    updated[index].description = e.target.value;
                                    setSettings({ ...settings, dataCollectionFields: updated });
                                    setHasUnsavedChanges(true);
                                  }}
                                  placeholder="Description (optional)"
                                  className="flex-1 text-sm"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setSettings({
                                      ...settings,
                                      dataCollectionFields: settings.dataCollectionFields.filter((_, i) => i !== index),
                                    });
                                    setHasUnsavedChanges(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={addDataField}
                            className="gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Field
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}