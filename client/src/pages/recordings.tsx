import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Headphones, Search, Mic, Clock, Calendar, FileAudio } from "lucide-react";
import { format } from "date-fns";
import { AudioPlayer } from "@/components/audio-player";
import { TranscriptViewer } from "@/components/transcript-viewer";
import type { CallLog } from "@shared/schema";

export function Recordings() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: recordings = [], isLoading } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
  });

  const filteredRecordings = recordings.filter(recording => 
    recording.transcript?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recording.elevenLabsCallId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDuration = recordings.reduce((acc, rec) => acc + rec.duration, 0);
  const totalRecordings = recordings.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-600/10 backdrop-blur-sm">
            <Headphones className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Call Recordings</h1>
            <p className="text-gray-400">Listen to and manage your voice agent recordings</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Recordings</p>
                <p className="text-2xl font-bold text-white">{totalRecordings}</p>
              </div>
              <FileAudio className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Duration</p>
                <p className="text-2xl font-bold text-white">{Math.round(totalDuration / 60)} min</p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">With Audio</p>
                <p className="text-2xl font-bold text-white">
                  {recordings.filter(r => r.audioUrl).length}
                </p>
              </div>
              <Mic className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Latest Recording</p>
                <p className="text-sm font-medium text-white">
                  {recordings[0] ? format(new Date(recordings[0].createdAt), "MMM d, h:mm a") : "None"}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search recordings by transcript or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              data-testid="input-search-recordings"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recordings List */}
      <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Recordings</CardTitle>
          <CardDescription>Click on the waveform to seek, use controls to adjust playback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredRecordings.length === 0 ? (
              <div className="text-center py-12">
                <Headphones className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No recordings found</p>
              </div>
            ) : (
              filteredRecordings.map((recording) => (
                <div key={recording.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">
                      {format(new Date(recording.createdAt), "MMM d, yyyy h:mm a")}
                    </span>
                    <span className="text-xs text-purple-400 font-mono">
                      {recording.elevenLabsCallId}
                    </span>
                  </div>
                  
                  {recording.audioUrl ? (
                    <AudioPlayer
                      audioUrl={recording.audioUrl}
                      title={recording.transcript?.substring(0, 100) || "Call Recording"}
                      callId={recording.elevenLabsCallId || recording.id}
                      duration={recording.duration}
                    />
                  ) : (
                    <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                      <p className="text-sm text-gray-500 text-center">No audio available for this recording</p>
                    </div>
                  )}

                  {recording.transcript && (
                    <TranscriptViewer transcript={recording.transcript} />
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}