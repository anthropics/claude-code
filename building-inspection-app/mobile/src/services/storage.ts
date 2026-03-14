import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { InspectionReport, InspectionCategory, INSPECTION_CATEGORIES } from '../types';

const STORAGE_KEY = 'inspection_reports';

async function loadReports(): Promise<InspectionReport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveReports(reports: InspectionReport[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export async function getAllReports(): Promise<InspectionReport[]> {
  const reports = await loadReports();
  return reports.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getReport(id: string): Promise<InspectionReport | null> {
  const reports = await loadReports();
  return reports.find(r => r.id === id) || null;
}

export async function createReport(): Promise<InspectionReport> {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const defaultCategories: InspectionCategory[] = INSPECTION_CATEGORIES.map(cat => ({
    ...cat,
    observations: [],
    notes: '',
  }));

  const report: InspectionReport = {
    id: uuidv4(),
    status: 'draft',
    propertyInfo: {
      address: '', postalCode: '', city: '', propertyId: '',
      buildYear: '', buildingType: 'Omakotitalo', floorArea: '', floors: '', energyClass: '',
      owner: '', ownerPhone: '', realEstateAgent: '',
      inspector: '', inspectorTitle: 'Rakennusterveysasiantuntija', inspectorQualification: '',
      inspectionDate: today, weatherConditions: '',
      outdoorTemp: '', outdoorHumidity: '', indoorTemp: '', indoorHumidity: '',
      devicesUsed: '',
      heatingSystem: '', heatingDistribution: '', foundationType: '',
      wallType: '', roofType: '', ventilationType: '',
      drainagePipeType: '', waterPipeType: '',
      accessLimitations: '', availableDocuments: '', ownerDefects: '',
      repairHistory: [],
      clientName: '', clientPhone: '', clientEmail: '', additionalInfo: '',
    },
    categories: defaultCategories,
    summary: null,
    createdAt: now,
    updatedAt: now,
  };

  const reports = await loadReports();
  reports.push(report);
  await saveReports(reports);
  return report;
}

export async function updateReport(report: InspectionReport): Promise<void> {
  const reports = await loadReports();
  const idx = reports.findIndex(r => r.id === report.id);
  if (idx !== -1) {
    reports[idx] = { ...report, updatedAt: new Date().toISOString() };
    await saveReports(reports);
  }
}

export async function deleteReport(id: string): Promise<void> {
  const reports = (await loadReports()).filter(r => r.id !== id);
  await saveReports(reports);
}

export async function duplicateReport(id: string): Promise<InspectionReport | null> {
  const original = await getReport(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const copy: InspectionReport = {
    ...original,
    id: uuidv4(),
    status: 'draft',
    summary: null,
    createdAt: now,
    updatedAt: now,
    propertyInfo: {
      ...original.propertyInfo,
      inspectionDate: now.split('T')[0],
    },
  };

  const reports = await loadReports();
  reports.push(copy);
  await saveReports(reports);
  return copy;
}
