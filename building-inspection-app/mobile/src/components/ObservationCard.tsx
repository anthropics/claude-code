import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Observation, UrgencyLevel, Photo, BuildingContext } from '../types';
import { processObservationFull } from '../services/api';
import { PhotoCaptureButton } from './PhotoCapture';
import { colors } from '../theme/colors';

const urgencyOptions: { value: UrgencyLevel; label: string }[] = [
  { value: 'välitön', label: 'Välitön' },
  { value: '1-2v', label: '1–2 vuotta' },
  { value: '3-5v', label: '3–5 vuotta' },
  { value: 'seurattava', label: 'Seurattava' },
  { value: 'ei_toimenpiteitä', label: 'Ei toimenpiteitä' },
];

interface ObservationCardProps {
  observation: Observation;
  categoryName: string;
  buildingContext?: BuildingContext;
  onUpdate: (changes: Partial<Observation>) => void;
  onDelete: () => void;
  onPhotoAdded: (photo: Photo) => void;
  onPhotoDeleted: (photoId: string) => void;
}

export const ObservationCard: React.FC<ObservationCardProps> = ({
  observation,
  categoryName,
  buildingContext,
  onUpdate,
  onDelete,
  onPhotoAdded,
  onPhotoDeleted,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showUrgencyPicker, setShowUrgencyPicker] = useState(false);

  const urgencyColors = colors.urgency[observation.urgency] || colors.urgency['seurattava'];

  const handleReprocess = async () => {
    setProcessing(true);
    try {
      const result = await processObservationFull(observation.rawText, categoryName, buildingContext);
      onUpdate({
        processedText: result.processedText,
        withTheory: result.withTheory,
        urgency: result.urgency as UrgencyLevel,
      });
    } catch {
      // silently fail
    }
    setProcessing(false);
  };

  return (
    <View style={[styles.container, observation.aiProcessing && styles.containerProcessing]}>
      {/* Header */}
      <View style={styles.header}>
        {/* Urgency badge */}
        <TouchableOpacity
          style={[styles.urgencyBadge, { backgroundColor: urgencyColors.bg, borderColor: urgencyColors.border }]}
          onPress={() => setShowUrgencyPicker(!showUrgencyPicker)}
        >
          <Text style={[styles.urgencyText, { color: urgencyColors.text }]}>
            {urgencyOptions.find(u => u.value === observation.urgency)?.label || observation.urgency}
          </Text>
        </TouchableOpacity>

        {/* Raw text */}
        <Text style={styles.rawText} numberOfLines={expanded ? undefined : 2}>
          {observation.rawText || 'Tyhjä havainto'}
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.actionBtn}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Urgency picker */}
      {showUrgencyPicker && (
        <View style={styles.urgencyPicker}>
          {urgencyOptions.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.urgencyOption,
                observation.urgency === opt.value && styles.urgencyOptionActive,
              ]}
              onPress={() => {
                onUpdate({ urgency: opt.value });
                setShowUrgencyPicker(false);
              }}
            >
              <Text style={[
                styles.urgencyOptionText,
                observation.urgency === opt.value && styles.urgencyOptionTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* AI processing indicator */}
      {observation.aiProcessing && (
        <View style={styles.processingBar}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.processingText}>AI käsittelee...</Text>
        </View>
      )}

      {/* Action buttons */}
      {!processing && !observation.aiProcessing && (
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.aiButton} onPress={handleReprocess}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <Text style={styles.aiButtonText}>
              {observation.withTheory ? 'Päivitä' : 'Muotoile AI'}
            </Text>
          </TouchableOpacity>
          <PhotoCaptureButton
            categoryName={categoryName}
            onPhotoAdded={onPhotoAdded}
          />
        </View>
      )}

      {processing && (
        <View style={styles.processingBar}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.processingText}>Muotoillaan...</Text>
        </View>
      )}

      {/* Expanded content */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Processed text */}
          {observation.processedText ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Muotoiltu teksti</Text>
              <Text style={styles.sectionContent}>{observation.processedText}</Text>
            </View>
          ) : null}

          {/* Theory */}
          {observation.withTheory ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Viitteineen</Text>
              <Text style={styles.sectionContent}>{observation.withTheory}</Text>
            </View>
          ) : null}

          {/* Moisture reading */}
          {observation.moistureReading ? (
            <View style={styles.moistureBadge}>
              <Ionicons name="water" size={12} color={colors.primary} />
              <Text style={styles.moistureText}>{observation.moistureReading}</Text>
            </View>
          ) : null}

          {/* Photos */}
          {observation.photos.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={styles.sectionLabel}>Valokuvat</Text>
              <View style={styles.photosGrid}>
                {observation.photos.map(photo => (
                  <View key={photo.id} style={styles.photoItem}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    {photo.caption ? (
                      <Text style={styles.photoCaption} numberOfLines={2}>{photo.caption}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={styles.photoDeleteBtn}
                      onPress={() => onPhotoDeleted(photo.id)}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 12,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  containerProcessing: {
    borderColor: '#93c5fd',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 8,
  },
  urgencyBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  urgencyText: { fontSize: 11, fontWeight: '500' },
  rawText: { flex: 1, fontSize: 14, color: colors.gray700, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 2 },
  actionBtn: { padding: 4 },
  urgencyPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  urgencyOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.gray100,
  },
  urgencyOptionActive: { backgroundColor: colors.primaryLight },
  urgencyOptionText: { fontSize: 12, color: colors.gray600 },
  urgencyOptionTextActive: { color: colors.primary, fontWeight: '600' },
  processingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  processingText: { fontSize: 12, color: colors.primary },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
  },
  aiButtonText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    padding: 12,
    gap: 12,
  },
  section: {},
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionContent: { fontSize: 13, color: colors.gray700, lineHeight: 20 },
  moistureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  moistureText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  photosSection: {},
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { position: 'relative', width: 100 },
  photoImage: { width: 100, height: 100, borderRadius: 8 },
  photoCaption: { fontSize: 10, color: colors.gray500, marginTop: 4 },
  photoDeleteBtn: { position: 'absolute', top: -4, right: -4 },
});
