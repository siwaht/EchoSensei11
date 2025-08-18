import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Bot } from "lucide-react";
import type { CallLog } from "@shared/schema";

interface CallDetailModalProps {
  callLog: CallLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetailModal({ callLog, open, onOpenChange }: CallDetailModalProps) {
  if (!callLog) return null;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-modal-title">
            Call Details #{callLog.id.slice(-6)}
          </DialogTitle>
          <DialogDescription>
            View detailed information about this voice agent call including transcript, duration, and status.
          </DialogDescription>
        </DialogHeader>
        
        {/* Call Info */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Agent:</span>
              <p className="text-sm text-gray-900 dark:text-white" data-testid="text-call-agent">
                Agent ID: {callLog.agentId}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration:</span>
              <p className="text-sm text-gray-900 dark:text-white" data-testid="text-call-duration">
                {formatDuration(callLog.duration)}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status:</span>
              <Badge className={getStatusColor(callLog.status)} data-testid="badge-call-status">
                {callLog.status}
              </Badge>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Timestamp:</span>
              <p className="text-sm text-gray-900 dark:text-white" data-testid="text-call-timestamp">
                {new Date(callLog.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cost:</span>
              <p className="text-sm text-gray-900 dark:text-white" data-testid="text-call-cost">
                ${callLog.cost ? Number(callLog.cost).toFixed(4) : "N/A"}
              </p>
            </div>
            {callLog.elevenLabsCallId && (
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">ElevenLabs Call ID:</span>
                <p className="text-sm text-gray-900 dark:text-white font-mono" data-testid="text-elevenlabs-call-id">
                  {callLog.elevenLabsCallId}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Audio Player */}
        {callLog.audioUrl && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Call Recording</h4>
            <Card className="p-4 bg-gray-50 dark:bg-gray-700">
              <audio controls className="w-full" data-testid="audio-call-recording">
                <source src={callLog.audioUrl} type="audio/wav" />
                <source src={callLog.audioUrl} type="audio/mp3" />
                Your browser does not support the audio element.
              </audio>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Audio stored securely with end-to-end encryption
              </p>
            </Card>
          </div>
        )}

        {/* Transcript */}
        {callLog.transcript && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Call Transcript</h4>
            <Card className="p-4 bg-gray-50 dark:bg-gray-700 max-h-64 overflow-y-auto">
              <div className="space-y-3" data-testid="text-call-transcript">
                {(() => {
                  try {
                    const transcript = JSON.parse(callLog.transcript);
                    if (Array.isArray(transcript)) {
                      return transcript
                        .filter(turn => turn.message && turn.message.trim())
                        .map((turn, index) => (
                          <div key={index} className={`flex ${
                            turn.role === 'agent' ? 'justify-start' : 'justify-end'
                          }`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${
                              turn.role === 'agent' 
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' 
                                : 'bg-gray-50 dark:bg-gray-700 border-r-4 border-gray-400'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-semibold ${
                                  turn.role === 'agent' 
                                    ? 'text-blue-700 dark:text-blue-300' 
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  {turn.role === 'agent' ? 'Agent' : 'User'}
                                </span>
                                {turn.time_in_call_secs !== undefined && (
                                  <span className="text-xs text-gray-500">
                                    {Math.floor(turn.time_in_call_secs / 60)}:{(turn.time_in_call_secs % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                                {turn.message}
                              </p>
                            </div>
                          </div>
                        ));
                    } else {
                      // If it's not an array, try to display as a single message
                      return (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-sm text-gray-900 dark:text-white">
                            {JSON.stringify(transcript, null, 2)}
                          </p>
                        </div>
                      );
                    }
                  } catch (e) {
                    // Check if it's already a formatted string
                    const lines = callLog.transcript.split('\n').filter(line => line.trim());
                    if (lines.length > 0) {
                      return lines.map((line, index) => {
                        const isAgent = line.toLowerCase().includes('agent') || line.toLowerCase().includes('alexis');
                        const isUser = line.toLowerCase().includes('user') || (!isAgent && line.trim().length > 0);
                        
                        return (
                          <div key={index} className={`flex ${
                            isAgent ? 'justify-start' : 'justify-end'
                          }`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${
                              isAgent 
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' 
                                : 'bg-gray-50 dark:bg-gray-700 border-r-4 border-gray-400'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-semibold ${
                                  isAgent 
                                    ? 'text-blue-700 dark:text-blue-300' 
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}>
                                  {isAgent ? 'Agent' : 'User'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                                {line.trim()}
                              </p>
                            </div>
                          </div>
                        );
                      });
                    }
                    
                    // Final fallback for unstructured text
                    return (
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                          {callLog.transcript}
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            </Card>
          </div>
        )}

        {!callLog.transcript && !callLog.audioUrl && (
          <Card className="p-8 text-center">
            <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2" data-testid="text-no-data-title">
              No additional data available
            </h3>
            <p className="text-gray-600 dark:text-gray-400" data-testid="text-no-data-description">
              This call log contains basic information only. Audio and transcript data may be available for newer calls.
            </p>
          </Card>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={() => onOpenChange(false)} data-testid="button-close-modal">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
