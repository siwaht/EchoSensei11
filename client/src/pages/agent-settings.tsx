import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Save, 
  Play, 
  MessageSquare, 
  Mic, 
  Brain,
  Sparkles,
  Globe
} from "lucide-react";
import type { Agent } from "@shared/schema";

export default function AgentSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get agentId from URL query params
  const params = new URLSearchParams(window.location.search);
  const agentId = params.get("agentId");
  
  const [activeTab, setActiveTab] = useState("chat");
  const [hasChanges, setHasChanges] = useState(false);
  
  // Form states
  const [name, setName] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptGenerator, setPromptGenerator] = useState("");
  const [language, setLanguage] = useState("en");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [stability, setStability] = useState([0.5]);
  const [similarityBoost, setSimilarityBoost] = useState([0.75]);
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState("150");
  
  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", agentId],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentId}`);
      if (!response.ok) throw new Error("Failed to fetch agent");
      return response.json();
    },
    enabled: !!agentId,
  });

  const { data: voices } = useQuery({
    queryKey: ["/api/voiceai/voices"],
    enabled: activeTab === "voice",
  });

  // Load agent data into form
  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setFirstMessage(agent.firstMessage || "");
      setSystemPrompt(agent.systemPrompt || "");
      setLanguage(agent.language || "en");
      setSelectedVoice(agent.voiceId || "");
      if (agent.voiceSettings) {
        setStability([agent.voiceSettings.stability || 0.5]);
        setSimilarityBoost([agent.voiceSettings.similarityBoost || 0.75]);
      }
      if (agent.llmSettings) {
        setModel(agent.llmSettings.model || "gpt-4o-mini");
        setTemperature([agent.llmSettings.temperature || 0.7]);
        setMaxTokens(agent.llmSettings.maxTokens?.toString() || "150");
      }
    }
  }, [agent]);

  const saveMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await apiRequest("PATCH", `/api/agents/${agentId}/settings`, settings);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent settings synced with ElevenLabs successfully",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync settings with ElevenLabs",
        variant: "destructive",
      });
    },
  });

  const generatePrompt = () => {
    if (!promptGenerator.trim()) {
      toast({
        title: "Error",
        description: "Please describe your agent first",
        variant: "destructive",
      });
      return;
    }
    
    // Generate a comprehensive prompt based on description
    const generatedPrompt = `You are an expert ${promptGenerator}. Your role is to provide helpful, accurate, and professional assistance. You should:

1. Be knowledgeable and informative in your domain
2. Communicate clearly and concisely
3. Be friendly and approachable
4. Ask clarifying questions when needed
5. Provide actionable advice and solutions

Always maintain a professional yet conversational tone, and ensure all responses are helpful and relevant to the user's needs.`;
    
    setSystemPrompt(generatedPrompt);
    setHasChanges(true);
    toast({
      title: "Prompt Generated",
      description: "System prompt has been generated based on your description",
    });
  };

  const handleSave = () => {
    const settings = {
      name,
      firstMessage,
      systemPrompt,
      language,
      voiceId: selectedVoice,
      voiceSettings: {
        stability: stability[0],
        similarity_boost: similarityBoost[0],
      },
      llmSettings: {
        model,
        temperature: temperature[0],
        maxTokens: parseInt(maxTokens),
      },
    };
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Agent not found</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setLocation("/agents")}
          >
            Back to Agents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/agents")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Agent Settings</h1>
            <p className="text-muted-foreground">Configure {agent.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation(`/playground?agentId=${agentId}`)}
          >
            <Play className="h-4 w-4 mr-2" />
            Test Agent
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Syncing..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Warning about ElevenLabs sync */}
      {agent.elevenLabsAgentId ? (
        <Card className="p-4 mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            ✓ This agent is synced with ElevenLabs. All changes will be updated in real-time.
          </p>
        </Card>
      ) : (
        <Card className="p-4 mb-6 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            ⚠️ This agent is not synced with ElevenLabs. Run sync from the Agents page first.
          </p>
        </Card>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="llm" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            LLM
          </TabsTrigger>
          <TabsTrigger value="language" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Language
          </TabsTrigger>
        </TabsList>

        {/* Chat Settings */}
        <TabsContent value="chat" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Conversation Settings</h2>
            
            <div className="space-y-4">
              {/* Agent Name */}
              <div>
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Enter agent name"
                  className="mt-2"
                />
              </div>

              {/* First Message */}
              <div>
                <Label htmlFor="firstMessage">First Message</Label>
                <Textarea
                  id="firstMessage"
                  value={firstMessage}
                  onChange={(e) => {
                    setFirstMessage(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="What should the agent say when the conversation starts?"
                  className="mt-2 min-h-[80px]"
                />
              </div>

              <Separator />

              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Badge variant="outline">Core behavior definition</Badge>
                </div>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Define your agent's behavior, personality, and instructions..."
                  className="mt-2 min-h-[200px] font-mono text-sm"
                />
              </div>

              {/* AI Prompt Generator */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium">AI Prompt Generator</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Describe your agent and we'll generate a comprehensive system prompt
                </p>
                <div className="flex gap-2">
                  <Input
                    value={promptGenerator}
                    onChange={(e) => setPromptGenerator(e.target.value)}
                    placeholder="e.g., customer support agent for a tech company"
                    onKeyDown={(e) => e.key === "Enter" && generatePrompt()}
                  />
                  <Button onClick={generatePrompt}>
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Voice Settings */}
        <TabsContent value="voice" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Voice Configuration</h2>
            
            <div className="space-y-4">
              {/* Voice Selection */}
              <div>
                <Label htmlFor="voice">Voice</Label>
                <Select 
                  value={selectedVoice} 
                  onValueChange={(value) => {
                    setSelectedVoice(value);
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger id="voice" className="mt-2">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices && Array.isArray(voices) ? (
                      voices.map((voice: any) => (
                        <SelectItem key={voice.voice_id} value={voice.voice_id}>
                          {voice.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="rachel">Rachel</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Voice Settings */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Stability</Label>
                    <span className="text-sm text-muted-foreground">{stability[0]}</span>
                  </div>
                  <Slider
                    value={stability}
                    onValueChange={(value) => {
                      setStability(value);
                      setHasChanges(true);
                    }}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Controls consistency between generations
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Similarity Boost</Label>
                    <span className="text-sm text-muted-foreground">{similarityBoost[0]}</span>
                  </div>
                  <Slider
                    value={similarityBoost}
                    onValueChange={(value) => {
                      setSimilarityBoost(value);
                      setHasChanges(true);
                    }}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How closely to match the original voice
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* LLM Settings */}
        <TabsContent value="llm" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Language Model Settings</h2>
            
            <div className="space-y-4">
              {/* Model Selection */}
              <div>
                <Label htmlFor="model">Model</Label>
                <Select 
                  value={model} 
                  onValueChange={(value) => {
                    setModel(value);
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger id="model" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o (Latest)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="claude-3-5-haiku">Claude 3.5 Haiku</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Temperature */}
              <div>
                <div className="flex justify-between mb-2">
                  <Label>Temperature</Label>
                  <span className="text-sm text-muted-foreground">{temperature[0]}</span>
                </div>
                <Slider
                  value={temperature}
                  onValueChange={(value) => {
                    setTemperature(value);
                    setHasChanges(true);
                  }}
                  min={0}
                  max={2}
                  step={0.1}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Controls randomness. Lower = more focused, Higher = more creative
                </p>
              </div>

              {/* Max Tokens */}
              <div>
                <Label htmlFor="maxTokens">Max Response Length (tokens)</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens}
                  onChange={(e) => {
                    setMaxTokens(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="150"
                  className="mt-2"
                  min="50"
                  max="4000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum length of each response (1 token ≈ 4 characters)
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Language Settings */}
        <TabsContent value="language" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Language Settings</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="language">Primary Language</Label>
                <Select 
                  value={language} 
                  onValueChange={(value) => {
                    setLanguage(value);
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger id="language" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="nl">Dutch</SelectItem>
                    <SelectItem value="pl">Polish</SelectItem>
                    <SelectItem value="ru">Russian</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  The primary language the agent will use for conversations
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}