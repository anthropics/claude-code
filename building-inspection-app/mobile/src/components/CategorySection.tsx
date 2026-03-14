import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InspectionCategory, Observation, Photo, BuildingContext } from '../types';
import { ObservationCard } from './ObservationCard';
import { colors } from '../theme/colors';

// Map icon names to Ionicons equivalents
const iconMap: Record<string, string> = {
  layers: 'layers',
  tree: 'leaf',
  home: 'home',
  'maximize-2': 'resize',
  triangle: 'triangle',
  droplets: 'water',
  utensils: 'restaurant',
  'door-open': 'enter',
  thermometer: 'thermometer',
  pipette: 'water',
  zap: 'flash',
  wind: 'cloud',
  'shield-alert': 'shield',
};

interface CategorySectionProps {
  category: InspectionCategory;
  buildingContext?: BuildingContext;
  onAddObservation: (rawText: string) => void;
  onUpdateObservation: (obsId: string, changes: Partial<Observation>) => void;
  onDeleteObservation: (obsId: string) => void;
  onAddPhoto: (obsId: string, photo: Photo) => void;
  onDeletePhoto: (obsId: string, photoId: string) => void;
  onUpdateNotes: (notes: string) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  buildingContext,
  onAddObservation,
  onUpdateObservation,
  onDeleteObservation,
  onAddPhoto,
  onDeletePhoto,
  onUpdateNotes,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [quickText, setQuickText] = useState('');

  const obsCount = category.observations.length;
  const hasContent = obsCount > 0 || !!category.notes;
  const processingCount = category.observations.filter(o => o.aiProcessing).length;
  const ionIcon = iconMap[category.icon] || 'document-text';

  const handleAddText = () => {
    const text = quickText.trim();
    if (text) {
      onAddObservation(text);
      setQuickText('');
    }
  };

  return (
    <View style={[styles.container, hasContent && styles.containerActive]}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, hasContent && styles.iconBoxActive]}>
          <Ionicons
            name={ionIcon as any}
            size={18}
            color={hasContent ? colors.primary : colors.gray500}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.categoryName}>{category.name}</Text>
          <Text style={styles.categoryDesc} numberOfLines={1}>{category.description}</Text>
        </View>
        <View style={styles.headerRight}>
          {processingCount > 0 && (
            <View style={styles.processingBadge}>
              <Ionicons name="sparkles" size={11} color={colors.primary} />
              <Text style={styles.processingText}>{processingCount}</Text>
            </View>
          )}
          {obsCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{obsCount}</Text>
            </View>
          )}
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={colors.gray400}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded content */}
      {expanded && (
        <View style={styles.body}>
          {/* Text input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={quickText}
              onChangeText={setQuickText}
              placeholder="Havainto... (AI muotoilee)"
              placeholderTextColor={colors.gray400}
              returnKeyType="send"
              onSubmitEditing={handleAddText}
            />
            <TouchableOpacity
              style={[styles.addButton, !quickText.trim() && styles.addButtonDisabled]}
              onPress={handleAddText}
              disabled={!quickText.trim()}
            >
              <Ionicons name="add" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Observations */}
          {category.observations.map(obs => (
            <ObservationCard
              key={obs.id}
              observation={obs}
              categoryName={category.name}
              buildingContext={buildingContext}
              onUpdate={(changes) => onUpdateObservation(obs.id, changes)}
              onDelete={() => {
                Alert.alert('Poista havainto', 'Haluatko poistaa tämän havainnon?', [
                  { text: 'Peruuta', style: 'cancel' },
                  { text: 'Poista', style: 'destructive', onPress: () => onDeleteObservation(obs.id) },
                ]);
              }}
              onPhotoAdded={(photo) => onAddPhoto(obs.id, photo)}
              onPhotoDeleted={(photoId) => onDeletePhoto(obs.id, photoId)}
            />
          ))}

          {/* Notes */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Muistiinpanot</Text>
            <TextInput
              style={styles.notesInput}
              value={category.notes}
              onChangeText={onUpdateNotes}
              placeholder="Lisätiedot, mittaustulokset..."
              placeholderTextColor={colors.gray400}
              multiline
              numberOfLines={2}
            />
          </View>
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
    marginBottom: 8,
    overflow: 'hidden',
  },
  containerActive: {
    borderColor: '#bfdbfe',
    backgroundColor: '#f0f7ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: '#dbeafe',
  },
  headerText: { flex: 1 },
  categoryName: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  categoryDesc: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  processingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  processingText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countText: { fontSize: 11, color: colors.white, fontWeight: '600' },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    padding: 14,
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.white,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  notesContainer: { marginTop: 4 },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.gray900,
    backgroundColor: colors.white,
    minHeight: 50,
    textAlignVertical: 'top',
  },
});
