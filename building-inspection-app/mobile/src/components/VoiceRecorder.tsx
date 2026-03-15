import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  TextInput,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { transcribeAudio } from '../services/api';
import { colors } from '../theme/colors';

type RecordingState = 'idle' | 'recording' | 'paused' | 'transcribing' | 'preview';

interface VoiceRecorderProps {
  /** Called when user chooses to add the text directly (raw) */
  onTranscriptionDirect: (text: string) => void;
  /** Called when user chooses AI formatting */
  onTranscriptionWithAI: (text: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptionDirect,
  onTranscriptionWithAI,
}) => {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Lupa vaaditaan', 'Salli mikrofonin käyttö asetuksista saneluominaisuutta varten.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setState('recording');
      setDuration(0);
      startTimer();
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Virhe', 'Äänityksen aloitus epäonnistui.');
    }
  };

  const pauseRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.pauseAsync();
      stopTimer();
      setState('paused');
    } catch (err) {
      console.error('Failed to pause recording:', err);
    }
  };

  const resumeRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.startAsync();
      startTimer();
      setState('recording');
    } catch (err) {
      console.error('Failed to resume recording:', err);
    }
  };

  const finishRecording = async () => {
    if (!recordingRef.current) return;

    stopTimer();
    setState('transcribing');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('No recording URI');
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const text = await transcribeAudio(uri);

      if (text && text.trim()) {
        setTranscribedText(text.trim());
        setState('preview');
      } else {
        Alert.alert('Sanelu', 'Puhetta ei tunnistettu. Yritä uudelleen.');
        resetState();
      }
    } catch (err) {
      console.error('Transcription failed:', err);
      Alert.alert('Virhe', 'Sanelun käsittely epäonnistui. Tarkista verkkoyhteys.');
      resetState();
    }
  };

  const cancelRecording = async () => {
    stopTimer();

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    resetState();
  };

  const resetState = () => {
    setState('idle');
    setDuration(0);
    setTranscribedText('');
  };

  const handleAddDirect = () => {
    if (transcribedText.trim()) {
      onTranscriptionDirect(transcribedText.trim());
    }
    resetState();
  };

  const handleAddWithAI = () => {
    if (transcribedText.trim()) {
      onTranscriptionWithAI(transcribedText.trim());
    }
    resetState();
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Idle ──
  if (state === 'idle') {
    return (
      <TouchableOpacity style={styles.micButton} onPress={startRecording}>
        <Ionicons name="mic" size={18} color={colors.primary} />
        <Text style={styles.micButtonText}>Sanelu</Text>
      </TouchableOpacity>
    );
  }

  // ── Transcribing ──
  if (state === 'transcribing') {
    return (
      <View style={styles.transcribingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.transcribingText}>Käsitellään sanelua...</Text>
      </View>
    );
  }

  // ── Preview (after transcription) ──
  if (state === 'preview') {
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewLabel}>Saneltu teksti</Text>
        <TextInput
          style={styles.previewText}
          value={transcribedText}
          onChangeText={setTranscribedText}
          multiline
          autoFocus={false}
        />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.discardButton} onPress={resetState}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.discardButtonText}>Poista</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.directButton} onPress={handleAddDirect}>
            <Ionicons name="add-circle-outline" size={16} color={colors.gray700} />
            <Text style={styles.directButtonText}>Sellaisenaan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.aiButton} onPress={handleAddWithAI}>
            <Ionicons name="sparkles" size={16} color={colors.white} />
            <Text style={styles.aiButtonText}>AI muotoilu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Recording / Paused ──
  const isPaused = state === 'paused';

  return (
    <View style={styles.recordingContainer}>
      <View style={styles.recordingIndicator}>
        <View style={[styles.redDot, isPaused && styles.redDotPaused]} />
        <Text style={[styles.durationText, isPaused && styles.durationTextPaused]}>
          {formatDuration(duration)}
        </Text>
        {isPaused && <Text style={styles.pausedLabel}>Tauko</Text>}
      </View>
      <View style={styles.recordingActions}>
        {/* Cancel / Delete */}
        <TouchableOpacity style={styles.cancelButton} onPress={cancelRecording}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </TouchableOpacity>

        {/* Pause / Resume */}
        {isPaused ? (
          <TouchableOpacity style={styles.resumeButton} onPress={resumeRecording}>
            <Ionicons name="mic" size={18} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.pauseButton} onPress={pauseRecording}>
            <Ionicons name="pause" size={18} color={colors.warning} />
          </TouchableOpacity>
        )}

        {/* Finish */}
        <TouchableOpacity style={styles.stopButton} onPress={finishRecording}>
          <Ionicons name="checkmark" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Idle ──
  micButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  micButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },

  // ── Recording / Paused ──
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  redDotPaused: {
    backgroundColor: '#f59e0b',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  durationTextPaused: {
    color: '#d97706',
  },
  pausedLabel: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '500',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Transcribing ──
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
  },
  transcribingText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },

  // ── Preview ──
  previewContainer: {
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    padding: 12,
    flex: 1,
    gap: 10,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewText: {
    fontSize: 14,
    color: colors.gray900,
    lineHeight: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  discardButtonText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '500',
  },
  directButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  directButtonText: {
    fontSize: 12,
    color: colors.gray700,
    fontWeight: '500',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flex: 1,
    justifyContent: 'center',
  },
  aiButtonText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },
});
