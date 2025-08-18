import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AudioPlayerProps {
  audioUrl: string;
  title: string;
  callId: string;
  duration: number;
}

export function AudioPlayer({ audioUrl, title, callId, duration }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Generate waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 60;

    // Generate random waveform data for visualization
    const bars = 100;
    const barWidth = canvas.width / bars;
    
    const drawWaveform = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < bars; i++) {
        const barHeight = Math.random() * 40 + 10;
        const x = i * barWidth;
        const y = (canvas.height - barHeight) / 2;
        
        // Color based on playback position
        const progress = audioRef.current ? (audioRef.current.currentTime / audioRef.current.duration) : 0;
        const barProgress = i / bars;
        
        if (barProgress < progress) {
          ctx.fillStyle = '#8b5cf6'; // Purple for played portion
        } else {
          ctx.fillStyle = '#4b5563'; // Gray for unplayed portion
        }
        
        ctx.fillRect(x, y, barWidth - 1, barHeight);
      }
    };

    drawWaveform();
    
    const interval = setInterval(() => {
      if (isPlaying) {
        drawWaveform();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', () => setIsLoading(true));
    audio.addEventListener('canplay', () => setIsLoading(false));

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', () => setIsLoading(true));
      audio.removeEventListener('canplay', () => setIsLoading(false));
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleRewind = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const handleForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = (value[0] / 100) * audio.duration;
    setCurrentTime(audio.currentTime);
  };

  const handleSpeedChange = (speed: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    setPlaybackRate(speed);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value[0];
    setVolume(value[0]);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `recording-${callId}.mp3`;
    link.click();
  };

  return (
    <div className="w-full bg-gray-900/50 backdrop-blur-sm rounded-lg p-4 border border-gray-800">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-medium text-gray-300 truncate flex-1">{title}</h3>
        <span className="text-xs text-gray-500">{callId}</span>
      </div>

      {/* Waveform Visualization */}
      <div className="relative w-full h-[60px] mb-4 bg-gray-900/50 rounded-lg overflow-hidden">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = (x / rect.width) * 100;
            handleSeek([percentage]);
          }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Play/Pause Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlayPause}
          disabled={isLoading}
          className="h-10 w-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        {/* Speed Control */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white">
              {playbackRate}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-900 border-gray-800">
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
              <DropdownMenuItem
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className="text-gray-300 hover:text-white hover:bg-gray-800"
              >
                {speed}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Rewind/Forward */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRewind}
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleForward}
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          <RotateCw className="h-4 w-4" />
        </Button>

        {/* Time Display */}
        <div className="flex-1 flex items-center gap-2 px-2">
          <span className="text-sm text-gray-400 min-w-[45px]">
            {formatTime(currentTime)}
          </span>
          <Slider
            value={[audioRef.current ? (currentTime / audioRef.current.duration) * 100 : 0]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className="flex-1"
          />
          <span className="text-sm text-gray-400 min-w-[45px]">
            {formatTime(duration)}
          </span>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-gray-400" />
          <Slider
            value={[volume]}
            onValueChange={handleVolumeChange}
            max={1}
            step={0.1}
            className="w-20"
          />
        </div>

        {/* Download Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          className="h-8 w-8 text-gray-400 hover:text-white"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}