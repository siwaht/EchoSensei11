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
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch integration to get API key status
  const { data: integration, isLoading: integrationLoading } = useQuery<any>({
    queryKey: ["/api/integrations"],
    retry: 1,
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

    // Check if integration exists and is active
    if (!integration) {
      toast({
        title: "API not configured", 
        description: "Please add your VoiceAI API key in the Integrations tab",
        variant: "destructive",
      });
      return;
    }
    
    if (integration.status !== "ACTIVE") {
      toast({
        title: "API integration inactive", 
        description: "Please test your API key in the Integrations tab to activate it",
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

      // Connect to VoiceAI WebSocket
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected, sending initialization message");
        
        // Send minimal initialization message
        // The agent configuration (including knowledge base) is already set on ElevenLabs side
        const initMessage = {
          type: "conversation_initiation_client_data"
        };
        
        console.log("Sending init message:", initMessage);
        ws.send(JSON.stringify(initMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket message:", data);
          
          // Handle different message formats from VoiceAI
          if (data.type === "conversation_initiation_metadata") {
            console.log("Conversation metadata received:", data.conversation_initiation_metadata_event);
            
            // Now we're ready to start the conversation
            setIsConnecting(false);
            setIsCallActive(true);
            
            // Start audio streaming after successful initialization
            if (mediaStreamRef.current) {
              console.log("Starting audio stream to WebSocket");
              startAudioStreaming(mediaStreamRef.current, ws);
            }
            
            toast({
              title: "Call started",
              description: `Connected to ${agents.find(a => a.id === selectedAgent)?.name}`,
            });
            
            // Send a small audio chunk to trigger the agent to speak first
            // This is a workaround for agents that don't automatically start
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                // Send a tiny silence to trigger agent response
                const silentAudio = new Int16Array(160); // 10ms of silence at 16kHz
                const uint8 = new Uint8Array(silentAudio.buffer);
                const binaryString = Array.from(uint8)
                  .map(byte => String.fromCharCode(byte))
                  .join('');
                const base64Audio = btoa(binaryString);
                
                ws.send(JSON.stringify({
                  user_audio_chunk: base64Audio
                }));
                console.log("Sent trigger audio to start conversation");
              }
            }, 500);
          } else if (data.audio || data.audio_event) {
            // Agent audio response - queue it for sequential playback
            const audioData = data.audio || data.audio_event?.audio_base_64 || data.audio_event?.audio || data.audio_base_64;
            if (audioData && isSpeakerOn) {
              console.log("Queueing agent audio, length:", audioData.length);
              queueAudio(audioData);
            } else if (audioData) {
              console.log("Received audio but speaker is off");
            }
          } else if (data.audio_base_64) {
            // Some agents send audio directly as audio_base_64
            if (isSpeakerOn) {
              console.log("Queueing agent audio (direct), length:", data.audio_base_64.length);
              queueAudio(data.audio_base_64);
            }
          } else if (data.transcript_event || data.user_transcription_event) {
            // Handle transcript events
            const transcript = data.transcript_event || data.user_transcription_event;
            
            if (transcript.user_transcript) {
              console.log("User said:", transcript.user_transcript);
              setTranscript(prev => [...prev, {
                role: "user",
                message: transcript.user_transcript,
                timestamp: new Date()
              }]);
            } else if (transcript.text) {
              const role = transcript.role || (data.user_transcription_event ? "user" : "assistant");
              console.log(`${role} said:`, transcript.text);
              setTranscript(prev => [...prev, {
                role: role as "user" | "assistant",
                message: transcript.text,
                timestamp: new Date()
              }]);
            }
          } else if (data.agent_response_event) {
            // Handle agent response - both text and audio
            if (data.agent_response_event.agent_response) {
              console.log("Agent response:", data.agent_response_event.agent_response);
              setTranscript(prev => [...prev, {
                role: "assistant",
                message: data.agent_response_event.agent_response,
                timestamp: new Date()
              }]);
            } else if (data.agent_response_event.text) {
              console.log("Agent response text:", data.agent_response_event.text);
              setTranscript(prev => [...prev, {
                role: "assistant",
                message: data.agent_response_event.text,
                timestamp: new Date()
              }]);
            }
          } else if (data.message) {
            // Simple text message from agent
            console.log("Agent message:", data.message);
            setTranscript(prev => [...prev, {
              role: "assistant",
              message: data.message,
              timestamp: new Date()
            }]);
          } else if (data.ping_event) {
            // Keep alive - respond with pong
            const pongMessage = {
              type: "pong_event",
              event_id: data.ping_event.event_id
            };
            ws.send(JSON.stringify(pongMessage));
            console.log("Sent pong response");
          } else if (data.error || data.error_event) {
            const errorInfo = data.error || data.error_event;
            console.error('ElevenLabs error:', errorInfo);
            toast({
              title: "Agent Error",
              description: errorInfo.message || errorInfo.error || "Connection error occurred",
              variant: "destructive",
            });
            endCall();
          } else if (data.interruption_event) {
            console.log('User interrupted agent');
          } else if (data.agent_response_correction_event) {
            console.log('Agent response correction:', data.agent_response_correction_event);
          } else {
            console.log('Unhandled message type:', data.type || 'unknown', data);
          }
        } catch (error) {
          console.error("Error handling WebSocket message:", error, "Raw data:", event.data);
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

      ws.onclose = (event) => {
        console.log('WebSocket closed:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
        
        // Only show error if not a normal closure (1000 or 1001 are normal closures)
        if (!event.wasClean && event.code !== 1000 && event.code !== 1001) {
          // Check if this is an unexpected closure and we haven't already ended the call
          if (wsRef.current === ws && isCallActive) {
            toast({
              title: "Connection lost",
              description: `Connection closed unexpectedly (Code: ${event.code})`,
              variant: "destructive",
            });
            endCall();
          }
        } else if (event.code === 1000 || event.code === 1001) {
          // Normal closure, just cleanup
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
        }
      };

      // Audio streaming will start after conversation initialization

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
    console.log('Ending call immediately...');
    
    // Save duration before resetting
    const finalDuration = callDuration;
    
    // Immediately update UI state
    setIsCallActive(false);
    setIsConnecting(false);
    setCallDuration(0);
    setTranscript([]);
    setAudioLevel(0);
    
    // Clear audio queue and stop playback
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    
    // Stop all audio elements on page
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.src = '';
      audio.remove();
    });
    
    // Close WebSocket immediately with normal closure code
    if (wsRef.current) {
      // Disconnect audio processor if it exists
      const ws: any = wsRef.current;
      if (ws.audioProcessor) {
        ws.audioProcessor.disconnect();
        ws.audioProcessor = null;
      }
      if (ws.audioContext && ws.audioContext.state !== 'closed') {
        try {
          ws.audioContext.close();
        } catch (e) {
          console.error('Error closing audio context from ws:', e);
        }
        ws.audioContext = null;
      }
      
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        try {
          wsRef.current.close(1000, 'User ended call');
        } catch (e) {
          console.error('Error closing WebSocket:', e);
        }
      }
      wsRef.current = null;
    }
    
    // Stop media stream tracks immediately
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      mediaStreamRef.current = null;
    }

    // Close audio context immediately
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.error('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }
    
    toast({
      title: "Call ended",
      description: `Duration: ${formatDuration(finalDuration)}`,
    });
    
    console.log('Call ended successfully');
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
    console.log("Starting audio streaming to WebSocket");
    
    // Create audio context at 16kHz as required by ElevenLabs
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1); // Larger buffer for better performance
    
    let chunkCount = 0;
    let audioBuffer: number[] = [];
    let lastSendTime = Date.now();
    
    processor.onaudioprocess = (e) => {
      if (ws.readyState === WebSocket.OPEN && !isMuted) {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert float32 to PCM 16-bit and add to buffer
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          const sample = s < 0 ? s * 0x8000 : s * 0x7FFF;
          audioBuffer.push(sample);
        }
        
        // Send chunks every 250ms as recommended by ElevenLabs
        const now = Date.now();
        if (now - lastSendTime >= 250 && audioBuffer.length > 0) {
          // Convert buffer to Int16Array
          const pcm16 = new Int16Array(audioBuffer);
          
          // Convert to base64
          const uint8 = new Uint8Array(pcm16.buffer);
          const binaryString = Array.from(uint8)
            .map(byte => String.fromCharCode(byte))
            .join('');
          const base64Audio = btoa(binaryString);
          
          // Send audio chunk
          const message = {
            user_audio_chunk: base64Audio
          };
          
          ws.send(JSON.stringify(message));
          chunkCount++;
          
          // Clear buffer and update time
          audioBuffer = [];
          lastSendTime = now;
          
          // Log every 10th chunk to avoid spam
          if (chunkCount % 10 === 0) {
            console.log(`Sent ${chunkCount} audio chunks (250ms intervals)`);
          }
        }
      }
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    // Store for cleanup
    (ws as any).audioProcessor = processor;
    (ws as any).audioContext = audioContext;
    
    console.log("Audio streaming setup complete with 250ms chunking");
  };

  // Queue audio chunks and play them sequentially
  const queueAudio = (audioData: string) => {
    audioQueueRef.current.push(audioData);
    processAudioQueue();
  };
  
  const processAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !isSpeakerOn) {
      return;
    }
    
    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;
    
    try {
      // VoiceAI sends PCM 16-bit audio at 16kHz encoded in base64
      // We need to convert it to a playable format
      
      // Decode base64 to binary
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert PCM to WAV format for playback
      const pcmData = new Int16Array(bytes.buffer);
      const wavBuffer = createWavFromPcm(pcmData, 16000); // 16kHz sample rate
      
      // Create blob and play
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      
      // When audio ends, process next in queue
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        processAudioQueue(); // Process next audio in queue
      });
      
      audio.addEventListener('error', () => {
        console.error('Audio playback error');
        isPlayingRef.current = false;
        currentAudioRef.current = null;
        processAudioQueue(); // Continue with next audio even on error
      });
      
      await audio.play();
      console.log('Playing audio chunk from queue');
    } catch (error) {
      console.error('Error playing audio:', error);
      isPlayingRef.current = false;
      processAudioQueue(); // Continue processing queue on error
    }
  };
  
  // Helper function to create WAV header for PCM data
  const createWavFromPcm = (pcmData: Int16Array, sampleRate: number): ArrayBuffer => {
    const length = pcmData.length * 2; // 2 bytes per sample
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, length, true);
    
    // Copy PCM data
    const uint8View = new Uint8Array(arrayBuffer, 44);
    const pcmUint8 = new Uint8Array(pcmData.buffer);
    uint8View.set(pcmUint8);
    
    return arrayBuffer;
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
                  This playground uses your VoiceAI API key. Voice calls will consume your API credits.
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
                <div className="relative w-64 h-64 rounded-full flex items-center justify-center">
                  {/* Animated rings when active */}
                  {isCallActive && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-green-500 animate-ping opacity-20" />
                      <div className="absolute inset-4 rounded-full border-2 border-green-500 animate-ping animation-delay-200 opacity-15" />
                      <div className="absolute inset-8 rounded-full border-2 border-green-500 animate-ping animation-delay-400 opacity-10" />
                    </>
                  )}
                  
                  {/* Static rings */}
                  <div className="absolute inset-0 rounded-full border border-gray-300 dark:border-gray-700" />
                  <div className="absolute inset-4 rounded-full border border-gray-300 dark:border-gray-700" />
                  <div className="absolute inset-8 rounded-full border border-gray-300 dark:border-gray-700" />
                  
                  {/* Center button */}
                  <Button
                    size="lg"
                    variant={isCallActive ? "destructive" : "default"}
                    className={`relative z-10 rounded-full w-32 h-32 transition-all duration-200 ${
                      isConnecting || !selectedAgent ? "opacity-50 cursor-not-allowed" : ""
                    }`}
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
                  </Button>
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