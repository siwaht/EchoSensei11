import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, Plus, MoreVertical, Play, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("my-voices");
  const [showFilters, setShowFilters] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Fetch voices from API
  const { data: voices = [], isLoading } = useQuery<Voice[]>({
    queryKey: ["/api/voiceai/voices"],
  });

  // Filter voices based on search and category
  const filteredVoices = useMemo(() => {
    let filtered = voices;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (voice) =>
          voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          voice.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((voice) => voice.category === selectedCategory);
    }

    return filtered;
  }, [voices, searchQuery, selectedCategory]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            My Voices
          </h2>
          <Button data-testid="button-create-voice" className="gap-2">
            <Plus className="w-4 h-4" />
            Create or Clone a Voice
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-3">
            <TabsTrigger value="explore" data-testid="tab-explore">Explore</TabsTrigger>
            <TabsTrigger value="my-voices" data-testid="tab-my-voices">My Voices</TabsTrigger>
            <TabsTrigger value="default-voices" data-testid="tab-default">Default Voices</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search library voices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-voices"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
              data-testid="button-toggle-filters"
            >
              <TrendingUp className="w-4 h-4" />
              Trending
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
              data-testid="button-filters"
            >
              <Filter className="w-4 h-4" />
              Filters
              {selectedCategory !== "all" && (
                <Badge variant="secondary" className="ml-1">
                  1
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Category Filter */}
        {showFilters && (
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <label className="text-sm font-medium">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]" data-testid="select-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
                <SelectItem value="narration">Narration</SelectItem>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="audiobook">Audiobook</SelectItem>
                <SelectItem value="gaming">Gaming</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCategory("all");
                setSearchQuery("");
              }}
              data-testid="button-reset-filters"
            >
              Reset filters
            </Button>
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Results
          {filteredVoices.length > 0 && (
            <span className="ml-2 text-sm text-gray-500">
              ({filteredVoices.length} {filteredVoices.length === 1 ? "voice" : "voices"})
            </span>
          )}
        </h3>
        {activeTab === "my-voices" && filteredVoices.length === 0 && (
          <Badge variant="secondary">New</Badge>
        )}
      </div>

      {/* Voice Cards */}
      {filteredVoices.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2" data-testid="text-no-voices">
              No voices found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || selectedCategory !== "all"
                ? "Try adjusting your filters or search query"
                : "Start by creating or cloning a voice"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredVoices.map((voice) => (
            <Card
              key={voice.voice_id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePlayVoice(voice.voice_id, voice.preview_url)}
                        data-testid={`button-play-${voice.voice_id}`}
                      >
                        <Play className={`w-4 h-4 ${playingVoiceId === voice.voice_id ? "text-primary" : ""}`} />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${voice.voice_id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Use in Agent</DropdownMenuItem>
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Clone Voice</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

                    {/* Category */}
                    <span className="text-sm text-gray-500">
                      {voice.category || "Conversational"}
                    </span>

                    {/* Stats */}
                    <div className="flex items-center gap-4 ml-auto text-sm text-gray-500">
                      <span>2y</span>
                      <span>7.4K</span>
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
    </div>
  );
}