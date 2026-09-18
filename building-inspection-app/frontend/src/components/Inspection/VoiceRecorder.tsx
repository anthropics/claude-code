import React from 'react';
import { Mic, MicOff, Square, AlertCircle } from 'lucide-react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { Button } from '../UI/Button';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscript }) => {
  const {
    state,
    transcript,
    interimTranscript,
    isSupported,
    startRecording,
    stopRecording,
    clearTranscript,
    error,
  } = useVoiceRecorder();

  const handleUseTranscript = () => {
    const text = transcript.trim();
    if (text) {
      onTranscript(text);
      clearTranscript();
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
        <AlertCircle size={16} />
        <span>Puheentunnistus ei ole tuettu tässä selaimessa. Käytä Chrome-selainta.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        {state === 'idle' ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Mic size={16} />}
            onClick={startRecording}
          >
            Aloita sanelu
          </Button>
        ) : (
          <Button
            variant="danger"
            size="sm"
            icon={<Square size={16} />}
            onClick={stopRecording}
            className="recording-pulse"
          >
            Lopeta sanelu
          </Button>
        )}

        {state === 'recording' && (
          <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Tallentaa...
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2.5 rounded-lg">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Live transcript */}
      {(transcript || interimTranscript) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[60px]">
          <p className="text-sm text-gray-700 leading-relaxed">
            <span>{transcript}</span>
            {interimTranscript && (
              <span className="text-gray-400 italic"> {interimTranscript}</span>
            )}
          </p>
        </div>
      )}

      {/* Use transcript button */}
      {transcript && state === 'idle' && (
        <div className="flex gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={handleUseTranscript}
          >
            Käytä tekstiä
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearTranscript}
          >
            Tyhjennä
          </Button>
        </div>
      )}
    </div>
  );
};
