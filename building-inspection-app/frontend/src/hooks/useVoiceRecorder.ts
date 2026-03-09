import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'recording' | 'processing';

interface UseVoiceRecorderReturn {
  state: RecordingState;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  clearTranscript: () => void;
  error: string | null;
}

// SpeechRecognition browser API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef('');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = Boolean(SpeechRecognition);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError('Selain ei tue puheentunnistusta. Käytä Chrome-selainta.');
      return;
    }

    setError(null);
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');

    const recognition = new SpeechRecognition!();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fi-FI';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('recording');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }

      setTranscript(finalTranscriptRef.current.trim());
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return; // Not an error
      if (event.error === 'aborted') return;

      const errorMessages: Record<string, string> = {
        'network': 'Verkkovirhe puheentunnistuksessa',
        'not-allowed': 'Mikrofoni estetty. Salli mikrofoni selaimen asetuksista.',
        'service-not-allowed': 'Puheentunnistuspalvelu ei saatavilla',
        'audio-capture': 'Mikrofonia ei löydy',
      };
      setError(errorMessages[event.error] || `Puheentunnistusvirhe: ${event.error}`);
      setState('idle');
    };

    recognition.onend = () => {
      setTranscript(finalTranscriptRef.current.trim());
      setInterimTranscript('');
      setState('idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, SpeechRecognition]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && state === 'recording') {
      recognitionRef.current.stop();
      setState('processing');
    }
  }, [state]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
  }, []);

  return {
    state,
    transcript,
    interimTranscript,
    isSupported,
    startRecording,
    stopRecording,
    clearTranscript,
    error,
  };
}
