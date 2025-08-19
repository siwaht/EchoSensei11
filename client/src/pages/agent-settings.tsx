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
import { Save, ArrowLeft, Mic, Settings2, MessageSquare, Zap, Search, Play, Volume2, Check, X, RotateCcw } from "lucide-react";
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

  const [voiceSearch, setVoiceSearch] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
      setHasUnsavedChanges(false);
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

  const playVoicePreview = (voiceId: string, previewUrl: string) => {
    // Stop currently playing audio if any
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (playingVoiceId === voiceId) {
      // Stop playing if clicking the same voice
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
          <Button onClick={() => setLocation("/")} className="mt-4">
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
            onClick={() => setLocation("/")}
            className="gap-1 sm:gap-2 px-2 sm:px-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Agent Settings</h1>
        </div>
        <Button
          onClick={handleSave}
          disabled={updateAgentMutation.isPending || !hasUnsavedChanges}
          className={`gap-2 w-full sm:w-auto ${hasUnsavedChanges ? 'animate-pulse' : ''}`}
          variant={hasUnsavedChanges ? "default" : "outline"}
          data-testid="button-save-agent-settings"
        >
          <Save className="w-4 h-4" />
          {updateAgentMutation.isPending ? "Saving..." : hasUnsavedChanges ? "Save Settings" : "No Changes"}
        </Button>
      </div>

      <Card className="p-4 sm:p-6 mb-4 sm:mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg">
            <Settings2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold">{agent.name}</h2>
            <p className="text-sm sm:text-base text-muted-foreground">{agent.description || "No description"}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-all">Agent ID: {agent.elevenLabsAgentId}</p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="conversation" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="conversation" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Conversation</span>
            <span className="xs:hidden">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <Mic className="w-3 h-3 sm:w-4 sm:h-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-1 sm:gap-2 text-xs sm:text-sm">
            <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversation" className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Conversation Settings</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="first-message" className="text-sm sm:text-base">First Message</Label>
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-600 dark:bg-amber-400 rounded-full animate-pulse" />
                        Unsaved changes
                      </span>
                    )}
                    {!hasUnsavedChanges && settings.firstMessage && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Saved
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                  The initial greeting your agent will say when starting a conversation
                </p>
                <div className="relative">
                  <Textarea
                    id="first-message"
                    value={settings.firstMessage}
                    onChange={(e) => {
                      setSettings({ ...settings, firstMessage: e.target.value });
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Hello! How can I help you today?"
                    rows={4}
                    className="resize-none text-sm sm:text-base pr-16"
                    data-testid="textarea-first-message"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                    {settings.firstMessage.length}/500
                  </div>
                </div>
                {settings.firstMessage && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                    <p className="text-sm italic">"{settings.firstMessage}"</p>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSettings({ ...settings, firstMessage: "" });
                      setHasUnsavedChanges(true);
                    }}
                    className="gap-1 w-full sm:w-auto"
                    data-testid="button-clear-message"
                  >
                    <X className="w-3 h-3" />
                    Clear Message
                  </Button>
                  
                  {hasUnsavedChanges && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Reset to original values
                        if (agent) {
                          setSettings({
                            firstMessage: agent.firstMessage || "",
                            voiceId: agent.voiceId || "",
                            stability: agent.voiceSettings?.stability || 0.5,
                            similarityBoost: agent.voiceSettings?.similarityBoost || 0.75,
                            style: agent.voiceSettings?.style || 0,
                            useSpeakerBoost: agent.voiceSettings?.useSpeakerBoost ?? true,
                          });
                          setHasUnsavedChanges(false);
                        }
                      }}
                      className="gap-1 w-full sm:w-auto"
                      data-testid="button-discard-changes"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Discard All Changes
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleSave}
                    disabled={updateAgentMutation.isPending || !hasUnsavedChanges}
                    size="sm"
                    className="gap-1 w-full sm:w-auto"
                    variant={hasUnsavedChanges ? "default" : "outline"}
                    data-testid="button-save-inline"
                  >
                    <Save className="w-3 h-3" />
                    {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Voice Selection</h3>
            {voicesLoading ? (
              <p className="text-muted-foreground">Loading available voices...</p>
            ) : (
              <div className="space-y-4">
                {/* Search Box */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search voices by name, accent, gender, or age..."
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-voice-search"
                  />
                </div>

                {/* Voice Grid */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">Select Voice ({filteredVoices.length} available)</Label>
                  <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                    {filteredVoices.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No voices found matching "{voiceSearch}"
                      </div>
                    ) : (
                      filteredVoices.map((voice) => (
                        <Card
                          key={voice.voice_id}
                          className={`p-3 sm:p-4 cursor-pointer transition-all hover:shadow-md ${
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
                                <h4 className="font-medium text-sm sm:text-base">{voice.name}</h4>
                              </div>
                              {voice.labels && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {voice.labels.gender && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                      {voice.labels.gender}
                                    </span>
                                  )}
                                  {voice.labels.age && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                      {voice.labels.age}
                                    </span>
                                  )}
                                  {voice.labels.accent && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                      {voice.labels.accent}
                                    </span>
                                  )}
                                </div>
                              )}
                              {voice.category && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Category: {voice.category}
                                </p>
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
                                className="ml-2"
                                data-testid={`button-preview-${voice.voice_id}`}
                              >
                                {playingVoiceId === voice.voice_id ? (
                                  <>
                                    <Volume2 className="w-3 h-3 mr-1 animate-pulse" />
                                    Playing
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3 mr-1" />
                                    Preview
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </div>

                {/* Voice Test Section */}
                {settings.voiceId && (
                  <Card className="p-4 bg-gray-50 dark:bg-gray-900">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Test Selected Voice</h4>
                        <span className="text-xs text-muted-foreground">
                          {voices.find(v => v.voice_id === settings.voiceId)?.name}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="Enter test text or use the default greeting..."
                          className="flex-1 text-xs sm:text-sm"
                          id="test-text"
                          defaultValue={settings.firstMessage || "Hello! How can I help you today?"}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const testText = (document.getElementById('test-text') as HTMLInputElement)?.value || settings.firstMessage || "Hello! How can I help you today?";
                            // In a real implementation, this would call the ElevenLabs TTS API
                            toast({
                              title: "Voice Test",
                              description: "Voice testing feature will be available soon with the selected text: \"" + testText.substring(0, 50) + (testText.length > 50 ? "..." : "") + "\""
                            });
                          }}
                          className="gap-1 w-full sm:w-auto"
                        >
                          <Volume2 className="w-3 h-3" />
                          Test Voice
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {settings.voiceId && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm sm:text-base font-medium">Voice Fine-tuning</h4>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label className="text-xs sm:text-sm">Stability</Label>
                        <span className="text-xs sm:text-sm text-muted-foreground">
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
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        Lower values make the voice more expressive, higher values make it more stable
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <Label className="text-xs sm:text-sm">Similarity Boost</Label>
                        <span className="text-xs sm:text-sm text-muted-foreground">
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
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        Higher values make the voice closer to the original, may reduce stability
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <Label className="text-xs sm:text-sm">Style Exaggeration</Label>
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {Math.round(settings.style * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[settings.style]}
                        onValueChange={([value]) => {
                          setSettings({ ...settings, style: value });
                          setHasUnsavedChanges(true);
                        }}
                        max={1}
                        step={0.01}
                        className="w-full"
                        data-testid="slider-style"
                      />
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        Higher values make the voice more expressive and animated
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <Label htmlFor="speaker-boost" className="text-xs sm:text-sm">Speaker Boost</Label>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Enhance voice clarity and presence
                        </p>
                      </div>
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

        <TabsContent value="advanced" className="space-y-4 sm:space-y-6">
          <Card className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Advanced Settings</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Additional configuration options will be available here in future updates.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}