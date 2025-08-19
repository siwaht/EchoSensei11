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
import { Save, ArrowLeft, Mic, Settings2, MessageSquare, Zap } from "lucide-react";
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
    firstMessage: "",
    voiceId: "",
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
  });

  // Fetch agent data
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const agent = agents.find(a => a.id === agentId);

  // Fetch available voices
  const { data: voices = [], isLoading: voicesLoading } = useQuery<Voice[]>({
    queryKey: ["/api/elevenlabs/voices"],
    enabled: !!agent,
  });

  // Update settings when agent data is loaded
  useEffect(() => {
    if (agent) {
      setSettings({
        firstMessage: agent.firstMessage || "",
        voiceId: agent.voiceId || "",
        stability: agent.voiceSettings?.stability || 0.5,
        similarityBoost: agent.voiceSettings?.similarityBoost || 0.75,
        style: agent.voiceSettings?.style || 0,
        useSpeakerBoost: agent.voiceSettings?.useSpeakerBoost ?? true,
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
      setLocation("/dashboard");
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
      voiceId: settings.voiceId,
      voiceSettings: {
        stability: settings.stability,
        similarityBoost: settings.similarityBoost,
        style: settings.style,
        useSpeakerBoost: settings.useSpeakerBoost,
      },
    });
  };

  const playVoicePreview = (previewUrl: string) => {
    const audio = new Audio(previewUrl);
    audio.play().catch(err => {
      toast({ 
        title: "Failed to play preview", 
        description: "Could not play voice preview",
        variant: "destructive" 
      });
    });
  };

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-red-500">Agent not found</p>
          <Button onClick={() => setLocation("/dashboard")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/dashboard")}
            className="gap-1 sm:gap-2 px-2 sm:px-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Agent Settings</h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateAgentMutation.isPending}
          className="gap-2 w-full sm:w-auto"
          data-testid="button-save-agent-settings"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
      </div>

      <Card className="p-6 mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <Settings2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{agent.name}</h2>
            <p className="text-muted-foreground">{agent.description || "No description"}</p>
            <p className="text-sm text-muted-foreground mt-1">Agent ID: {agent.elevenLabsAgentId}</p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="conversation" className="space-y-6">
        <TabsList>
          <TabsTrigger value="conversation" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Conversation
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <Mic className="w-4 h-4" />
            Voice Settings
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2">
            <Zap className="w-4 h-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversation" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Conversation Settings</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="first-message">First Message</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  The initial greeting your agent will say when starting a conversation
                </p>
                <Textarea
                  id="first-message"
                  value={settings.firstMessage}
                  onChange={(e) => setSettings({ ...settings, firstMessage: e.target.value })}
                  placeholder="Hello! How can I help you today?"
                  rows={4}
                  className="resize-none"
                  data-testid="textarea-first-message"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Voice Selection</h3>
            {voicesLoading ? (
              <p className="text-muted-foreground">Loading available voices...</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="voice-select">Choose Voice</Label>
                  <Select
                    value={settings.voiceId}
                    onValueChange={(value) => setSettings({ ...settings, voiceId: value })}
                  >
                    <SelectTrigger id="voice-select" data-testid="select-voice">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {voices.map((voice) => (
                        <SelectItem key={voice.voice_id} value={voice.voice_id}>
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <span className="font-medium">{voice.name}</span>
                              {voice.labels && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {[voice.labels.gender, voice.labels.age, voice.labels.accent]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </span>
                              )}
                            </div>
                            {voice.preview_url && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playVoicePreview(voice.preview_url!);
                                }}
                                className="ml-2"
                              >
                                <Mic className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                        onValueChange={([value]) => setSettings({ ...settings, stability: value })}
                        max={1}
                        step={0.01}
                        className="w-full"
                        data-testid="slider-stability"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Lower values make the voice more expressive, higher values make it more stable
                      </p>
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
                        onValueChange={([value]) => setSettings({ ...settings, similarityBoost: value })}
                        max={1}
                        step={0.01}
                        className="w-full"
                        data-testid="slider-similarity"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Higher values make the voice closer to the original, may reduce stability
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <Label>Style Exaggeration</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(settings.style * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[settings.style]}
                        onValueChange={([value]) => setSettings({ ...settings, style: value })}
                        max={1}
                        step={0.01}
                        className="w-full"
                        data-testid="slider-style"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Higher values make the voice more expressive and animated
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="speaker-boost">Speaker Boost</Label>
                        <p className="text-xs text-muted-foreground">
                          Enhance voice clarity and presence
                        </p>
                      </div>
                      <Switch
                        id="speaker-boost"
                        checked={settings.useSpeakerBoost}
                        onCheckedChange={(checked) => setSettings({ ...settings, useSpeakerBoost: checked })}
                        data-testid="switch-speaker-boost"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Advanced Settings</h3>
            <p className="text-muted-foreground">
              Additional configuration options will be available here in future updates.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}