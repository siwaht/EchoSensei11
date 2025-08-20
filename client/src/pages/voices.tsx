import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Play, UserCheck, Settings, Plus, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent } from "@shared/schema";

interface Voice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
  category?: string;
  fine_tuning?: {
    language?: string;
    is_allowed_to_fine_tune?: boolean;
  };
  high_quality_base_model_ids?: string[];
  samples?: any[];
  settings?: {
    stability: number;
    similarity_boost: number;
  };
}

export default function Voices() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [showCustomVoiceDialog, setShowCustomVoiceDialog] = useState(false);
  const [customVoiceLoading, setCustomVoiceLoading] = useState(false);
  const [customVoiceData, setCustomVoiceData] = useState<Voice | null>(null);
  const [showAvailableVoices, setShowAvailableVoices] = useState(false);

  // Fetch voices from API
  const { data: voicesData, isLoading } = useQuery<Voice[]>({
    queryKey: ["/api/voiceai/voices"],
  });
  
  const voices: Voice[] = voicesData || [];

  // Fetch agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Update agent mutation
  const updateAgent = useMutation({
    mutationFn: async ({ agentId, voiceId }: { agentId: string; voiceId: string }) => {
      return await apiRequest("PATCH", `/api/agents/${agentId}`, { voiceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setShowAgentDialog(false);
      setSelectedVoiceId(null);
      setSelectedAgentId(null);
      toast({
        title: "Voice assigned",
        description: "The voice has been assigned to your agent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment failed",
        description: error.message || "Failed to assign voice to agent",
        variant: "destructive",
      });
    },
  });

  // Filter voices based on search
  const filteredVoices = useMemo(() => {
    if (!searchQuery || !voices) return voices;
    
    const query = searchQuery.toLowerCase();
    return voices.filter(
      (voice: Voice) => {
        const nameMatch = voice.name.toLowerCase().includes(query);
        const descMatch = voice.description?.toLowerCase().includes(query);
        const labelMatch = voice.labels && Object.values(voice.labels).some(
          (value) => typeof value === 'string' && value.toLowerCase().includes(query)
        );
        return nameMatch || descMatch || labelMatch;
      }
    );
  }, [voices, searchQuery]);

  // Get all voice metadata
  const getVoiceMetadata = (voice: Voice) => {
    const metadata = {
      language: "English",
      accent: null as string | null,
      gender: null as string | null,
      age: null as string | null,
      useCase: "Conversational",
      description: null as string | null,
    };

    // Extract from labels
    if (voice.labels) {
      Object.entries(voice.labels).forEach(([key, value]) => {
        if (key === "language" || key === "lang") metadata.language = value;
        if (key === "accent") metadata.accent = value;
        if (key === "gender") metadata.gender = value;
        if (key === "age") metadata.age = value;
        if (key === "use_case" || key === "use case") metadata.useCase = value;
        if (key === "description" || key === "desc") metadata.description = value;
      });
    }

    // Use fine_tuning language if available
    if (voice.fine_tuning?.language) {
      metadata.language = voice.fine_tuning.language;
    }

    // Use category if available
    if (voice.category) {
      metadata.useCase = voice.category;
    }

    return metadata;
  };

  // Format language display
  const formatLanguage = (language: string): string => {
    const langMap: Record<string, string> = {
      "en": "English",
      "es": "Spanish",
      "fr": "French",
      "de": "German",
      "it": "Italian",
      "pt": "Portuguese",
      "pl": "Polish",
      "ja": "Japanese",
      "zh": "Chinese",
      "ko": "Korean",
      "hi": "Hindi",
      "ar": "Arabic",
      "ru": "Russian",
      "nl": "Dutch",
      "sv": "Swedish",
      "no": "Norwegian",
    };
    return langMap[language.toLowerCase()] || language;
  };

  // Get language emoji
  const getLanguageEmoji = (language: string): string => {
    const emojiMap: Record<string, string> = {
      "english": "🇬🇧",
      "spanish": "🇪🇸",
      "french": "🇫🇷",
      "german": "🇩🇪",
      "italian": "🇮🇹",
      "portuguese": "🇵🇹",
      "polish": "🇵🇱",
      "japanese": "🇯🇵",
      "chinese": "🇨🇳",
      "korean": "🇰🇷",
      "hindi": "🇮🇳",
      "arabic": "🇸🇦",
      "russian": "🇷🇺",
      "dutch": "🇳🇱",
      "swedish": "🇸🇪",
      "norwegian": "🇳🇴",
    };
    return emojiMap[language.toLowerCase()] || "🌐";
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get avatar color based on voice ID
  const getAvatarColor = (voiceId: string): string => {
    const colors = [
      "bg-orange-500",
      "bg-purple-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-pink-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-red-500",
    ];
    const index = voiceId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handlePlayVoice = (voiceId: string, previewUrl?: string) => {
    if (!previewUrl) {
      toast({
        title: "Preview not available",
        description: "This voice doesn't have a preview available.",
        variant: "destructive",
      });
      return;
    }

    if (playingVoiceId === voiceId) {
      // Stop playing
      setPlayingVoiceId(null);
      const audio = document.getElementById(`audio-${voiceId}`) as HTMLAudioElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    } else {
      // Stop any currently playing audio
      if (playingVoiceId) {
        const currentAudio = document.getElementById(`audio-${playingVoiceId}`) as HTMLAudioElement;
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }
      
      // Start playing new audio
      setPlayingVoiceId(voiceId);
      const audio = document.getElementById(`audio-${voiceId}`) as HTMLAudioElement;
      if (audio) {
        audio.play().catch((error) => {
          console.error("Audio playback error:", error);
          setPlayingVoiceId(null);
          toast({
            title: "Playback failed",
            description: "Could not play voice preview",
            variant: "destructive",
          });
        });
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => {
          setPlayingVoiceId(null);
          toast({
            title: "Audio error",
            description: "Failed to load voice preview",
            variant: "destructive",
          });
        };
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const selectedVoice = voices.find((v: Voice) => v.voice_id === selectedVoiceId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Voice Library
          </h2>
          <Button
            onClick={() => setShowCustomVoiceDialog(true)}
            data-testid="button-add-custom-voice"
          >
            <Plus className="w-4 h-4 mr-2" />
            Use Voice by ID
          </Button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by name, accent, or gender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-voices"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              data-testid="button-clear-search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Available Voices
          {filteredVoices.length > 0 && (
            <span className="ml-2 text-sm text-gray-500">
              ({filteredVoices.length} {filteredVoices.length === 1 ? "voice" : "voices"})
            </span>
          )}
        </h3>
      </div>

      {/* Voice Cards */}
      {filteredVoices.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2" data-testid="text-no-voices">
              No voices found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery
                ? "Try a different search term"
                : "No voices available"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredVoices.map((voice: Voice) => (
            <Card
              key={voice.voice_id}
              className="p-4 hover:shadow-md transition-shadow"
              data-testid={`card-voice-${voice.voice_id}`}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <Avatar className="w-12 h-12">
                  <AvatarFallback className={`${getAvatarColor(voice.voice_id)} text-white`}>
                    {getInitials(voice.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Voice Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {voice.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {voice.description || getVoiceMetadata(voice).description || voice.labels?.description || "Professional voice perfect for conversational AI"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePlayVoice(voice.voice_id, voice.preview_url)}
                        data-testid={`button-play-${voice.voice_id}`}
                        title="Play preview"
                      >
                        <Play className={`w-4 h-4 ${playingVoiceId === voice.voice_id ? "text-primary" : ""}`} />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedVoiceId(voice.voice_id);
                          setShowAgentDialog(true);
                        }}
                        className="gap-1"
                        data-testid={`button-use-voice-${voice.voice_id}`}
                      >
                        <UserCheck className="w-3 h-3" />
                        Use Voice
                      </Button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {/* Language */}
                    {voice.labels && Object.entries(voice.labels).map(([key, value]) => {
                      // Show all labels as badges
                      if (key && value && typeof value === 'string') {
                        let displayValue: string = value;
                        let variant: "default" | "secondary" | "outline" = "secondary";
                        
                        // Format certain labels
                        if (key === "language" || key === "lang") {
                          displayValue = `${getLanguageEmoji(value)} ${formatLanguage(value)}`;
                          variant = "default";
                        } else if (key === "accent") {
                          displayValue = value;
                        } else if (key === "gender") {
                          displayValue = value.charAt(0).toUpperCase() + value.slice(1);
                        } else if (key === "use_case" || key === "use case") {
                          variant = "outline";
                          displayValue = value;
                        }
                        
                        return (
                          <Badge key={key} variant={variant} className="text-xs">
                            {displayValue}
                          </Badge>
                        );
                      }
                      return null;
                    })}
                    
                    {/* Show category if not in labels */}
                    {voice.category && !voice.labels?.use_case && !voice.labels?.["use case"] && (
                      <Badge variant="outline" className="text-xs">
                        {voice.category}
                      </Badge>
                    )}
                    
                    {/* HD indicator */}
                    {voice.high_quality_base_model_ids && voice.high_quality_base_model_ids.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        HD
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Hidden audio element */}
              {voice.preview_url && (
                <audio
                  id={`audio-${voice.voice_id}`}
                  src={voice.preview_url}
                  preload="none"
                  className="hidden"
                />
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Agent Selection Dialog */}
      <Dialog open={showAgentDialog} onOpenChange={setShowAgentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Select Agent for Voice</DialogTitle>
            <DialogDescription>
              Choose which agent should use "{selectedVoice?.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {agents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No agents found. Create an agent first.</p>
                <Button
                  className="mt-4"
                  onClick={() => setLocation("/agents")}
                  data-testid="button-go-to-agents"
                >
                  Go to Agents
                </Button>
              </div>
            ) : (
              agents.map((agent) => (
                <Card
                  key={agent.id}
                  className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedAgentId === agent.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedAgentId(agent.id)}
                  data-testid={`card-agent-${agent.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{agent.name}</h4>
                      <p className="text-sm text-gray-500">
                        {agent.voiceId ? `Current voice: ${voices.find((v: Voice) => v.voice_id === agent.voiceId)?.name || agent.voiceId}` : "No voice assigned"}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/agents/${agent.id}/settings`);
                      }}
                      data-testid={`button-agent-settings-${agent.id}`}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAgentDialog(false);
                setSelectedAgentId(null);
              }}
              data-testid="button-cancel-assignment"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedAgentId && selectedVoiceId) {
                  updateAgent.mutate({ agentId: selectedAgentId, voiceId: selectedVoiceId });
                }
              }}
              disabled={!selectedAgentId || updateAgent.isPending}
              data-testid="button-confirm-assignment"
            >
              {updateAgent.isPending ? "Assigning..." : "Assign Voice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Voice ID Dialog */}
      <Dialog open={showCustomVoiceDialog} onOpenChange={setShowCustomVoiceDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Use Voice by ID</DialogTitle>
            <DialogDescription>
              Enter an ElevenLabs voice ID to test and use any voice. You can find voice IDs in the ElevenLabs voice lab.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="voice-id">Voice ID</Label>
              <Input
                id="voice-id"
                placeholder="e.g., kdmDKE6EkgrWrrykO9Qt"
                value={customVoiceId}
                onChange={(e) => setCustomVoiceId(e.target.value)}
                data-testid="input-custom-voice-id"
              />
              <p className="text-xs text-gray-500">
                Enter any valid ElevenLabs voice ID. The voice must be in your ElevenLabs account to be accessible.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAvailableVoices(!showAvailableVoices)}
                data-testid="button-toggle-available-voices"
              >
                {showAvailableVoices ? "Hide" : "Show"} Available Voice IDs
              </Button>
            </div>

            {showAvailableVoices && voices.length > 0 && (
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium mb-2">Your Available Voices ({voices.length}):</p>
                <div className="space-y-1 text-xs">
                  {voices.map((v: Voice) => (
                    <div 
                      key={v.voice_id} 
                      className="flex items-center justify-between p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                      onClick={() => setCustomVoiceId(v.voice_id)}
                    >
                      <span>{v.name}</span>
                      <span className="font-mono text-gray-500">{v.voice_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {customVoiceData && (
              <div className="border rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Voice Details</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">Name:</span> {customVoiceData.name}</p>
                  <p><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{customVoiceData.voice_id}</span></p>
                  {customVoiceData.description && (
                    <p><span className="text-gray-500">Description:</span> {customVoiceData.description}</p>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const voiceId = customVoiceData.voice_id;
                      if (!voiceId) {
                        toast({
                          title: "Voice ID missing",
                          description: "Cannot play preview without a valid voice ID",
                          variant: "destructive",
                        });
                        return;
                      }
                      setPlayingVoiceId(voiceId);
                      const audio = new Audio(`/api/voiceai/voices/${voiceId}/preview`);
                      audio.play().catch((error) => {
                        console.error("Audio playback error:", error);
                        setPlayingVoiceId(null);
                        toast({
                          title: "Playback failed",
                          description: "Could not play voice preview. The voice may not be accessible.",
                          variant: "destructive",
                        });
                      });
                      audio.onended = () => setPlayingVoiceId(null);
                      audio.onerror = () => {
                        setPlayingVoiceId(null);
                        toast({
                          title: "Audio error",
                          description: "Failed to load voice preview",
                          variant: "destructive",
                        });
                      };
                    }}
                    disabled={playingVoiceId === customVoiceData.voice_id || !customVoiceData.voice_id}
                    data-testid={`button-play-custom-voice`}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    {playingVoiceId === customVoiceData.voice_id ? "Playing..." : "Test Voice"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedVoiceId(customVoiceData.voice_id);
                      setShowCustomVoiceDialog(false);
                      setShowAgentDialog(true);
                    }}
                    data-testid={`button-use-custom-voice`}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Use in Agent
                  </Button>
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex gap-2">
                <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">Important: Voice Access Requirements</p>
                  <div className="text-xs mt-1 space-y-1">
                    <p>• Voice Library voices must be added to your account first</p>
                    <p>• Go to ElevenLabs Voice Library → Click "Add to VoiceLab" on the voice</p>
                    <p>• Custom/cloned voices appear automatically after creation</p>
                    <p>• Only voices in "My Voices" section are accessible via API</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCustomVoiceDialog(false);
                setCustomVoiceId("");
                setCustomVoiceData(null);
              }}
              data-testid="button-cancel-custom-voice"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!customVoiceId.trim()) {
                  toast({
                    title: "Voice ID required",
                    description: "Please enter a valid ElevenLabs voice ID",
                    variant: "destructive",
                  });
                  return;
                }

                setCustomVoiceLoading(true);
                try {
                  // Fetch voice details from ElevenLabs
                  const response = await apiRequest("GET", `/api/voiceai/voices/${customVoiceId.trim()}`) as unknown as Voice;
                  setCustomVoiceData(response);
                  toast({
                    title: "Voice found",
                    description: `Successfully loaded voice: ${response.name}`,
                  });
                } catch (error: any) {
                  // Check if it's a 404 error (voice not found)
                  const isNotFound = error.message?.includes('not found') || error.status === 404;
                  toast({
                    title: isNotFound ? "Voice not found" : "Error fetching voice",
                    description: isNotFound 
                      ? `Voice ID "${customVoiceId.trim()}" was not found. This voice may need to be added to your ElevenLabs account first. Go to the Voice Library and click "Add to VoiceLab" for this voice.`
                      : (error.message || "Failed to fetch voice from ElevenLabs"),
                    variant: "destructive",
                  });
                } finally {
                  setCustomVoiceLoading(false);
                }
              }}
              disabled={!customVoiceId.trim() || customVoiceLoading}
              data-testid="button-fetch-custom-voice"
            >
              {customVoiceLoading ? "Loading..." : "Fetch Voice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}