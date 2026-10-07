'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BARCODE_DETECTOR_FORMATS } from '@/lib/forms/field-rules';

interface BarcodeScannerProps {
  onDetect: (value: string) => void;
  onClose: (message?: string) => void;
}

export function BarcodeScanner({ onDetect, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onDetectRef.current = onDetect;
    onCloseRef.current = onClose;
  }, [onDetect, onClose]);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let stream: MediaStream | null = null;

    const Detector = (
      window as Window & {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!Detector) {
      onCloseRef.current('Escaneo en vivo no disponible en este navegador.');
      return;
    }

    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: [...BARCODE_DETECTOR_FORMATS] });
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              onDetectRef.current(value);
              return;
            }
          } catch {
            // Keep scanning until the user closes the camera.
          }
          timer = window.setTimeout(() => void tick(), 280);
        };
        void tick();
      } catch {
        onCloseRef.current('No se pudo abrir la cámara.');
      }
    };

    void run();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={videoRef} className="min-h-0 flex-1 object-cover" playsInline muted />
      <div className="bg-background p-4">
        <Button type="button" variant="outline" className="w-full" onClick={() => onClose()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
