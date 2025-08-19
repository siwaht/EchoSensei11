import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  AudioWaveform, Plus, Search, Play, Pause, Upload, 
  Globe, User, Calendar, Mic, Volume2, Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    description?: string;
    use_case?: string;
  };
  preview_url?: string;
  rating?: number;
  isPremium?: boolean;
  isCustom?: boolean;
}

export default function Voices() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [demoText, setDemoText] = useState("Hello! I'm your AI assistant. How can I help you today?");
  
  // Voice settings for preview
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
  });

  // Fetch voices from API
  const { data: voices = [], isLoading } = useQuery<Voice[]>({
    queryKey: ["/api/voiceai/voices"],
  });

  const categories = ["all", "conversational", "narrative", "news", "character", "custom"];

  const filteredVoices = voices.filter(voice => {
    const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          voice.labels?.accent?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          voice.labels?.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || 
                           voice.category?.toLowerCase() === selectedCategory ||
                           (selectedCategory === "custom" && voice.isCustom);
    return matchesSearch && matchesCategory;
  });

  const playVoicePreview = (voiceId: string, previewUrl?: string) => {
    if (!previewUrl) {
      toast({
        title: "Preview unavailable",
        description: "No preview available for this voice",
        variant: "destructive"
      });
      return;
    }

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Voices</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and manage voices for your agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" data-testid="button-voice-lab">
            <Mic className="h-4 w-4 mr-2" />
            Voice Lab
          </Button>
          <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white" data-testid="button-add-voice">
            <Upload className="h-4 w-4 mr-2" />
            Add Voice
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search voices by name, accent, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-voices"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? "bg-black dark:bg-white dark:text-black" : ""}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Demo Text Input */}
      <Card className="p-4">
        <div className="space-y-3">
          <h3 className="font-medium">Preview Text</h3>
          <Input
            value={demoText}
            onChange={(e) => setDemoText(e.target.value)}
            placeholder="Enter text to preview with selected voice..."
            className="font-mono text-sm"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Stability</label>
              <Slider
                value={[voiceSettings.stability]}
                onValueChange={([value]) => setVoiceSettings({ ...voiceSettings, stability: value })}
                max={1}
                step={0.01}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Similarity Boost</label>
              <Slider
                value={[voiceSettings.similarityBoost]}
                onValueChange={([value]) => setVoiceSettings({ ...voiceSettings, similarityBoost: value })}
                max={1}
                step={0.01}
                className="mt-2"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Voices Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVoices.map((voice) => (
            <Card key={voice.voice_id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{voice.name}</h3>
                      {voice.isPremium && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          Premium
                        </Badge>
                      )}
                      {voice.isCustom && (
                        <Badge variant="outline" className="text-xs">
                          Custom
                        </Badge>
                      )}
                    </div>
                    {voice.labels && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {voice.labels.accent && (
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {voice.labels.accent}
                          </Badge>
                        )}
                        {voice.labels.gender && (
                          <Badge variant="outline" className="text-xs">
                            <User className="h-3 w-3 mr-1" />
                            {voice.labels.gender}
                          </Badge>
                        )}
                        {voice.labels.age && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {voice.labels.age}
                          </Badge>
                        )}
                      </div>
                    )}
                    {voice.labels?.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {voice.labels.description}
                      </p>
                    )}
                    {voice.labels?.use_case && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Best for: {voice.labels.use_case}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => playVoicePreview(voice.voice_id, voice.preview_url)}
                    data-testid={`button-preview-${voice.voice_id}`}
                  >
                    {playingVoiceId === voice.voice_id ? (
                      <>
                        <Pause className="h-4 w-4 mr-1" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        Preview
                      </>
                    )}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white"
                    data-testid={`button-use-${voice.voice_id}`}
                  >
                    <Volume2 className="h-4 w-4 mr-1" />
                    Use Voice
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filteredVoices.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <AudioWaveform className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No voices found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? `No voices match "${searchQuery}"` : "No voices available in this category"}
          </p>
          <Button className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black text-white">
            <Upload className="h-4 w-4 mr-2" />
            Create Custom Voice
          </Button>
        </div>
      )}
    </div>
  );
}