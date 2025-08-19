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
  Volume2, Check, X, RotateCcw, Brain, Database, Wrench, Plus, Trash2,
  Globe, ChevronDown, ChevronRight, FileText, Link, Code
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
    
    // Knowledge base settings
    useRag: false,
    maxChunks: 5,
    vectorDistance: 0.8,
    embeddingModel: "e5_mistral_7b_instruct",
    documents: [] as Array<{ id: string; name: string; type: string; url?: string }>,
    
    // Tools settings
    toolIds: [] as string[],
    webhooks: [] as Array<{ id: string; name: string; url: string; method: string; description?: string }>,
    
    // Dynamic variables
    dynamicVariables: {} as Record<string, string>,
    
    // Evaluation criteria
    evaluationEnabled: false,
    evaluationCriteria: [] as string[],
    
    // Data collection
    dataCollectionEnabled: false,
    dataCollectionFields: [] as Array<{ name: string; type: string; description?: string }>,
  });

  const [voiceSearch, setVoiceSearch] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    prompt: true,
    llm: false,
    knowledge: false,
    tools: false,
    variables: false,
    evaluation: false,
    collection: false,
  });

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
        useRag: agent.knowledgeBase?.useRag || false,
        maxChunks: agent.knowledgeBase?.maxChunks || 5,
        vectorDistance: agent.knowledgeBase?.vectorDistance || 0.8,
        embeddingModel: agent.knowledgeBase?.embeddingModel || "e5_mistral_7b_instruct",
        documents: agent.knowledgeBase?.documents || [],
        toolIds: agent.tools?.toolIds || [],
        webhooks: agent.tools?.webhooks || [],
        dynamicVariables: agent.dynamicVariables || {},
        evaluationEnabled: agent.evaluationCriteria?.enabled || false,
        evaluationCriteria: agent.evaluationCriteria?.criteria || [],
        dataCollectionEnabled: agent.dataCollection?.enabled || false,
        dataCollectionFields: agent.dataCollection?.fields || [],
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
      knowledgeBase: {
        useRag: settings.useRag,
        maxChunks: settings.maxChunks,
        vectorDistance: settings.vectorDistance,
        embeddingModel: settings.embeddingModel,
        documents: settings.documents,
      },
      tools: {
        toolIds: settings.toolIds,
        webhooks: settings.webhooks,
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
    });
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

  const addWebhook = () => {
    const newWebhook = {
      id: `webhook_${Date.now()}`,
      name: "",
      url: "",
      method: "POST",
      description: "",
    };
    setSettings({
      ...settings,
      webhooks: [...settings.webhooks, newWebhook],
    });
    setHasUnsavedChanges(true);
  };

  const removeWebhook = (id: string) => {
    setSettings({
      ...settings,
      webhooks: settings.webhooks.filter(w => w.id !== id),
    });
    setHasUnsavedChanges(true);
  };

  const updateWebhook = (id: string, field: string, value: string) => {
    setSettings({
      ...settings,
      webhooks: settings.webhooks.map(w => 
        w.id === id ? { ...w, [field]: value } : w
      ),
    });
    setHasUnsavedChanges(true);
  };

  const addDynamicVariable = () => {
    const varName = `var_${Date.now()}`;
    setSettings({
      ...settings,
      dynamicVariables: { ...settings.dynamicVariables, [varName]: "" },
    });
    setHasUnsavedChanges(true);
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

  // Filter voices based on search
  const filteredVoices = voices.filter(voice => {
    const searchTerm = voiceSearch.toLowerCase();
    return voice.name.toLowerCase().includes(searchTerm) ||
           voice.category?.toLowerCase().includes(searchTerm) ||
           voice.labels?.accent?.toLowerCase().includes(searchTerm) ||
           voice.labels?.gender?.toLowerCase().includes(searchTerm) ||
           voice.labels?.age?.toLowerCase().includes(searchTerm);
  });

  if (agentsLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        <p>Loading agent settings...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        <p>Agent not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/agents")}
          className="mb-3 sm:mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Agents
        </Button>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Agent Settings</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Configure {agent.name}'s behavior, voice, and capabilities
            </p>
          </div>
          
          <Button
            onClick={handleSave}
            disabled={updateAgentMutation.isPending || !hasUnsavedChanges}
            className="gap-2 w-full sm:w-auto"
            data-testid="button-save-settings"
          >
            <Save className="w-4 h-4" />
            {updateAgentMutation.isPending ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="conversation" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-6 gap-1 h-auto p-1">
          <TabsTrigger value="conversation" className="gap-1 text-xs sm:text-sm">
            <MessageSquare className="w-3 h-3" />
            <span className="hidden sm:inline">Conversation</span>
            <span className="sm:hidden">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-1 text-xs sm:text-sm">
            <Mic className="w-3 h-3" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="llm" className="gap-1 text-xs sm:text-sm">
            <Brain className="w-3 h-3" />
            LLM
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1 text-xs sm:text-sm">
            <Database className="w-3 h-3" />
            <span className="hidden sm:inline">Knowledge</span>
            <span className="sm:hidden">KB</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1 text-xs sm:text-sm">
            <Wrench className="w-3 h-3" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-1 text-xs sm:text-sm">
            <Settings2 className="w-3 h-3" />
            <span className="hidden sm:inline">Advanced</span>
            <span className="sm:hidden">More</span>
          </TabsTrigger>
        </TabsList>

        {/* Conversation Tab */}
        <TabsContent value="conversation" className="space-y-4">
          <Card className="p-4 sm:p-6">
            <div className="space-y-4">
              {/* First Message */}
              <div>
                <Label htmlFor="first-message">First Message</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Initial greeting when conversation starts
                </p>
                <Textarea
                  id="first-message"
                  value={settings.firstMessage}
                  onChange={(e) => {
                    setSettings({ ...settings, firstMessage: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Hello! How can I help you today?"
                  rows={3}
                  className="resize-none"
                  data-testid="textarea-first-message"
                />
              </div>

              {/* System Prompt */}
              <div>
                <Label htmlFor="system-prompt">System Prompt</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Main behavior instructions for your agent
                </p>
                <Textarea
                  id="system-prompt"
                  value={settings.systemPrompt}
                  onChange={(e) => {
                    setSettings({ ...settings, systemPrompt: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="You are a helpful assistant..."
                  rows={6}
                  className="resize-none font-mono text-sm"
                  data-testid="textarea-system-prompt"
                />
              </div>

              {/* Language */}
              <div>
                <Label htmlFor="language">Default Language</Label>
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
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Voice Tab */}
        <TabsContent value="voice" className="space-y-4">
          <Card className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Voice Selection</h3>
            {voicesLoading ? (
              <p className="text-muted-foreground">Loading voices...</p>
            ) : (
              <div className="space-y-4">
                {/* Voice Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search voices..."
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-voice-search"
                  />
                </div>

                {/* Voice List */}
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {filteredVoices.map((voice) => (
                    <Card
                      key={voice.voice_id}
                      className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                        settings.voiceId === voice.voice_id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSettings({ ...settings, voiceId: voice.voice_id });
                        setHasUnsavedChanges(true);
                      }}
                      data-testid={`voice-card-${voice.voice_id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {settings.voiceId === voice.voice_id && (
                              <Check className="w-4 h-4 text-primary" />
                            )}
                            <span className="font-medium">{voice.name}</span>
                          </div>
                          {voice.labels && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(voice.labels).filter(([_, value]) => value).map(([key, value]) => (
                                <span key={key} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                  {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {voice.preview_url && (
                          <Button
                            type="button"
                            size="sm"
                            variant={playingVoiceId === voice.voice_id ? "default" : "outline"}
                            onClick={(e) => {
                              e.stopPropagation();
                              playVoicePreview(voice.voice_id, voice.preview_url!);
                            }}
                            data-testid={`button-preview-${voice.voice_id}`}
                          >
                            {playingVoiceId === voice.voice_id ? (
                              <Volume2 className="w-3 h-3 animate-pulse" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Voice Fine-tuning */}
                {settings.voiceId && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium">Voice Fine-tuning</h4>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label>Stability</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(settings.stability * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[settings.stability]}
                        onValueChange={([value]) => {
                          setSettings({ ...settings, stability: value });
                          setHasUnsavedChanges(true);
                        }}
                        max={1}
                        step={0.01}
                        className="w-full"
                        data-testid="slider-stability"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <Label>Similarity Boost</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(settings.similarityBoost * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[settings.similarityBoost]}
                        onValueChange={([value]) => {
                          setSettings({ ...settings, similarityBoost: value });
                          setHasUnsavedChanges(true);
                        }}
                        max={1}
                        step={0.01}
                        className="w-full"
                        data-testid="slider-similarity"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="speaker-boost">Speaker Boost</Label>
                      <Switch
                        id="speaker-boost"
                        checked={settings.useSpeakerBoost}
                        onCheckedChange={(checked) => {
                          setSettings({ ...settings, useSpeakerBoost: checked });
                          setHasUnsavedChanges(true);
                        }}
                        data-testid="switch-speaker-boost"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* LLM Tab */}
        <TabsContent value="llm" className="space-y-4">
          <Card className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Language Model Settings</h3>
            <div className="space-y-4">
              {/* Model Selection */}
              <div>
                <Label htmlFor="model">Model</Label>
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
                    <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Temperature */}
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Temperature</Label>
                  <span className="text-sm text-muted-foreground">
                    {settings.temperature.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[settings.temperature]}
                  onValueChange={([value]) => {
                    setSettings({ ...settings, temperature: value });
                    setHasUnsavedChanges(true);
                  }}
                  max={2}
                  step={0.1}
                  className="w-full"
                  data-testid="slider-temperature"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower values make responses more focused and deterministic
                </p>
              </div>

              {/* Max Tokens */}
              <div>
                <Label htmlFor="max-tokens">Max Tokens</Label>
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
                  data-testid="input-max-tokens"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum length of each response
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="space-y-4">
          <Card className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Knowledge Base & RAG</h3>
            <div className="space-y-4">
              {/* Enable RAG */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="use-rag">Enable RAG</Label>
                  <p className="text-xs text-muted-foreground">
                    Use Retrieval-Augmented Generation for better responses
                  </p>
                </div>
                <Switch
                  id="use-rag"
                  checked={settings.useRag}
                  onCheckedChange={(checked) => {
                    setSettings({ ...settings, useRag: checked });
                    setHasUnsavedChanges(true);
                  }}
                  data-testid="switch-use-rag"
                />
              </div>

              {settings.useRag && (
                <>
                  {/* Max Chunks */}
                  <div>
                    <Label htmlFor="max-chunks">Max Chunks</Label>
                    <Input
                      id="max-chunks"
                      type="number"
                      value={settings.maxChunks}
                      onChange={(e) => {
                        setSettings({ ...settings, maxChunks: parseInt(e.target.value) || 5 });
                        setHasUnsavedChanges(true);
                      }}
                      min={1}
                      max={20}
                      data-testid="input-max-chunks"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Number of document chunks to retrieve
                    </p>
                  </div>

                  {/* Embedding Model */}
                  <div>
                    <Label htmlFor="embedding-model">Embedding Model</Label>
                    <Select
                      value={settings.embeddingModel}
                      onValueChange={(value) => {
                        setSettings({ ...settings, embeddingModel: value });
                        setHasUnsavedChanges(true);
                      }}
                    >
                      <SelectTrigger id="embedding-model" data-testid="select-embedding-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="e5_mistral_7b_instruct">E5 Mistral 7B Instruct</SelectItem>
                        <SelectItem value="text-embedding-ada-002">Ada 002</SelectItem>
                        <SelectItem value="text-embedding-3-small">Embedding 3 Small</SelectItem>
                        <SelectItem value="text-embedding-3-large">Embedding 3 Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Documents */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Knowledge Base Documents</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: "Document Upload",
                            description: "Document upload feature coming soon",
                          });
                        }}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Document
                      </Button>
                    </div>
                    {settings.documents.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No documents uploaded yet
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload PDFs, docs, or add URLs to build your knowledge base
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {settings.documents.map((doc) => (
                          <Card key={doc.id} className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{doc.name}</span>
                              <span className="text-xs text-muted-foreground">({doc.type})</span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSettings({
                                  ...settings,
                                  documents: settings.documents.filter(d => d.id !== doc.id),
                                });
                                setHasUnsavedChanges(true);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          <Card className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Tools & Webhooks</h3>
            <div className="space-y-4">
              {/* Webhooks */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Webhook Tools</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addWebhook}
                    className="gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Webhook
                  </Button>
                </div>
                {settings.webhooks.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <Wrench className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No webhooks configured
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add webhooks to connect your agent to external APIs
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {settings.webhooks.map((webhook) => (
                      <Card key={webhook.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Webhook name"
                              value={webhook.name}
                              onChange={(e) => updateWebhook(webhook.id, 'name', e.target.value)}
                              className="flex-1"
                            />
                            <Select
                              value={webhook.method}
                              onValueChange={(value) => updateWebhook(webhook.id, 'method', value)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="DELETE">DELETE</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeWebhook(webhook.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Webhook URL"
                            value={webhook.url}
                            onChange={(e) => updateWebhook(webhook.id, 'url', e.target.value)}
                          />
                          <Input
                            placeholder="Description (optional)"
                            value={webhook.description || ""}
                            onChange={(e) => updateWebhook(webhook.id, 'description', e.target.value)}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <Card className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Advanced Settings</h3>
            <div className="space-y-6">
              {/* Dynamic Variables */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleSection('variables')}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {expandedSections.variables ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Label className="cursor-pointer">Dynamic Variables</Label>
                </button>
                {expandedSections.variables && (
                  <div className="mt-3 space-y-3 pl-6">
                    <p className="text-xs text-muted-foreground">
                      Variables that can be passed at runtime via URL parameters
                    </p>
                    <div className="space-y-2">
                      {Object.entries(settings.dynamicVariables).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <Input
                            placeholder="Variable name"
                            value={key}
                            onChange={(e) => {
                              const newVars = { ...settings.dynamicVariables };
                              delete newVars[key];
                              newVars[e.target.value] = value;
                              setSettings({ ...settings, dynamicVariables: newVars });
                              setHasUnsavedChanges(true);
                            }}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Default value"
                            value={value}
                            onChange={(e) => {
                              setSettings({
                                ...settings,
                                dynamicVariables: { ...settings.dynamicVariables, [key]: e.target.value },
                              });
                              setHasUnsavedChanges(true);
                            }}
                            className="flex-1"
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
                  </div>
                )}
              </div>

              {/* Evaluation Criteria */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleSection('evaluation')}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {expandedSections.evaluation ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Label className="cursor-pointer">Evaluation Criteria</Label>
                </button>
                {expandedSections.evaluation && (
                  <div className="mt-3 space-y-3 pl-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Define success metrics for conversations
                      </p>
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
                        {settings.evaluationCriteria.map((criteria, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={criteria}
                              onChange={(e) => {
                                const newCriteria = [...settings.evaluationCriteria];
                                newCriteria[index] = e.target.value;
                                setSettings({ ...settings, evaluationCriteria: newCriteria });
                                setHasUnsavedChanges(true);
                              }}
                              placeholder="e.g., understood_root_cause"
                              className="flex-1"
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
                          onClick={() => {
                            setSettings({
                              ...settings,
                              evaluationCriteria: [...settings.evaluationCriteria, ""],
                            });
                            setHasUnsavedChanges(true);
                          }}
                          className="gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Criteria
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Data Collection */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleSection('collection')}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {expandedSections.collection ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Label className="cursor-pointer">Data Collection</Label>
                </button>
                {expandedSections.collection && (
                  <div className="mt-3 space-y-3 pl-6">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Extract structured data from conversations
                      </p>
                      <Switch
                        checked={settings.dataCollectionEnabled}
                        onCheckedChange={(checked) => {
                          setSettings({ ...settings, dataCollectionEnabled: checked });
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                    {settings.dataCollectionEnabled && (
                      <div className="space-y-2">
                        {settings.dataCollectionFields.map((field, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={field.name}
                              onChange={(e) => {
                                const newFields = [...settings.dataCollectionFields];
                                newFields[index] = { ...field, name: e.target.value };
                                setSettings({ ...settings, dataCollectionFields: newFields });
                                setHasUnsavedChanges(true);
                              }}
                              placeholder="Field name"
                              className="flex-1"
                            />
                            <Select
                              value={field.type}
                              onValueChange={(value) => {
                                const newFields = [...settings.dataCollectionFields];
                                newFields[index] = { ...field, type: value };
                                setSettings({ ...settings, dataCollectionFields: newFields });
                                setHasUnsavedChanges(true);
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="string">String</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                                <SelectItem value="array">Array</SelectItem>
                              </SelectContent>
                            </Select>
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
  );
}