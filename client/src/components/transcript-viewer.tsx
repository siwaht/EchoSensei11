import { useState } from 'react';
import { ChevronDown, ChevronUp, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TranscriptViewerProps {
  transcript: string;
}

interface TranscriptMessage {
  role: string;
  message: string;
  time_in_call_secs?: number;
}

export function TranscriptViewer({ transcript }: TranscriptViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Parse the transcript
  let messages: TranscriptMessage[] = [];
  let parseError = false;
  
  // Debug: Log what we're trying to parse
  console.log('Parsing transcript:', transcript.substring(0, 200));
  
  // Try to parse as newline-separated JSON objects (JSONL format)
  try {
    const lines = transcript.split('\n').filter(line => line.trim());
    console.log('Found', lines.length, 'lines to parse');
    
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.role && obj.message) {
          messages.push({
            role: obj.role,
            message: obj.message,
            time_in_call_secs: obj.time_in_call_secs
          });
        }
      } catch (lineError) {
        console.log('Failed to parse line:', line.substring(0, 100));
      }
    }
    
    console.log('Successfully parsed', messages.length, 'messages');
  } catch (e) {
    console.error('Failed to parse transcript:', e);
    parseError = true;
  }
  
  // If no messages were parsed, try single JSON object/array
  if (messages.length === 0 && !parseError) {
    try {
      const parsed = JSON.parse(transcript);
      if (Array.isArray(parsed)) {
        messages = parsed.filter(msg => msg.role && msg.message);
      } else if (parsed.role && parsed.message) {
        messages = [parsed];
      }
    } catch (e) {
      // Single JSON parse failed too
    }
  }
  
  // If we still have no messages, show raw transcript
  if (messages.length === 0) {
    return (
      <div className="rounded-lg bg-gray-800/30 border border-gray-700">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-700/30"
        >
          <span className="text-sm text-gray-300">
            View Raw Transcript (Unable to parse conversation)
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </Button>
        {isExpanded && (
          <div className="p-3 border-t border-gray-700">
            <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap break-words">
              {transcript.substring(0, 1000)}
              {transcript.length > 1000 && '...'}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (messages.length === 0) {
    return null;
  }

  // Format time display
  const formatTime = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-lg bg-gray-800/30 border border-gray-700">
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-700/30"
      >
        <span className="text-sm text-gray-300">
          View Transcript ({messages.length} messages)
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </Button>
      
      {isExpanded && (
        <div className="p-4 border-t border-gray-700 max-h-96 overflow-y-auto space-y-3">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                msg.role === 'agent' ? 'flex-row' : 'flex-row-reverse'
              }`}
            >
              <div
                className={`p-2 rounded-full ${
                  msg.role === 'agent'
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'bg-blue-600/20 text-blue-400'
                }`}
              >
                {msg.role === 'agent' ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              
              <div
                className={`flex-1 ${
                  msg.role === 'agent' ? 'mr-12' : 'ml-12'
                }`}
              >
                <div
                  className={`p-3 rounded-lg ${
                    msg.role === 'agent'
                      ? 'bg-gray-700/50 border border-gray-600'
                      : 'bg-blue-900/30 border border-blue-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400">
                      {msg.role === 'agent' ? 'Agent' : 'User'}
                    </span>
                    {msg.time_in_call_secs !== undefined && (
                      <span className="text-xs text-gray-500">
                        {formatTime(msg.time_in_call_secs)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                    {msg.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}