import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { transcribeAudio } from '../services/api';
import { colors } from '../theme/colors';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscription }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Virhe', 'Äänityksen aloitus epäonnistui.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setIsTranscribing(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('No recording URI');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const text = await transcribeAudio(uri);

      if (text && text.trim()) {
        onTranscription(text.trim());
      } else {
        Alert.alert('Sanelu', 'Puhetta ei tunnistettu. Yritä uudelleen.');
      }
    } catch (err) {
      console.error('Transcription failed:', err);
      Alert.alert('Virhe', 'Sanelun käsittely epäonnistui. Tarkista verkkoyhteys.');
    }

    setIsTranscribing(false);
    setDuration(0);
  };

  const cancelRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    setIsRecording(false);
    setDuration(0);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isTranscribing) {
    return (
      <View style={styles.transcribingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.transcribingText}>Käsitellään sanelua...</Text>
      </View>
    );
  }

  if (isRecording) {
    return (
      <View style={styles.recordingContainer}>
        <View style={styles.recordingIndicator}>
          <View style={styles.redDot} />
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>
        <View style={styles.recordingActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={cancelRecording}>
            <Ionicons name="close" size={18} color={colors.gray600} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
            <Ionicons name="checkmark" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.micButton} onPress={startRecording}>
      <Ionicons name="mic" size={18} color={colors.primary} />
      <Text style={styles.micButtonText}>Sanelu</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray200,
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
});
