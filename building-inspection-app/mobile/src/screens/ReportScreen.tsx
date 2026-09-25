import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InspectionReport } from '../types';
import { getReport } from '../services/storage';
import { useReport } from '../hooks/useReport';
import { PropertyForm } from '../components/PropertyForm';
import { CategorySection } from '../components/CategorySection';
import { ReportSummaryView } from '../components/ReportSummaryView';
import { colors } from '../theme/colors';

type Tab = 'property' | 'inspection' | 'summary';

interface ReportScreenProps {
  reportId: string;
  onGoBack: () => void;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({ reportId, onGoBack }) => {
  const [initialReport, setInitialReport] = useState<InspectionReport | null>(null);

  useEffect(() => {
    (async () => {
      const r = await getReport(reportId);
      if (r) setInitialReport(r);
      else onGoBack();
    })();
  }, [reportId]);

  if (!initialReport) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Ladataan raporttia...</Text>
      </View>
    );
  }

  return <ReportContent initialReport={initialReport} onGoBack={onGoBack} />;
};

const ReportContent: React.FC<{
  initialReport: InspectionReport;
  onGoBack: () => void;
}> = ({ initialReport, onGoBack }) => {
  const {
    report,
    updatePropertyInfo,
    addObservation,
    updateObservation,
    deleteObservation,
    addPhoto,
    deletePhoto,
    updateCategoryNotes,
    updateSummary,
    getBuildingContext,
  } = useReport(initialReport);

  const [activeTab, setActiveTab] = useState<Tab>('property');

  const totalObs = report.categories.reduce((s, c) => s + c.observations.length, 0);
  const filledCategories = report.categories.filter(c => c.observations.length > 0).length;
  const buildingContext = getBuildingContext();

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'property', label: 'Kohde', icon: 'business' },
    { id: 'inspection', label: 'Havainnot', icon: 'list' },
    { id: 'summary', label: 'Yhteenveto', icon: 'sparkles' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.gray600} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {report.propertyInfo.address || 'Uusi kuntotarkastus'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {filledCategories} kategoriaa · {totalObs} havaintoa
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (filledCategories / report.categories.length) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{filledCategories}/{report.categories.length}</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {activeTab === 'property' && (
          <PropertyForm
            propertyInfo={report.propertyInfo}
            onChange={updatePropertyInfo}
          />
        )}

        {activeTab === 'inspection' && (
          <View>
            <Text style={styles.sectionTitle}>Tarkastushavainnot</Text>
            <Text style={styles.sectionSubtitle}>
              Kirjaa havainnot jokaisesta rakenneosasta
            </Text>
            {report.categories.map(cat => (
              <CategorySection
                key={cat.id}
                category={cat}
                buildingContext={buildingContext}
                onAddObservation={(text) => addObservation(cat.id, text)}
                onUpdateObservation={(obsId, changes) => updateObservation(cat.id, obsId, changes)}
                onDeleteObservation={(obsId) => deleteObservation(cat.id, obsId)}
                onAddPhoto={(obsId, photo) => addPhoto(cat.id, obsId, photo)}
                onDeletePhoto={(obsId, photoId) => deletePhoto(cat.id, obsId, photoId)}
                onUpdateNotes={(notes) => updateCategoryNotes(cat.id, notes)}
              />
            ))}
          </View>
        )}

        {activeTab === 'summary' && (
          <ReportSummaryView
            report={report}
            buildingContext={buildingContext}
            onSummaryGenerated={updateSummary}
          />
        )}
      </ScrollView>

      {/* Bottom tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.id)}
          >
            {activeTab === tab.id && <View style={styles.tabIndicator} />}
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.id ? colors.primary : colors.gray400}
            />
            <Text style={[
              styles.tabLabel,
              activeTab === tab.id && styles.tabLabelActive,
            ]}>
              {tab.label}
            </Text>
            {tab.id === 'inspection' && totalObs > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {totalObs > 9 ? '9+' : totalObs}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray50,
  },
  loadingText: { fontSize: 14, color: colors.gray400, marginTop: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backButton: { padding: 8, marginRight: 8 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '600', color: colors.gray900 },
  headerSubtitle: { fontSize: 12, color: colors.gray400, marginTop: 2 },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.gray100,
    borderRadius: 3,
    maxWidth: 200,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: { fontSize: 12, color: colors.gray400 },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  sectionSubtitle: { fontSize: 13, color: colors.gray500, marginTop: 4, marginBottom: 16 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingBottom: 24,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabLabel: { fontSize: 10, fontWeight: '500', color: colors.gray400, marginTop: 2 },
  tabLabelActive: { color: colors.primary },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: '25%',
    backgroundColor: colors.primary,
    borderRadius: 7,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { fontSize: 9, color: colors.white, fontWeight: '600' },
});
