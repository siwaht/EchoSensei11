import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { 
  Mic, MicOff, Phone, PhoneOff, Send, Bot, User, 
  Volume2, Loader2, Play, Square, MessageSquare 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Agent } from "@shared/schema";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: Date;
}

export default function Playground() {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with first message when agent is selected
  useEffect(() => {
    if (selectedAgent) {
      const agent = agents.find((a: any) => a.id === selectedAgent);
      if (agent && agent.firstMessage) {
        setMessages([{
          id: Date.now().toString(),
          role: "assistant",
          content: agent.firstMessage,
          timestamp: new Date()
        }]);
      }
    }
  }, [selectedAgent, agents]);

  const handleStartCall = () => {
    if (!selectedAgent) {
      toast({
        title: "Select an agent",
        description: "Please select an agent to test",
        variant: "destructive",
      });
      return;
    }

    setIsCallActive(true);
    const agent = agents.find((a: any) => a.id === selectedAgent);
    
    // Add initial greeting
    if (agent?.firstMessage && messages.length === 0) {
      setMessages([{
        id: Date.now().toString(),
        role: "assistant",
        content: agent.firstMessage,
        timestamp: new Date()
      }]);
    }

    toast({
      title: "Test Call Started",
      description: `Testing agent: ${agent?.name}`,
    });
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    setIsMicActive(false);
    
    // Add call ended message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "assistant",
      content: "Call ended. Thank you for testing!",
      timestamp: new Date()
    }]);

    toast({
      title: "Test Call Ended",
      description: "The test session has been terminated",
    });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !isCallActive) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsProcessing(true);

    // Simulate agent response (in production, this would call ElevenLabs API)
    setTimeout(() => {
      const agent = agents.find((a: any) => a.id === selectedAgent);
      const responses = [
        "I understand your request. Let me help you with that.",
        "That's a great question! Here's what I can tell you...",
        "Thank you for that information. Is there anything else you'd like to know?",
        "I'm here to assist you. Let me process that for you.",
        "Based on what you've told me, I would recommend...",
      ];
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsProcessing(false);
    }, 1000 + Math.random() * 1000);
  };

  const toggleMic = () => {
    if (!isCallActive) {
      toast({
        title: "Start a call first",
        description: "Please start a test call before using the microphone",
        variant: "destructive",
      });
      return;
    }

    setIsMicActive(!isMicActive);
    
    if (!isMicActive) {
      toast({
        title: "Microphone Activated",
        description: "Voice input simulation active (text-only in test mode)",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Agent Playground</h1>
        <p className="text-muted-foreground">
          Test and interact with your voice AI agents in a controlled environment
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Selection and Controls */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Select Agent</h3>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger data-testid="select-agent">
                <SelectValue placeholder="Choose an agent to test" />
              </SelectTrigger>
              <SelectContent>
                {agentsLoading ? (
                  <div className="p-2 text-center">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  </div>
                ) : agents.length > 0 ? (
                  agents.map((agent: any) => (
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
                {agents.find((a: any) => a.id === selectedAgent) && (
                  <>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Agent ID:</span>
                      <p className="font-mono text-xs mt-1">
                        {agents.find((a: any) => a.id === selectedAgent)?.elevenLabsAgentId}
                      </p>
                    </div>
                    {agents.find((a: any) => a.id === selectedAgent)?.description && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Description:</span>
                        <p className="mt-1">
                          {agents.find((a: any) => a.id === selectedAgent)?.description}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Call Controls</h3>
            <div className="space-y-3">
              {!isCallActive ? (
                <Button 
                  className="w-full" 
                  onClick={handleStartCall}
                  disabled={!selectedAgent}
                  data-testid="button-start-call"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Start Test Call
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  variant="destructive"
                  onClick={handleEndCall}
                  data-testid="button-end-call"
                >
                  <PhoneOff className="w-4 h-4 mr-2" />
                  End Call
                </Button>
              )}

              <Button
                className="w-full"
                variant={isMicActive ? "default" : "outline"}
                onClick={toggleMic}
                disabled={!isCallActive}
                data-testid="button-toggle-mic"
              >
                {isMicActive ? (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Microphone On
                  </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Microphone Off
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                {isCallActive ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    <span className="w-2 h-2 bg-green-600 rounded-full mr-1 animate-pulse" />
                    Call in progress
                  </Badge>
                ) : (
                  <Badge variant="outline">Idle</Badge>
                )}
              </div>
              {isCallActive && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-mono">00:00</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Test Mode</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>This is a testing environment for your agents.</p>
              <p>• Text-based simulation only</p>
              <p>• No actual voice calls are made</p>
              <p>• Responses are simulated for testing</p>
            </div>
          </Card>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col">
              <div className="border-b px-4">
                <TabsList className="grid w-[200px] grid-cols-2">
                  <TabsTrigger value="test">Test</TabsTrigger>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="test" className="flex-1 p-4">
                <div className="h-full flex items-center justify-center text-center">
                  <div className="space-y-4">
                    <Volume2 className="w-16 h-16 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold mb-2">Voice Test Mode</h3>
                      <p className="text-sm text-muted-foreground">
                        Voice testing will be available when ElevenLabs WebSocket API is configured
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="chat" className="flex-1 flex flex-col p-0">
                <div className="flex-1 flex flex-col">
                  {/* Messages Area */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.length === 0 && !isCallActive ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3" />
                          <p>Start a test call to begin chatting with your agent</p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${
                              message.role === "user" ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`flex gap-3 max-w-[80%] ${
                                message.role === "user" ? "flex-row-reverse" : "flex-row"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                message.role === "user" 
                                  ? "bg-primary text-primary-foreground" 
                                  : "bg-muted"
                              }`}>
                                {message.role === "user" ? (
                                  <User className="w-4 h-4" />
                                ) : (
                                  <Bot className="w-4 h-4" />
                                )}
                              </div>
                              <div className={`rounded-lg px-4 py-2 ${
                                message.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}>
                                <p className="text-sm">{message.content}</p>
                                <p className={`text-xs mt-1 ${
                                  message.role === "user" 
                                    ? "text-primary-foreground/70" 
                                    : "text-muted-foreground"
                                }`}>
                                  {message.timestamp.toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      {isProcessing && (
                        <div className="flex gap-3 justify-start">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="bg-muted rounded-lg px-4 py-3">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input Area */}
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder={isCallActive ? "Type your message..." : "Start a call to begin chatting"}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        disabled={!isCallActive || isProcessing}
                        data-testid="input-message"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!isCallActive || !inputText.trim() || isProcessing}
                        data-testid="button-send"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    {isMicActive && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                        <span>Voice input active (simulated)</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}