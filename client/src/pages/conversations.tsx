import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Phone, MessageSquare, Clock, Calendar, User, Bot, 
  Search, ChevronRight, Star, ThumbsUp, ThumbsDown,
  PlayCircle, PauseCircle, Download, ExternalLink
} from "lucide-react";
import { TranscriptViewer } from "@/components/transcript-viewer";

interface Conversation {
  conversation_id: string;
  agent_id: string;
  user_id?: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  status: string;
  transcript?: any[];
  metadata?: Record<string, any>;
  feedback?: {
    rating?: number;
    comment?: string;
  };
}

export default function Conversations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const { toast } = useToast();

  // Fetch agents for filter
  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch conversations
  const { data: conversationsData, isLoading, refetch } = useQuery({
    queryKey: ["/api/convai/conversations", selectedAgentId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAgentId) params.append("agent_id", selectedAgentId);
      
      const response = await fetch(`/api/convai/conversations?${params}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        if (response.status === 400) {
          const error = await response.json();
          if (error.message?.includes("API key not configured")) {
            return { conversations: [], error: "Please configure your ElevenLabs API key in Integrations" };
          }
        }
        throw new Error("Failed to fetch conversations");
      }
      
      return await response.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const conversations = conversationsData?.conversations || [];
  const apiError = conversationsData?.error;

  // Fetch conversation details
  const fetchConversationDetails = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/convai/conversations/${conversationId}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch conversation details");
      }
      
      const data = await response.json();
      setSelectedConversation(data);
      setShowDetails(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch conversation details",
        variant: "destructive",
      });
    }
  };

  // Send feedback mutation
  const sendFeedbackMutation = useMutation({
    mutationFn: async ({ conversationId, feedback }: { conversationId: string; feedback: any }) => {
      const response = await fetch(`/api/convai/conversations/${conversationId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ feedback }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to send feedback");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback Sent",
        description: "Your feedback has been recorded successfully.",
      });
      setShowFeedback(false);
      setFeedbackRating(5);
      setFeedbackComment("");
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendFeedback = () => {
    if (selectedConversation) {
      sendFeedbackMutation.mutate({
        conversationId: selectedConversation.conversation_id,
        feedback: {
          rating: feedbackRating,
          comment: feedbackComment,
        },
      });
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
    }
  };

  const filteredConversations = conversations.filter((conv: Conversation) => {
    const searchLower = searchTerm.toLowerCase();
    const agentName = agents.find(a => a.elevenLabsAgentId === conv.agent_id)?.name || "";
    return (
      conv.conversation_id.toLowerCase().includes(searchLower) ||
      agentName.toLowerCase().includes(searchLower) ||
      conv.user_id?.toLowerCase().includes(searchLower) ||
      JSON.stringify(conv.transcript).toLowerCase().includes(searchLower)
    );
  });

  if (apiError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conversations</h1>
          <p className="text-muted-foreground">View and manage all agent conversations</p>
        </div>
        
        <Card className="p-6">
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">API Key Required</p>
            <p className="text-muted-foreground">{apiError}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Conversations</h1>
        <p className="text-muted-foreground">View and manage all agent conversations</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.elevenLabsAgentId}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => refetch()} variant="outline">
            Refresh
          </Button>
        </div>
      </Card>

      {/* Conversations List */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredConversations.length === 0 ? (
        <Card className="p-6">
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Conversations Found</p>
            <p className="text-muted-foreground">
              {searchTerm || selectedAgentId 
                ? "Try adjusting your filters" 
                : "Conversations will appear here once agents start having calls"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredConversations.map((conversation: Conversation) => {
            const agent = agents.find(a => a.elevenLabsAgentId === conversation.agent_id);
            
            return (
              <Card 
                key={conversation.conversation_id} 
                className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => fetchConversationDetails(conversation.conversation_id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <Bot className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{agent?.name || 'Unknown Agent'}</p>
                        <p className="text-xs text-muted-foreground">ID: {conversation.conversation_id.slice(-8)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(conversation.start_time)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(conversation.duration_seconds)}
                      </div>
                      {conversation.user_id && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {conversation.user_id}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(conversation.status)}>
                        {conversation.status || 'Unknown'}
                      </Badge>
                      {conversation.feedback && (
                        <Badge variant="outline" className="gap-1">
                          <Star className="h-3 w-3" />
                          Feedback Received
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Conversation Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversation Details</DialogTitle>
            <DialogDescription>
              View detailed information about this conversation
            </DialogDescription>
          </DialogHeader>
          
          {selectedConversation && (
            <div className="space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Conversation ID</Label>
                  <p className="font-mono text-sm">{selectedConversation.conversation_id}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Agent</Label>
                  <p className="text-sm">
                    {agents.find(a => a.elevenLabsAgentId === selectedConversation.agent_id)?.name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Start Time</Label>
                  <p className="text-sm">{formatDate(selectedConversation.start_time)}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Duration</Label>
                  <p className="text-sm">{formatDuration(selectedConversation.duration_seconds)}</p>
                </div>
              </div>

              {/* Transcript */}
              {selectedConversation.transcript && (
                <div>
                  <Label className="text-sm text-muted-foreground mb-2">Transcript</Label>
                  <Card className="p-4 max-h-[300px] overflow-y-auto">
                    <TranscriptViewer 
                      transcript={JSON.stringify(selectedConversation.transcript)} 
                    />
                  </Card>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setShowDetails(false);
                    setShowFeedback(true);
                  }}
                  variant="outline"
                >
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Send Feedback
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help improve the agent by providing feedback on this conversation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    variant={feedbackRating >= rating ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFeedbackRating(rating)}
                  >
                    <Star className={`h-4 w-4 ${feedbackRating >= rating ? 'fill-current' : ''}`} />
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <Label htmlFor="feedback-comment">Comments (Optional)</Label>
              <Textarea
                id="feedback-comment"
                placeholder="Share your thoughts about this conversation..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedback(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendFeedback}
              disabled={sendFeedbackMutation.isPending}
            >
              {sendFeedbackMutation.isPending ? "Sending..." : "Send Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}