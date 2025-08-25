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
  Languages, SkipForward, UserPlus, Voicemail, Hash, Wand2
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
    webhooks: false,
  });
  
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [systemTemplates, setSystemTemplates] = useState<any[]>([]);
  const [quickActionButtons, setQuickActionButtons] = useState<any[]>([]);
  
  // Prompt generation state
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptDescription, setPromptDescription] = useState("");

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

  // Generate prompt mutation
  const generatePromptMutation = useMutation({
    mutationFn: async (description: string) => {
      setIsGeneratingPrompt(true);
      const response = await apiRequest("POST", "/api/agents/generate-prompt", { description });
      return response.json();
    },
    onSuccess: (data) => {
      setSettings({ ...settings, systemPrompt: data.systemPrompt });
      setHasUnsavedChanges(true);
      toast({
        title: "Prompt Generated",
        description: "AI has generated a comprehensive system prompt based on your description",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGeneratingPrompt(false);
    },
  });

  const handleGeneratePrompt = () => {
    if (!promptDescription.trim() || promptDescription.trim().length < 10) {
      toast({
        title: "Description Too Short",
        description: "Please provide a more detailed description (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }
    generatePromptMutation.mutate(promptDescription);
  };

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
                    <Label htmlFor="system-prompt" className="text-sm flex items-center gap-2">
                      System Prompt
                      <Sparkles className="w-4 h-4 text-purple-500" />
                    </Label>
                    <span className="text-xs text-muted-foreground">Quick Actions</span>
                  </div>
                  
                  {/* AI Prompt Generator */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Wand2 className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                        AI Prompt Generator
                      </span>
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                      Describe your desired agent and we'll generate a comprehensive system prompt for you
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., a customer support agent for ElevenLabs"
                        value={promptDescription}
                        onChange={(e) => setPromptDescription(e.target.value)}
                        disabled={isGeneratingPrompt || updateAgentMutation.isPending}
                        className="flex-1 text-xs"
                        data-testid="input-prompt-description-settings"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleGeneratePrompt}
                        disabled={isGeneratingPrompt || !promptDescription.trim() || updateAgentMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3"
                        data-testid="button-generate-prompt-settings"
                      >
                        {isGeneratingPrompt ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                            <span className="text-xs">Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            <span className="text-xs">Generate</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Quick Action Buttons - Default Templates */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
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
                    
                    {/* Divider if there are system templates */}
                    {systemTemplates.length > 0 && settings.promptTemplates.length > 0 && (
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
                    disabled={isGeneratingPrompt}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Instructions that define how your agent should behave and respond. Use the AI generator above for assistance.
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

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4 mt-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Prompt Templates</h3>
                <Button
                  onClick={() => {
                    setNewTemplateName("");
                    setNewTemplateContent("");
                    setEditingTemplateId("new");
                  }}
                  size="sm"
                  className="gap-1"
                  data-testid="button-add-template"
                >
                  <Plus className="w-4 h-4" />
                  Add Template
                </Button>
              </div>
              
              <div className="space-y-3">
                {/* Template List */}
                {settings.promptTemplates.length === 0 && editingTemplateId !== "new" ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No templates created yet</p>
                    <p className="text-xs mt-1">Create your first template to quickly insert common prompts</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {settings.promptTemplates.map((template) => (
                      <div key={template.id} className="border rounded-lg p-3">
                        {editingTemplateId === template.id ? (
                          <div className="space-y-3">
                            <Input
                              value={template.name}
                              onChange={(e) => {
                                const updatedTemplates = settings.promptTemplates.map(t =>
                                  t.id === template.id ? { ...t, name: e.target.value } : t
                                );
                                setSettings({ ...settings, promptTemplates: updatedTemplates });
                                setHasUnsavedChanges(true);
                              }}
                              placeholder="Template name"
                              className="text-sm"
                            />
                            <Textarea
                              value={template.content}
                              onChange={(e) => {
                                const updatedTemplates = settings.promptTemplates.map(t =>
                                  t.id === template.id ? { ...t, content: e.target.value } : t
                                );
                                setSettings({ ...settings, promptTemplates: updatedTemplates });
                                setHasUnsavedChanges(true);
                              }}
                              placeholder="Template content"
                              className="min-h-[100px] text-sm font-mono"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => setEditingTemplateId(null)}
                                size="sm"
                                variant="outline"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Done
                              </Button>
                              <Button
                                onClick={() => {
                                  const updatedTemplates = settings.promptTemplates.filter(t => t.id !== template.id);
                                  setSettings({ ...settings, promptTemplates: updatedTemplates });
                                  setHasUnsavedChanges(true);
                                  setEditingTemplateId(null);
                                }}
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm mb-1">{template.name}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-2">{template.content}</p>
                            </div>
                            <div className="flex gap-1 ml-3">
                              <Button
                                onClick={() => {
                                  const currentPrompt = settings.systemPrompt || '';
                                  const newPrompt = currentPrompt ? `${currentPrompt}\n\n${template.content}` : template.content;
                                  setSettings({ ...settings, systemPrompt: newPrompt });
                                  setHasUnsavedChanges(true);
                                  toast({
                                    title: "Template applied",
                                    description: `"${template.name}" has been added to the system prompt`,
                                  });
                                }}
                                size="sm"
                                variant="outline"
                                className="h-8"
                              >
                                <Zap className="w-3 h-3 mr-1" />
                                Use
                              </Button>
                              <Button
                                onClick={() => setEditingTemplateId(template.id)}
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button
                                onClick={() => {
                                  const updatedTemplates = settings.promptTemplates.filter(t => t.id !== template.id);
                                  setSettings({ ...settings, promptTemplates: updatedTemplates });
                                  setHasUnsavedChanges(true);
                                  toast({
                                    title: "Template deleted",
                                    description: `"${template.name}" has been removed`,
                                  });
                                }}
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* New Template Form */}
                {editingTemplateId === "new" && (
                  <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                    <div>
                      <Label className="text-sm">Template Name</Label>
                      <Input
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="e.g., Customer Service Greeting"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Template Content</Label>
                      <Textarea
                        value={newTemplateContent}
                        onChange={(e) => setNewTemplateContent(e.target.value)}
                        placeholder="Enter the prompt text that will be inserted when using this template..."
                        className="min-h-[150px] text-sm font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          if (newTemplateName && newTemplateContent) {
                            const newTemplate = {
                              id: Date.now().toString(),
                              name: newTemplateName,
                              content: newTemplateContent
                            };
                            setSettings({
                              ...settings,
                              promptTemplates: [...settings.promptTemplates, newTemplate]
                            });
                            setHasUnsavedChanges(true);
                            setNewTemplateName("");
                            setNewTemplateContent("");
                            setEditingTemplateId(null);
                            toast({
                              title: "Template created",
                              description: `"${newTemplateName}" has been added to your templates`,
                            });
                          } else {
                            toast({
                              title: "Error",
                              description: "Please enter both name and content for the template",
                              variant: "destructive",
                            });
                          }
                        }}
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Create Template
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingTemplateId(null);
                          setNewTemplateName("");
                          setNewTemplateContent("");
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="voice" className="space-y-4 mt-4">
            <Card className="p-4">
              <h3 className="text-base font-semibold mb-4">Voice Fine-tuning</h3>
              
              {/* Currently Selected Voice */}
              <div className="mb-6">
                <Label className="text-sm mb-2">Selected Voice</Label>
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
                    Change Voice
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Select a different voice from the Voice Library
                </p>
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
                {/* Webhook Tools Configuration */}
                <div>
                  <button
                    onClick={() => toggleSection('webhooks')}
                    className="flex items-center justify-between w-full py-2 text-left hover:bg-muted/50 rounded-lg px-2 transition-colors"
                  >
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Webhook className="w-4 h-4" />
                      Webhook Tools
                    </span>
                    {expandedSections.webhooks ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {expandedSections.webhooks && (
                    <div className="mt-3 space-y-3 pl-2">
                      {/* RAG System Webhook */}
                      <Card className="p-4 border-2 border-primary/20 bg-primary/5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm mb-1 flex items-center gap-2">
                              <Database className="w-4 h-4" />
                              RAG System (Knowledge Base)
                            </h4>
                            <p className="text-xs text-muted-foreground mb-3">
                              Allow your voice agent to search your custom knowledge base during conversations.
                            </p>
                            
                            <div className="space-y-2">
                              <div className="bg-background rounded-lg p-3 border">
                                <p className="text-xs font-medium mb-2">Add this webhook to your agent in ElevenLabs:</p>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 font-mono break-all">
                                    {window.location.origin}/api/public/rag
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${window.location.origin}/api/public/rag`);
                                      toast({
                                        title: "Copied!",
                                        description: "Webhook URL copied to clipboard",
                                      });
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-xs font-medium mb-2">Configuration in ElevenLabs:</p>
                                <ul className="text-xs space-y-1 text-muted-foreground">
                                  <li>• Type: <span className="font-mono">Webhook</span></li>
                                  <li>• Method: <span className="font-mono">GET</span></li>
                                  <li>• Query Parameter: <span className="font-mono">query</span> (type: String)</li>
                                  <li>• Description: "Search the knowledge base for relevant information"</li>
                                </ul>
                              </div>
                              
                              <div className="flex items-center justify-between pt-2">
                                <span className="text-xs text-muted-foreground">
                                  Status: {settings.tools?.customTools?.find((t: any) => t.name === 'rag_search')?.enabled ? 
                                    <span className="text-green-600 font-medium">Active</span> : 
                                    <span className="text-yellow-600 font-medium">Not configured</span>
                                  }
                                </span>
                                <Switch
                                  checked={settings.tools?.customTools?.find((t: any) => t.name === 'rag_search')?.enabled || false}
                                  onCheckedChange={(checked) => {
                                    const newTools = { ...settings.tools };
                                    if (!newTools.customTools) newTools.customTools = [];
                                    const ragToolIndex = newTools.customTools.findIndex((t: any) => t.name === 'rag_search');
                                    if (ragToolIndex >= 0) {
                                      newTools.customTools[ragToolIndex].enabled = checked;
                                    } else {
                                      newTools.customTools.push({
                                        id: 'rag-webhook',
                                        name: 'rag_search',
                                        type: 'webhook',
                                        url: `${window.location.origin}/api/public/rag`,
                                        enabled: checked
                                      });
                                    }
                                    setSettings({ ...settings, tools: newTools });
                                    setHasUnsavedChanges(true);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                      
                      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-900">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          <strong>How to connect:</strong> Copy the webhook URL above, go to your agent in ElevenLabs, 
                          add a new "Webhook" tool, paste the URL, set method to GET, and add a query parameter named "query". 
                          Save the agent, and it will be able to search your knowledge base during conversations.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                

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