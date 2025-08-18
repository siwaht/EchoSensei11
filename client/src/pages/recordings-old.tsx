import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Download, Headphones, Mic, Calendar, Clock, Search } from "lucide-react";
import type { CallLog } from "@shared/schema";

export function Recordings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const { data: callLogs, isLoading } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
  });

  const { data: agents } = useQuery<any[]>({
    queryKey: ["/api/agents"],
  });

  // Filter only calls with recordings
  const recordingsOnly = callLogs?.filter(log => log.audioUrl) || [];
  
  // Apply search filter
  const filteredRecordings = recordingsOnly.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    const agentName = agents?.find(a => a.id === log.agentId)?.name || "";
    return (
      log.id.toLowerCase().includes(searchLower) ||
      agentName.toLowerCase().includes(searchLower) ||
      log.transcript?.toLowerCase().includes(searchLower)
    );
  });

  const handlePlayPause = (recording: CallLog) => {
    if (playingId === recording.id) {
      // Pause current
      audio?.pause();
      setPlayingId(null);
    } else {
      // Stop any current audio
      audio?.pause();
      
      // Play new
      const newAudio = new Audio(recording.audioUrl!);
      newAudio.play();
      newAudio.onended = () => setPlayingId(null);
      setAudio(newAudio);
      setPlayingId(recording.id);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getAgentName = (agentId: string) => {
    return agents?.find(a => a.id === agentId)?.name || "Unknown Agent";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Headphones className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            Call Recordings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Listen to and download all your voice agent call recordings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search recordings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-recordings"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 dark:text-purple-400">Total Recordings</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {recordingsOnly.length}
              </p>
            </div>
            <Mic className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400">Total Duration</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {Math.round(recordingsOnly.reduce((sum, r) => sum + (r.duration || 0), 0) / 60)} min
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-400">Latest Recording</p>
              <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                {recordingsOnly[0]?.createdAt 
                  ? new Date(recordingsOnly[0].createdAt).toLocaleDateString()
                  : "No recordings"}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Recordings Grid */}
      {filteredRecordings.length === 0 ? (
        <Card className="p-12 text-center">
          <Headphones className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {searchTerm ? "No recordings found" : "No recordings available"}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm 
              ? "Try adjusting your search terms"
              : "Call recordings will appear here once your agents receive calls"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecordings.map((recording) => (
            <Card 
              key={recording.id} 
              className="p-5 hover:shadow-lg transition-all duration-200 border-gray-200 dark:border-gray-700"
            >
              {/* Recording Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Call #{recording.id.slice(-6)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {getAgentName(recording.agentId)}
                  </p>
                </div>
                <Badge 
                  className={
                    recording.status === "completed" 
                      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      : "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                  }
                >
                  {recording.status}
                </Badge>
              </div>

              {/* Recording Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  {recording.createdAt 
                    ? new Date(recording.createdAt).toLocaleDateString()
                    : "Unknown date"}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  Duration: {formatDuration(recording.duration)}
                </div>
                {recording.cost && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-xs">💰</span>
                    Cost: ${Number(recording.cost).toFixed(4)}
                  </div>
                )}
              </div>

              {/* Audio Waveform Visualization */}
              <div className="h-12 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                <div className="flex items-end gap-0.5 h-8">
                  {Array.from({ length: 30 }, (_, i) => (
                    <div
                      key={i}
                      className={`bg-purple-500 dark:bg-purple-400 transition-all duration-300 ${
                        playingId === recording.id ? 'animate-pulse' : 'opacity-60'
                      }`}
                      style={{
                        width: '2px',
                        height: `${Math.random() * 24 + 8}px`,
                        borderRadius: '1px'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                  onClick={() => handlePlayPause(recording)}
                  data-testid={`button-play-recording-${recording.id}`}
                >
                  {playingId === recording.id ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Play
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid={`button-download-recording-${recording.id}`}
                >
                  <a
                    href={recording.audioUrl || ''}
                    download={`call-${recording.id.slice(-6)}-${getAgentName(recording.agentId).replace(/\s+/g, '-')}.mp3`}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}