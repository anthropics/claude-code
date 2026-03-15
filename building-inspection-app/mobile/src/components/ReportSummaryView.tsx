import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InspectionReport, BuildingContext } from '../types';
import {
  generateFindingsSummary, generateFinalSummary, checkCompleteness,
} from '../services/api';
import { updateReport } from '../services/storage';
import { exportPDF, printPDF } from '../utils/pdfGenerator';
import { colors } from '../theme/colors';

interface ReportSummaryViewProps {
  report: InspectionReport;
  buildingContext: BuildingContext;
  onSummaryGenerated: (findings: string, finalSummary: string) => void;
}

export const ReportSummaryView: React.FC<ReportSummaryViewProps> = ({
  report,
  buildingContext,
  onSummaryGenerated,
}) => {
  const [generating, setGenerating] = useState(false);
  const [checkingCompleteness, setCheckingCompleteness] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [completeness, setCompleteness] = useState<{
    completenessPercent: number;
    missingAreas: Array<{ area: string; importance: string; reason: string }>;
    overallAssessment: string;
  } | null>(null);

  const totalObs = report.categories.reduce((s, c) => s + c.observations.length, 0);

  const allObservations = report.categories.flatMap(cat =>
    cat.observations.map(obs => ({
      category: cat.name,
      text: obs.processedText || obs.rawText,
    }))
  );

  const handleGenerateSummary = async () => {
    if (totalObs === 0) return;
    setGenerating(true);
    try {
      const findings = await generateFindingsSummary(allObservations);
      const finalSummary = await generateFinalSummary({
        propertyInfo: report.propertyInfo as unknown as Record<string, unknown>,
        observations: allObservations,
        findingsSummary: findings,
      });
      onSummaryGenerated(findings, finalSummary);
    } catch (err) {
      console.error('Summary generation failed:', err);
    }
    setGenerating(false);
  };

  const handleCheckCompleteness = async () => {
    setCheckingCompleteness(true);
    try {
      const result = await checkCompleteness(
        report.categories.map(c => ({ name: c.name, observationCount: c.observations.length })),
        buildingContext
      );
      setCompleteness(result);
    } catch (err) {
      console.error('Completeness check failed:', err);
    }
    setCheckingCompleteness(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateReport({
        ...report,
        status: 'review',
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('Tallennettu', 'Raportti on tallennettu onnistuneesti.');
    } catch (err) {
      console.error('Save failed:', err);
      Alert.alert('Virhe', 'Tallentaminen epäonnistui.');
    }
    setSaving(false);
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportPDF(report);
    } catch (err) {
      console.error('PDF export failed:', err);
      Alert.alert('Virhe', 'PDF:n jakaminen epäonnistui.');
    }
    setExporting(false);
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printPDF(report);
    } catch (err) {
      console.error('Print failed:', err);
      Alert.alert('Virhe', 'Tulostaminen epäonnistui.');
    }
    setPrinting(false);
  };

  return (
    <View>
      <Text style={styles.title}>Yhteenveto</Text>
      <Text style={styles.subtitle}>
        AI-pohjainen yhteenveto kaikista havainnoista
      </Text>

      {/* Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.statNumber}>{totalObs}</Text>
        <Text style={styles.statLabel}>havaintoa yhteensä</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, totalObs === 0 && styles.actionButtonDisabled]}
          onPress={handleGenerateSummary}
          disabled={generating || totalObs === 0}
        >
          {generating ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.white} />
              <Text style={styles.actionButtonText}>Luo yhteenveto</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleCheckCompleteness}
          disabled={checkingCompleteness}
        >
          {checkingCompleteness ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Tarkasta kattavuus</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Completeness result */}
      {completeness && (
        <View style={styles.completenessCard}>
          <View style={styles.completenessHeader}>
            <Text style={styles.completenessPercent}>{completeness.completenessPercent}%</Text>
            <Text style={styles.completenessLabel}>kattavuus</Text>
          </View>
          <Text style={styles.completenessAssessment}>{completeness.overallAssessment}</Text>
          {completeness.missingAreas.length > 0 && (
            <View style={styles.missingAreas}>
              <Text style={styles.missingTitle}>Puuttuvat alueet:</Text>
              {completeness.missingAreas.map((area, i) => (
                <View key={i} style={styles.missingItem}>
                  <Ionicons
                    name={area.importance === 'critical' ? 'alert-circle' : 'information-circle'}
                    size={14}
                    color={area.importance === 'critical' ? colors.danger : colors.warning}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missingAreaName}>{area.area}</Text>
                    <Text style={styles.missingAreaReason}>{area.reason}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Summary content */}
      {report.summary && (
        <View style={styles.summaryContent}>
          {report.summary.findingsSummary ? (
            <View style={styles.summarySection}>
              <Text style={styles.summaryLabel}>Havaintotaulukko</Text>
              <Text style={styles.summaryText}>{report.summary.findingsSummary}</Text>
            </View>
          ) : null}

          {report.summary.finalSummary ? (
            <View style={styles.summarySection}>
              <Text style={styles.summaryLabel}>Loppuyhteenveto</Text>
              <Text style={styles.summaryText}>{report.summary.finalSummary}</Text>
            </View>
          ) : null}

          <Text style={styles.generatedAt}>
            Luotu: {new Date(report.summary.generatedAt).toLocaleDateString('fi-FI')}
          </Text>
        </View>
      )}

      {/* Save & Export PDF */}
      <View style={styles.exportSection}>
        <Text style={styles.exportTitle}>Tallenna ja vie</Text>
        <View style={styles.exportButtons}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.gray600} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.gray700} />
                <Text style={styles.saveButtonText}>Tallenna</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pdfButton}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="share-outline" size={18} color={colors.white} />
                <Text style={styles.pdfButtonText}>Jaa PDF</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.printButton}
            onPress={handlePrint}
            disabled={printing}
          >
            {printing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Ionicons name="print-outline" size={18} color={colors.primary} />
                <Text style={styles.printButtonText}>Tulosta</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  subtitle: { fontSize: 13, color: colors.gray500, marginTop: 4, marginBottom: 16 },
  statsCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: { fontSize: 32, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 13, color: colors.primary, marginTop: 2 },
  actions: { gap: 8, marginBottom: 16 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  completenessCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    marginBottom: 16,
  },
  completenessHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  completenessPercent: { fontSize: 28, fontWeight: '700', color: colors.primary },
  completenessLabel: { fontSize: 14, color: colors.gray500 },
  completenessAssessment: { fontSize: 13, color: colors.gray700, lineHeight: 20, marginBottom: 12 },
  missingAreas: {},
  missingTitle: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 8 },
  missingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  missingAreaName: { fontSize: 13, fontWeight: '500', color: colors.gray700 },
  missingAreaReason: { fontSize: 12, color: colors.gray500 },
  summaryContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  summarySection: { marginBottom: 16 },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryText: { fontSize: 13, color: colors.gray700, lineHeight: 20 },
  generatedAt: { fontSize: 11, color: colors.gray400, textAlign: 'right' },
  exportSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  exportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingVertical: 16,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray700,
  },
  pdfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
  pdfButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  printButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
  printButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
