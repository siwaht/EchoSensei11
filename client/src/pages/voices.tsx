import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Play, UserCheck, Settings } from "lucide-react";
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

  // Fetch voices from API
  const { data: voices = [], isLoading } = useQuery<Voice[]>({
    queryKey: ["/api/voiceai/voices"],
  });

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
    if (!searchQuery) return voices;
    
    const query = searchQuery.toLowerCase();
    return voices.filter(
      (voice) =>
        voice.name.toLowerCase().includes(query) ||
        voice.description?.toLowerCase().includes(query) ||
        voice.labels?.accent?.toLowerCase().includes(query) ||
        voice.labels?.gender?.toLowerCase().includes(query)
    );
  }, [voices, searchQuery]);

  // Get language from labels
  const getLanguage = (voice: Voice): string => {
    if (voice.labels?.language) return voice.labels.language;
    if (voice.labels?.accent) return voice.labels.accent;
    return "English";
  };

  // Get accent/region from labels
  const getAccent = (voice: Voice): string | null => {
    if (voice.labels?.accent) {
      const accent = voice.labels.accent;
      if (accent.includes("american")) return "American";
      if (accent.includes("british")) return "British";
      if (accent.includes("australian")) return "Australian";
      return accent;
    }
    return null;
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
        audio.play();
        audio.onended = () => setPlayingVoiceId(null);
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

  const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Voice Library
          </h2>
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
          {filteredVoices.map((voice) => (
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
                        {voice.description || "Professional voice perfect for conversational AI"}
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

                  {/* Tags and Labels */}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      {/* Language Badges */}
                      <Badge variant="secondary" className="text-xs">
                        <span className="mr-1">🌐</span>
                        {getLanguage(voice)}
                      </Badge>
                      {getAccent(voice) && (
                        <Badge variant="secondary" className="text-xs">
                          {getAccent(voice)}
                        </Badge>
                      )}
                    </div>

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
                        {agent.voiceId ? `Current voice: ${voices.find(v => v.voice_id === agent.voiceId)?.name || agent.voiceId}` : "No voice assigned"}
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
    </div>
  );
}