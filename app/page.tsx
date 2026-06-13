'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
}

interface Overlay {
  id: string;
  mediaId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
}

export default function FaceCamStudio() {
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [currentOverlay, setCurrentOverlay] = useState<Overlay | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [teleText, setTeleText] = useState('Bienvenue dans FaceCam Studio. Parlez naturellement !');
  const [teleSpeed, setTeleSpeed] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Webcam setup
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
    } catch (err) {
      alert('Erreur caméra/micro: ' + err);
    }
  };

  useEffect(() => {
    startWebcam();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Media upload
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const newMedia: MediaItem = {
        id: Date.now().toString() + Math.random(),
        type: file.type.startsWith('image') ? 'image' : 'video',
        url,
        name: file.name
      };
      setMediaLibrary(prev => [...prev, newMedia]);
    });
  };

  const addToOverlay = (media: MediaItem) => {
    const newOverlay: Overlay = {
      id: Date.now().toString(),
      mediaId: media.id,
      x: 50,
      y: 50,
      width: 300,
      height: 200,
      isVisible: true
    };
    setCurrentOverlay(newOverlay);
  };

  // Recording logic with canvas compositing
  const startRecording = async () => {
    if (!streamRef.current) return;

    recordedChunksRef.current = [];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stream = canvas.captureStream(30);
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      stream.addTrack(audioTrack);
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });

    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facecam-studio-${Date.now()}.webm`;
      a.click();
    };

    mediaRecorder.start();
    setIsRecording(true);
    setIsPaused(false);
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    // Start compositing
    compositeLoop();
  };

  const compositeLoop = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    canvas.width = 1280;
    canvas.height = 720;

    const draw = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw webcam
      if (video) {
        ctx.save();
        ctx.scale(-1, 1); // Mirror effect
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Draw overlay if present
      if (currentOverlay) {
        const mediaEl = document.querySelector(`[data-media-id="${currentOverlay.mediaId}"]`) as HTMLImageElement | HTMLVideoElement;
        if (mediaEl) {
          ctx.drawImage(
            mediaEl, 
            currentOverlay.x, 
            currentOverlay.y, 
            currentOverlay.width, 
            currentOverlay.height
          );
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.pause();
    }
    setIsPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.resume();
    }
    setIsPaused(false);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            📹
          </div>
          <h1 className="text-2xl font-bold">FaceCam Studio</h1>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowTeleprompter(!showTeleprompter)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center gap-2"
          >
            📜 Téléprompteur
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
          >
            + Importer Média
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Preview Area */}
        <div className="flex-1 flex flex-col p-4">
          <div className="relative flex-1 bg-black rounded-2xl overflow-hidden canvas-container" style={{aspectRatio: '16/9'}}>
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              className="absolute inset-0 w-full h-full object-cover opacity-0"
            />
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full"
            />

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-4 py-1 rounded-full text-sm">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                REC {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mt-6">
            {!isRecording ? (
              <button 
                onClick={startRecording}
                className="px-10 py-4 bg-red-600 hover:bg-red-700 text-xl font-semibold rounded-2xl flex items-center gap-3"
              >
                ▶️ COMMENCER L'ENREGISTREMENT
              </button>
            ) : (
              <div className="flex gap-4">
                {isPaused ? (
                  <button onClick={resumeRecording} className="px-8 py-4 bg-green-600 rounded-2xl">▶️ Reprendre</button>
                ) : (
                  <button onClick={pauseRecording} className="px-8 py-4 bg-yellow-600 rounded-2xl">⏸️ Pause</button>
                )}
                <button onClick={stopRecording} className="px-8 py-4 bg-zinc-700 hover:bg-red-600 rounded-2xl">⏹️ Arrêter & Exporter</button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-96 border-l border-zinc-800 bg-zinc-900 flex flex-col">
          {/* Media Library */}
          <div className="p-4 border-b border-zinc-800">
            <h3 className="font-semibold mb-3">Bibliothèque Média</h3>
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept="image/*,video/*" 
              className="hidden"
              onChange={handleMediaUpload}
            />
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-auto">
              {mediaLibrary.map(media => (
                <div 
                  key={media.id}
                  onClick={() => addToOverlay(media)}
                  className="aspect-video bg-zinc-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 relative"
                >
                  {media.type === 'image' ? (
                    <img src={media.url} alt={media.name} className="w-full h-full object-cover" data-media-id={media.id} />
                  ) : (
                    <video src={media.url} className="w-full h-full object-cover" data-media-id={media.id} />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs p-1 truncate">
                    {media.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Teleprompter Panel */}
          {showTeleprompter && (
            <div className="p-4 border-b border-zinc-800">
              <h3 className="font-semibold mb-2">Téléprompteur</h3>
              <textarea
                value={teleText}
                onChange={(e) => setTeleText(e.target.value)}
                className="w-full h-32 bg-zinc-800 p-3 rounded text-sm"
              />
              <div className="flex gap-4 mt-3">
                <button onClick={() => {/* scroll logic */}} className="flex-1 py-2 bg-zinc-700 rounded">▶️ Démarrer</button>
                <input 
                  type="range" 
                  min="0.5" 
                  max="3" 
                  step="0.1" 
                  value={teleSpeed}
                  onChange={(e) => setTeleSpeed(parseFloat(e.target.value))}
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-4 text-xs text-zinc-400">
            <p>Parlez devant la caméra. Cliquez sur un média pour l'afficher en overlay.</p>
            <p className="mt-2">La composition est enregistrée en direct.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
