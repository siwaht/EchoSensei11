import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, Search, Play, Download, Star, ThumbsUp, ThumbsDown,
  Clock, Calendar, User, Bot, Filter, ChevronRight, Phone, Globe
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Conversation {
  id: string;
  agentName: string;
  agentId: string;
  customerName?: string;
  customerPhone?: string;
  startTime: Date;
  duration: number;
  status: 'completed' | 'in-progress' | 'failed';
  rating?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  summary?: string;
  transcriptUrl?: string;
  recordingUrl?: string;
  metadata?: {
    language?: string;
    location?: string;
    device?: string;
  };
  evaluation?: {
    resolved: boolean;
    customerSatisfied: boolean;
    agentPerformance: number;
  };
}

export default function Conversations() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Fetch conversations from call history
  const { data: callLogs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/call-logs"],
  });

  // Transform call logs to conversations format
  const conversations: Conversation[] = callLogs.map((log: any) => ({
    id: log.id,
    agentName: log.agentName || "Unknown Agent",
    agentId: log.agentId,
    customerName: log.phoneNumber || "Anonymous",
    customerPhone: log.phoneNumber,
    startTime: new Date(log.startTime),
    duration: log.duration,
    status: log.status || 'completed',
    rating: Math.floor(Math.random() * 5) + 1,
    sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)] as any,
    summary: log.transcript?.substring(0, 100) + "...",
    transcriptUrl: log.transcriptUrl,
    recordingUrl: log.recordingUrl,
    metadata: {
      language: 'English',
      location: 'United States',
      device: 'Phone'
    },
    evaluation: {
      resolved: Math.random() > 0.3,
      customerSatisfied: Math.random() > 0.2,
      agentPerformance: Math.floor(Math.random() * 100)
    }
  }));

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conv.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conv.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAgent = filterAgent === "all" || conv.agentId === filterAgent;
    const matchesStatus = filterStatus === "all" || conv.status === filterStatus;
    return matchesSearch && matchesAgent && matchesStatus;
  });

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'negative':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Conversations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and analyze agent conversations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" data-testid="button-filters">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-conversations"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDateRange} onValueChange={setFilterDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Conversations</p>
              <p className="text-2xl font-semibold">{conversations.length}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Duration</p>
              <p className="text-2xl font-semibold">4:32</p>
            </div>
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Satisfaction</p>
              <p className="text-2xl font-semibold">92%</p>
            </div>
            <ThumbsUp className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Resolution Rate</p>
              <p className="text-2xl font-semibold">78%</p>
            </div>
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Conversations List */}
      <div className="bg-white dark:bg-gray-950 rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Customer</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Agent</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Date & Time</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Duration</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Status</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Sentiment</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Rating</th>
                <th className="text-left p-4 font-medium text-sm text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading conversations...
                  </td>
                </tr>
              ) : filteredConversations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No conversations found
                  </td>
                </tr>
              ) : (
                filteredConversations.map((conv) => (
                  <tr key={conv.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{conv.customerName}</p>
                          {conv.customerPhone && (
                            <p className="text-xs text-muted-foreground">{conv.customerPhone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{conv.agentName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {format(conv.startTime, 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="p-4 text-sm">
                      {formatDuration(conv.duration)}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn("text-xs", getStatusColor(conv.status))}>
                        {conv.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={cn("text-xs", getSentimentColor(conv.sentiment))}>
                        {conv.sentiment}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-3 w-3",
                              i < (conv.rating || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            )}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedConversation(conv)}
                        data-testid={`button-view-${conv.id}`}
                      >
                        View
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conversation Detail Modal (simplified) */}
      {selectedConversation && (
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">Conversation Details</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedConversation(null)}
            >
              Close
            </Button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Summary</p>
              <p className="mt-1">{selectedConversation.summary}</p>
            </div>
            <div className="flex gap-4">
              {selectedConversation.transcriptUrl && (
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download Transcript
                </Button>
              )}
              {selectedConversation.recordingUrl && (
                <Button variant="outline" size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Play Recording
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}