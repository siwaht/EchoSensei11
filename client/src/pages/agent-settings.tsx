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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Save, 
  Play, 
  MessageSquare, 
  FileText, 
  Mic, 
  Brain,
  Wrench,
  MoreHorizontal,
  Sparkles,
  Volume2,
  Zap
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
  const [firstMessage, setFirstMessage] = useState("Hello! How can I help you today?");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant");
  const [promptGenerator, setPromptGenerator] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Rachel");
  const [stability, setStability] = useState([0.5]);
  const [similarityBoost, setSimilarityBoost] = useState([0.75]);
  const [styleExaggeration, setStyleExaggeration] = useState([0.0]);
  const [model, setModel] = useState("GPT-4");
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState("150");
  const [enableInterruptions, setEnableInterruptions] = useState(true);
  const [responseSpeed, setResponseSpeed] = useState([0.8]);
  
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

  const saveMutation = useMutation({
    mutationFn: async (settings: any) => {
      await apiRequest("PATCH", `/api/agents/${agentId}/settings`, settings);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent settings saved successfully",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save agent settings",
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
      firstMessage,
      systemPrompt,
      voice: selectedVoice,
      voiceSettings: {
        stability: stability[0],
        similarityBoost: similarityBoost[0],
        styleExaggeration: styleExaggeration[0],
      },
      llmSettings: {
        model,
        temperature: temperature[0],
        maxTokens: parseInt(maxTokens),
      },
      conversationSettings: {
        enableInterruptions,
        responseSpeed: responseSpeed[0],
      },
    };
    
    saveMutation.mutate(settings);
  };

  if (!agentId) {
    return (
      <div className="container py-8">
        <p>No agent selected. Please go back to the agents page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <p>Loading agent settings...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container py-8">
        <p>Agent not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/agents")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Agent Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your agent's behavior and capabilities
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            data-testid="button-save"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Agent Info Bar */}
      <div className="border-b bg-muted/30">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">{agent.name}</h2>
              <Badge variant={agent.isActive ? "default" : "secondary"}>
                {agent.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation(`/playground?agentId=${agent.id}`)}
              data-testid="button-test"
            >
              <Play className="w-4 h-4 mr-2" />
              Test Agent
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 w-full max-w-3xl mx-auto mb-8">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Voice
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              LLM
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="more" className="flex items-center gap-2">
              <MoreHorizontal className="w-4 h-4" />
              More
            </TabsTrigger>
          </TabsList>

          {/* Chat Settings */}
          <TabsContent value="chat" className="space-y-6 max-w-3xl mx-auto">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Conversation Settings</h3>
              
              <div className="space-y-6">
                <div>
                  <Label htmlFor="firstMessage">First Message</Label>
                  <Textarea
                    id="firstMessage"
                    value={firstMessage}
                    onChange={(e) => {
                      setFirstMessage(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Enter the initial greeting message"
                    className="mt-2 min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    The initial message your agent will say when starting a conversation
                  </p>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Label htmlFor="systemPrompt">System Prompt</Label>
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI Enhanced
                    </Badge>
                  </div>
                  
                  {/* AI Prompt Generator */}
                  <div className="bg-muted/50 p-4 rounded-lg mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">AI Prompt Generator</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Describe your desired agent and we'll generate a comprehensive system prompt for you
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={promptGenerator}
                        onChange={(e) => setPromptGenerator(e.target.value)}
                        placeholder="e.g., a customer support agent for ElevenLabs"
                        className="flex-1"
                      />
                      <Button onClick={generatePrompt} variant="secondary">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate
                      </Button>
                    </div>
                  </div>
                  
                  <Textarea
                    id="systemPrompt"
                    value={systemPrompt}
                    onChange={(e) => {
                      setSystemPrompt(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Enter the system prompt for your agent"
                    className="min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Define your agent's personality, knowledge, and behavior
                  </p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="interruptions">Allow Interruptions</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Let users interrupt the agent while it's speaking
                    </p>
                  </div>
                  <Switch
                    id="interruptions"
                    checked={enableInterruptions}
                    onCheckedChange={(checked) => {
                      setEnableInterruptions(checked);
                      setHasChanges(true);
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="responseSpeed">Response Speed</Label>
                  <div className="mt-3">
                    <Slider
                      id="responseSpeed"
                      value={responseSpeed}
                      onValueChange={(value) => {
                        setResponseSpeed(value);
                        setHasChanges(true);
                      }}
                      max={1}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Slower</span>
                      <span>{responseSpeed[0].toFixed(1)}</span>
                      <span>Faster</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Voice Settings */}
          <TabsContent value="voice" className="space-y-6 max-w-3xl mx-auto">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Voice Fine-tuning</h3>
              
              <div className="space-y-6">
                <div>
                  <Label>Selected Voice</Label>
                  <div className="mt-3 flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Volume2 className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">{selectedVoice}</p>
                        <p className="text-sm text-muted-foreground">american</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Change Voice
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Select a different voice from the Voice Library
                  </p>
                </div>

                <Separator />

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label htmlFor="stability">Stability</Label>
                    <span className="text-sm text-muted-foreground">{stability[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    id="stability"
                    value={stability}
                    onValueChange={(value) => {
                      setStability(value);
                      setHasChanges(true);
                    }}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Controls voice consistency. Lower values = more variation
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label htmlFor="similarity">Similarity Boost</Label>
                    <span className="text-sm text-muted-foreground">{similarityBoost[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    id="similarity"
                    value={similarityBoost}
                    onValueChange={(value) => {
                      setSimilarityBoost(value);
                      setHasChanges(true);
                    }}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enhances voice similarity. Higher values = closer to original voice
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label htmlFor="style">Style Exaggeration</Label>
                    <span className="text-sm text-muted-foreground">{styleExaggeration[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    id="style"
                    value={styleExaggeration}
                    onValueChange={(value) => {
                      setStyleExaggeration(value);
                      setHasChanges(true);
                    }}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Amplifies the style of the original voice
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* LLM Settings */}
          <TabsContent value="llm" className="space-y-6 max-w-3xl mx-auto">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">LLM Settings</h3>
              
              <div className="space-y-6">
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Select value={model} onValueChange={(value) => {
                    setModel(value);
                    setHasChanges(true);
                  }}>
                    <SelectTrigger id="model" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GPT-4">GPT-4</SelectItem>
                      <SelectItem value="GPT-4-Turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="GPT-3.5-Turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="Claude-3">Claude 3</SelectItem>
                      <SelectItem value="Claude-2">Claude 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label htmlFor="temperature">Temperature</Label>
                    <span className="text-sm text-muted-foreground">{temperature[0].toFixed(2)}</span>
                  </div>
                  <Slider
                    id="temperature"
                    value={temperature}
                    onValueChange={(value) => {
                      setTemperature(value);
                      setHasChanges(true);
                    }}
                    max={2}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Controls randomness. 0 = deterministic, 2 = very creative
                  </p>
                </div>

                <div>
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    value={maxTokens}
                    onChange={(e) => {
                      setMaxTokens(e.target.value);
                      setHasChanges(true);
                    }}
                    className="mt-2"
                    min="1"
                    max="4000"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Maximum response length in tokens
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Tools Settings */}
          <TabsContent value="tools" className="space-y-6 max-w-3xl mx-auto">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Tools & Integrations</h3>
              
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Tools configuration coming soon. This will allow you to add custom tools, 
                    webhooks, and integrations to enhance your agent's capabilities.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Templates */}
          <TabsContent value="templates" className="space-y-6 max-w-3xl mx-auto">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Response Templates</h3>
              
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Response templates coming soon. This will allow you to define 
                    standard responses for common questions and scenarios.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* More Settings */}
          <TabsContent value="more" className="space-y-6 max-w-3xl mx-auto">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Additional Settings</h3>
              
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Additional configuration options coming soon. This will include 
                    advanced settings for analytics, compliance, and custom behaviors.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}