'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface CaptureRecorderProps {
  kind: 'audio' | 'video';
  maxDurationS?: number;
  onCapture: (file: File) => void;
}

export function CaptureRecorder({
  kind,
  maxDurationS,
  onCapture,
}: CaptureRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        const next = current + 1;
        if (maxDurationS && next >= maxDurationS) {
          recorderRef.current?.stop();
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [maxDurationS, recording]);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'video' ? { audio: true, video: { facingMode: 'environment' } } : { audio: true }
      );
      streamRef.current = stream;
      const mime = kind === 'video' ? 'video/webm' : 'audio/webm';
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime });
        const extension = kind === 'video' ? 'webm' : 'weba';
        onCapture(
          new File([blob], `${kind}-${Date.now()}.${extension}`, {
            type: blob.type || mime,
          })
        );
        stopTracks();
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setRecording(true);
    } catch {
      setError('No se pudo usar el micrófono o la cámara.');
    }
  };

  const stop = () => recorderRef.current?.stop();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <Button type="button" variant="destructive" size="mobile" onClick={stop}>
            Detener ({seconds}s)
          </Button>
        ) : (
          <Button type="button" variant="outline" size="mobile" onClick={start}>
            {kind === 'video' ? 'Grabar video' : 'Grabar audio'}
          </Button>
        )}
        {maxDurationS ? (
          <span className="text-xs text-muted-foreground">Máximo {maxDurationS}s</span>
        ) : null}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
