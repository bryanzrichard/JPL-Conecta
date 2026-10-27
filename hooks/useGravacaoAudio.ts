import { useState, useRef, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export interface UseGravacaoAudioReturn {
  isRecordingAudio: boolean;
  recordingSeconds: number;
  iniciar: () => Promise<void>;
  parar: () => void;
  cancelar: () => void;
}

export function useGravacaoAudio(
  onAudioPronto: (blob: Blob, mimeType: string) => Promise<void> | void
): UseGravacaoAudioReturn {
  const { toast } = useToast();
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | number | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        } catch (_) {}
      }
    };
  }, []);

  const iniciar = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
          variant: 'destructive',
          title: 'Gravação não suportada',
          description: 'Seu navegador não suporta captura direta de microfone.',
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 500) {
          try {
            await onAudioPronto(audioBlob, mimeType);
          } finally {
            setIsRecordingAudio(false);
          }
        } else {
          setIsRecordingAudio(false);
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.warn('Falha ao abrir microfone:', err);
      toast({
        variant: 'destructive',
        title: 'Microfone Bloqueado',
        description:
          'Clique no ícone de cadeado na barra de endereço (ao lado de https://...) e permita o microfone.',
      });
      setIsRecordingAudio(false);
    }
  };

  const parar = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  };

  const cancelar = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    audioChunksRef.current = [];
    setIsRecordingAudio(false);
    setRecordingSeconds(0);
  };

  return {
    isRecordingAudio,
    recordingSeconds,
    iniciar,
    parar,
    cancelar,
  };
}
