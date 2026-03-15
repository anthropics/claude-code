import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InspectionReport, ReportStatus } from '../types';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getAllReports, createReport, createReportFromImport, deleteReport, duplicateReport } from '../services/storage';
import { importPDFReport } from '../services/api';
import { logout } from '../services/authService';
import { colors } from '../theme/colors';

const statusConfig: Record<ReportStatus, { label: string; color: string; icon: string }> = {
  draft: { label: 'Luonnos', color: colors.gray500, icon: 'document-text' },
  in_progress: { label: 'Kesken', color: colors.warning, icon: 'time' },
  review: { label: 'Tarkistuksessa', color: colors.primary, icon: 'alert-circle' },
  completed: { label: 'Valmis', color: colors.success, icon: 'checkmark-circle' },
};

interface DashboardScreenProps {
  onOpenReport: (id: string) => void;
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onOpenReport, onLogout }) => {
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadData = useCallback(async () => {
    const data = await getAllReports();
    setReports(data);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    const report = await createReport();
    setCreating(false);
    onOpenReport(report.id);
  };

  const handleImportPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setImporting(true);
      const file = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const data = await importPDFReport(base64, file.name || 'report.pdf');
      const report = await createReportFromImport(data);
      await loadData();
      onOpenReport(report.id);
    } catch (err) {
      console.error('PDF import failed:', err);
      Alert.alert('Virhe', 'PDF-tuonti epäonnistui. Tarkista tiedosto ja yritä uudelleen.');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Poista raportti',
      'Haluatko varmasti poistaa tämän raportin?',
      [
        { text: 'Peruuta', style: 'cancel' },
        {
          text: 'Poista',
          style: 'destructive',
          onPress: async () => {
            await deleteReport(id);
            await loadData();
          },
        },
      ]
    );
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicateReport(id);
    if (copy) {
      await loadData();
      onOpenReport(copy.id);
    }
  };

  const handleLogout = () => {
    Alert.alert('Kirjaudu ulos', 'Haluatko kirjautua ulos?', [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Kirjaudu ulos',
        style: 'destructive',
        onPress: async () => {
          await logout();
          onLogout();
        },
      },
    ]);
  };

  const stats = {
    total: reports.length,
    completed: reports.filter(r => r.status === 'completed').length,
    inProgress: reports.filter(r => r.status === 'in_progress').length,
  };

  const getObsCount = (report: InspectionReport) =>
    report.categories.reduce((sum, cat) => sum + cat.observations.length, 0);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' });

  const renderReport = ({ item: report }: { item: InspectionReport }) => {
    const status = statusConfig[report.status];
    const obsCount = getObsCount(report);
    const address = report.propertyInfo.address
      ? `${report.propertyInfo.address}${report.propertyInfo.city ? `, ${report.propertyInfo.city}` : ''}`
      : 'Osoite puuttuu';

    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => onOpenReport(report.id)}
        activeOpacity={0.7}
      >
        <View style={styles.reportIcon}>
          <Ionicons name="business" size={22} color={colors.primary} />
        </View>
        <View style={styles.reportContent}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportAddress} numberOfLines={1}>{address}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
              <Ionicons name={status.icon as any} size={11} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
          <Text style={styles.reportMeta}>
            {report.propertyInfo.buildingType || 'Rakennus'} · {obsCount} havaintoa · {formatDate(report.updatedAt)}
          </Text>
        </View>
        <View style={styles.reportActions}>
          <TouchableOpacity onPress={() => handleDuplicate(report.id)} style={styles.actionBtn}>
            <Ionicons name="copy-outline" size={16} color={colors.gray400} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(report.id)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.gray400} />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={18} color={colors.gray300} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Kuntotarkastukset</Text>
          <Text style={styles.subtitle}>Kuntotarkastusraportit</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.gray500} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Yhteensä', value: stats.total, color: colors.gray700 },
          { label: 'Valmiita', value: stats.completed, color: colors.success },
          { label: 'Kesken', value: stats.inProgress, color: colors.warning },
        ].map(stat => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.importButton} onPress={handleImportPDF} disabled={importing}>
          {importing ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
              <Text style={styles.importButtonText}>{importing ? 'AI analysoi...' : 'Tuo PDF:stä'}</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.createButton} onPress={handleCreate} disabled={creating}>
          {creating ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="add" size={20} color={colors.white} />
              <Text style={styles.createButtonText}>Uusi tarkastus</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Report list */}
      {reports.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyTitle}>Ei vielä yhtään tarkastusta</Text>
          <Text style={styles.emptySubtitle}>Aloita luomalla uusi tarkastusraportti.</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.gray900 },
  subtitle: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  logoutBtn: { padding: 8 },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  importButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  importButtonText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  createButtonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reportContent: { flex: 1 },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  reportAddress: { fontSize: 14, fontWeight: '600', color: colors.gray900, flex: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: '500' },
  reportMeta: { fontSize: 12, color: colors.gray400, marginTop: 4 },
  reportActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  actionBtn: { padding: 6 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.gray700, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: colors.gray400, marginTop: 4, textAlign: 'center' },
});
