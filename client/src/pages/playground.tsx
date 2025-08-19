import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  Loader2, Activity, Circle, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Agent, Integration } from "@shared/schema";

interface ConversationMessage {
  role: "assistant" | "user";
  message: string;
  timestamp: Date;
}

export default function Playground() {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<ConversationMessage[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch integration to get API key
  const { data: integration } = useQuery<Integration>({
    queryKey: ["/api/integrations/elevenlabs"],
    enabled: !!selectedAgent,
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Update call duration
  useEffect(() => {
    if (isCallActive) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      setCallDuration(0);
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isCallActive]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    if (!selectedAgent) {
      toast({
        title: "Select an agent",
        description: "Please select an agent to test",
        variant: "destructive",
      });
      return;
    }

    if (!integration || integration.status !== "ACTIVE") {
      toast({
        title: "ElevenLabs not configured",
        description: "Please configure your ElevenLabs API key in Integrations",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Setup audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Start audio level monitoring
      monitorAudioLevel();

      const agent = agents.find(a => a.id === selectedAgent);
      if (!agent) return;

      // Get signed URL for WebSocket connection
      const response = await apiRequest("POST", "/api/playground/start-session", {
        agentId: agent.elevenLabsAgentId
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to start session");
      }

      const { signedUrl } = data;

      // Connect to ElevenLabs WebSocket
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsCallActive(true);
        
        // Add initial message
        if (agent.firstMessage) {
          setTranscript([{
            role: "assistant",
            message: agent.firstMessage,
            timestamp: new Date()
          }]);
        }

        toast({
          title: "Call started",
          description: `Connected to ${agent.name}`,
        });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "audio") {
          // Play audio if speaker is on
          if (isSpeakerOn) {
            playAudio(data.audio);
          }
        } else if (data.type === "transcript") {
          // Update transcript
          setTranscript(prev => [...prev, {
            role: data.role,
            message: data.message,
            timestamp: new Date()
          }]);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Connection error",
          description: "Failed to connect to agent",
          variant: "destructive",
        });
        endCall();
      };

      ws.onclose = () => {
        setIsCallActive(false);
        setIsConnecting(false);
      };

      // Start sending audio
      startAudioStreaming(stream, ws);

    } catch (error) {
      console.error("Error starting call:", error);
      toast({
        title: "Failed to start call",
        description: error instanceof Error ? error.message : "Please check your microphone permissions",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsCallActive(false);
    setIsConnecting(false);
    setAudioLevel(0);

    toast({
      title: "Call ended",
      description: `Duration: ${formatDuration(callDuration)}`,
    });
  };

  const toggleMute = () => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const checkAudioLevel = () => {
      if (!analyserRef.current || !isCallActive) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255); // Normalize to 0-1
      
      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  const startAudioStreaming = (stream: MediaStream, ws: WebSocket) => {
    // This would require implementing audio streaming to WebSocket
    // For now, this is a placeholder
    console.log("Audio streaming would start here");
  };

  const playAudio = (audioData: string) => {
    // Decode and play audio from base64
    const audio = new Audio(`data:audio/wav;base64,${audioData}`);
    audio.play();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Agent Playground</h1>
        <p className="text-muted-foreground">
          Test your voice AI agents with real-time voice conversations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Selection */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Select Agent</h3>
            <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={isCallActive}>
              <SelectTrigger data-testid="select-agent">
                <SelectValue placeholder="Choose an agent to test" />
              </SelectTrigger>
              <SelectContent>
                {agentsLoading ? (
                  <div className="p-2 text-center">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  </div>
                ) : agents.length > 0 ? (
                  agents.map((agent: Agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-center text-muted-foreground">
                    No agents configured
                  </div>
                )}
              </SelectContent>
            </Select>

            {selectedAgent && (
              <div className="mt-4 space-y-2">
                {agents.find(a => a.id === selectedAgent) && (
                  <>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Description:</span>
                      <p className="mt-1">
                        {agents.find(a => a.id === selectedAgent)?.description || "No description"}
                      </p>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Voice:</span>
                      <p className="mt-1">
                        {agents.find(a => a.id === selectedAgent)?.voiceId || "Default voice"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* Call Status */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Call Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {isCallActive ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <Circle className="w-2 h-2 fill-current mr-1 animate-pulse" />
                    Active
                  </Badge>
                ) : isConnecting ? (
                  <Badge variant="outline">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Connecting
                  </Badge>
                ) : (
                  <Badge variant="outline">Idle</Badge>
                )}
              </div>
              
              {isCallActive && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Duration</span>
                    <span className="font-mono text-sm">{formatDuration(callDuration)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Audio Level</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-3 rounded-full transition-colors ${
                            audioLevel > (i / 5) ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Notice */}
          <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Test Environment</p>
                <p className="text-xs text-muted-foreground">
                  This playground uses your ElevenLabs API key. Voice calls will consume your ElevenLabs credits.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Voice Call Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            {/* Visualization Area */}
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="relative">
                {/* Circular Visualization */}
                <div className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all ${
                  isCallActive ? "animate-pulse" : ""
                }`}>
                  {/* Background circles - subtle borders only */}
                  <div className="absolute inset-0 rounded-full border border-gray-200 dark:border-gray-800" />
                  <div className="absolute inset-4 rounded-full border border-gray-200 dark:border-gray-800" />
                  <div className="absolute inset-8 rounded-full border border-gray-200 dark:border-gray-800" />
                  
                  {/* Center button */}
                  <button
                    className={`relative z-10 rounded-full w-32 h-32 transition-all duration-200 ${
                      isCallActive 
                        ? "bg-red-500 hover:bg-red-600 text-white" 
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                    } ${isConnecting || !selectedAgent ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={isCallActive ? endCall : startCall}
                    disabled={isConnecting || !selectedAgent}
                    data-testid="button-call"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : isCallActive ? (
                      <PhoneOff className="w-8 h-8" />
                    ) : (
                      <div className="text-center">
                        <Phone className="w-8 h-8 mx-auto mb-2" />
                        <span className="text-sm font-medium">Try a call</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Audio level indicator */}
                {isCallActive && (
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                    <Activity className="w-6 h-6 text-green-500" />
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            {isCallActive && (
              <div className="border-t p-4">
                <div className="flex justify-center gap-4">
                  <Button
                    variant={isMuted ? "destructive" : "outline"}
                    size="icon"
                    onClick={toggleMute}
                    data-testid="button-mute"
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    variant={!isSpeakerOn ? "destructive" : "outline"}
                    size="icon"
                    onClick={toggleSpeaker}
                    data-testid="button-speaker"
                  >
                    {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Transcript */}
            <div className="border-t">
              <div className="p-3 border-b bg-muted/50">
                <h4 className="text-sm font-medium">Call Transcript</h4>
              </div>
              <ScrollArea className="h-48">
                <div className="p-4 space-y-3">
                  {transcript.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Transcript will appear here when you start a call
                    </p>
                  ) : (
                    transcript.map((msg, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={msg.role === "assistant" ? "default" : "secondary"} className="text-xs">
                            {msg.role === "assistant" ? "Assistant" : "You"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {msg.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm pl-2">{msg.message}</p>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </ScrollArea>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}