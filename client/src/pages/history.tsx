import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Bot, Calendar } from "lucide-react";
import { CallDetailModal } from "@/components/modals/call-detail-modal";
import type { CallLog, Agent } from "@shared/schema";

export default function History() {
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);

  const { data: callLogs, isLoading } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "failed":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      case "in_progress":
        return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
      default:
        return "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200";
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getAgentName = (agentId: string) => {
    const agent = agents?.find(a => a.id === agentId);
    return agent?.name || "Unknown Agent";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">
            Call History
          </h2>
          <p className="text-gray-600 dark:text-gray-400" data-testid="text-page-description">
            View and analyze past voice interactions
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48" data-testid="select-agent-filter">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-48"
            data-testid="input-date-filter"
          />
        </div>
      </div>

      {/* Call History Table */}
      <Card className="border border-gray-200 dark:border-gray-700 overflow-hidden">
        {!callLogs || callLogs.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2" data-testid="text-no-calls-title">
              No call history found
            </h3>
            <p className="text-gray-600 dark:text-gray-400" data-testid="text-no-calls-description">
              Call logs will appear here once your agents start receiving calls.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Call Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {callLogs.map((callLog) => (
                  <tr key={callLog.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white" data-testid={`text-call-id-${callLog.id}`}>
                          Call #{callLog.id.slice(-6)}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400" data-testid={`text-call-time-${callLog.id}`}>
                          {new Date(callLog.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3">
                          <Bot className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white" data-testid={`text-agent-name-${callLog.id}`}>
                          {getAgentName(callLog.agentId)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white" data-testid={`text-duration-${callLog.id}`}>
                      {formatDuration(callLog.duration)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={getStatusColor(callLog.status)} data-testid={`badge-status-${callLog.id}`}>
                        {callLog.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCallLog(callLog)}
                        data-testid={`button-view-details-${callLog.id}`}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {callLogs && callLogs.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-500 dark:text-gray-400" data-testid="text-pagination-info">
              Showing 1 to {callLogs.length} of {callLogs.length} results
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled data-testid="button-previous-page">
                Previous
              </Button>
              <Button size="sm" data-testid="button-current-page">1</Button>
              <Button variant="outline" size="sm" disabled data-testid="button-next-page">
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CallDetailModal
        callLog={selectedCallLog}
        open={!!selectedCallLog}
        onOpenChange={(open) => !open && setSelectedCallLog(null)}
      />
    </div>
  );
}
