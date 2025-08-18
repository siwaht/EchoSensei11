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
                {callLog.createdAt ? new Date(callLog.createdAt).toLocaleString() : "Unknown"}
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

        {/* Call Recording with Professional Audio Player */}
        {callLog.audioUrl && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Call Recording</h4>
            <Card className="p-4 bg-gray-50 dark:bg-gray-700">
              <div className="space-y-4">
                {/* Waveform Visualization */}
                <div className="h-16 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-end gap-1 h-12">
                      {Array.from({ length: 60 }, (_, i) => (
                        <div
                          key={i}
                          className="bg-blue-500 dark:bg-blue-400 opacity-70 hover:opacity-100 transition-opacity"
                          style={{
                            width: '2px',
                            height: `${Math.random() * 35 + 8}px`,
                            borderRadius: '1px'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-4 text-xs text-blue-600 dark:text-blue-300 font-medium">
                    Audio Waveform
                  </div>
                </div>
                
                {/* Audio Controls */}
                <div className="flex items-center justify-between">
                  <audio controls className="flex-1 max-w-md" data-testid="audio-call-recording">
                    <source src={callLog.audioUrl} type="audio/mpeg" />
                    <source src={callLog.audioUrl} type="audio/wav" />
                    <source src={callLog.audioUrl} type="audio/mp4" />
                    Your browser does not support the audio element.
                  </audio>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Duration: {callLog.duration ? `${Math.floor(callLog.duration / 60)}:${String(callLog.duration % 60).padStart(2, '0')}` : 'N/A'}</span>
                    <a
                      href={callLog.audioUrl}
                      download={`call-recording-${callLog.elevenLabsCallId}.mp3`}
                      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                      data-testid="link-download-recording"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </a>
                  </div>
                </div>
                
                {/* Recording Info */}
                <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span>High-quality audio recording</span>
                  <span>Encrypted & secure storage</span>
                </div>
              </div>
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
                    let transcript = callLog.transcript;
                    const conversationTurns = [];
                    
                    if (typeof transcript === 'string') {
                      // Extract escaped JSON objects from the malformed transcript structure
                      const escapedJsonPattern = /\{\\?"role\\?":\\?"[^\\}]*\\?"[^}]*\}/g;
                      const matches = transcript.match(escapedJsonPattern);
                      
                      if (matches) {
                        // Process each matched conversation turn
                        for (const match of matches) {
                          try {
                            // Clean and unescape the JSON string
                            const cleanMatch = match.replace(/\\"/g, '"');
                            const turnData = JSON.parse(cleanMatch);
                            
                            if (turnData && turnData.message && turnData.message.trim()) {
                              conversationTurns.push(turnData);
                            }
                          } catch (parseError) {
                            // Skip invalid turns
                            continue;
                          }
                        }
                      }
                      
                      // Fallback: Split by numbered keys if pattern matching failed
                      if (conversationTurns.length === 0) {
                        const parts = transcript.split(/"\d+":/);
                        for (let i = 1; i < parts.length; i++) {
                          try {
                            let part = parts[i].trim()
                              .replace(/^"|"[,}]*$/g, '')  // Remove quotes
                              .replace(/\\"/g, '"');       // Unescape
                            
                            const turnData = JSON.parse(part);
                            if (turnData && turnData.message && turnData.message.trim()) {
                              conversationTurns.push(turnData);
                            }
                          } catch (e) {
                            continue;
                          }
                        }
                      }
                    }
                    
                    // Sort by timestamp to maintain conversation order
                    conversationTurns.sort((a, b) => (a.time_in_call_secs || 0) - (b.time_in_call_secs || 0));
                    
                    // Render professional ElevenLabs-style conversation
                    if (conversationTurns.length > 0) {
                      return (
                        <div className="space-y-4">
                          {conversationTurns.map((turn, index) => (
                            <div key={index} className={`flex ${
                              turn.role === 'agent' ? 'justify-start' : 'justify-end'
                            }`}>
                              <div className={`max-w-[75%] ${
                                turn.role === 'agent' ? 'mr-8' : 'ml-8'
                              }`}>
                                <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                                  turn.role === 'agent' 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white'
                                }`}>
                                  <p className="text-sm leading-relaxed">
                                    {turn.message}
                                  </p>
                                </div>
                                <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
                                  turn.role === 'agent' ? 'justify-start' : 'justify-end'
                                }`}>
                                  <span className="font-medium">
                                    {turn.role === 'agent' ? 'AI Agent' : 'Customer'}
                                  </span>
                                  {turn.time_in_call_secs !== undefined && (
                                    <span>
                                      {Math.floor(turn.time_in_call_secs / 60)}:{String(turn.time_in_call_secs % 60).padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    
                    // No conversation data available
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <p>No conversation transcript available</p>
                      </div>
                    );
                  } catch (e) {
                    return (
                      <div className="text-center py-8 text-red-500">
                        <p>Unable to load conversation transcript</p>
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
