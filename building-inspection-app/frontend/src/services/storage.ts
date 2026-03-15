import { InspectionReport, InspectionCategory, INSPECTION_CATEGORIES } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'inspection_reports';

function loadReports(): InspectionReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReports(reports: InspectionReport[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function getAllReports(): InspectionReport[] {
  return loadReports().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getReport(id: string): InspectionReport | null {
  return loadReports().find(r => r.id === id) || null;
}

export function createReport(): InspectionReport {
  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  const defaultCategories: InspectionCategory[] = INSPECTION_CATEGORIES.map(cat => ({
    ...cat,
    observations: [],
    notes: '',
  }));

  const report: InspectionReport = {
    id: uuidv4(),
    status: 'draft',
    propertyInfo: {
      // Kohdetiedot
      address: '',
      postalCode: '',
      city: '',
      propertyId: '',
      buildYear: '',
      buildingType: 'Omakotitalo',
      floorArea: '',
      floors: '',
      energyClass: '',
      // Osapuolet
      owner: '',
      ownerPhone: '',
      realEstateAgent: '',
      inspector: '',
      inspectorTitle: 'Rakennusterveysasiantuntija',
      inspectorQualification: '',
      // Tarkastusolosuhteet
      inspectionDate: today,
      weatherConditions: '',
      outdoorTemp: '',
      outdoorHumidity: '',
      indoorTemp: '',
      indoorHumidity: '',
      // Laitteet
      devicesUsed: '',
      // Rakennetyypit
      heatingSystem: '',
      heatingDistribution: '',
      foundationType: '',
      wallType: '',
      roofType: '',
      ventilationType: '',
      drainagePipeType: '',
      waterPipeType: '',
      // Rajaukset
      accessLimitations: '',
      // Historia
      availableDocuments: '',
      ownerDefects: '',
      repairHistory: [],
      // Tilaaja
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      additionalInfo: '',
    },
    categories: defaultCategories,
    summary: null,
    createdAt: now,
    updatedAt: now,
  };

  const reports = loadReports();
  reports.push(report);
  saveReports(reports);
  return report;
}

export function updateReport(report: InspectionReport): void {
  const reports = loadReports();
  const idx = reports.findIndex(r => r.id === report.id);
  if (idx !== -1) {
    reports[idx] = { ...report, updatedAt: new Date().toISOString() };
    saveReports(reports);
  }
}

export function deleteReport(id: string): void {
  const reports = loadReports().filter(r => r.id !== id);
  saveReports(reports);
}

export function duplicateReport(id: string): InspectionReport | null {
  const original = getReport(id);
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
      inspectionDate: new Date().toISOString().split('T')[0],
    },
  };

  const reports = loadReports();
  reports.push(copy);
  saveReports(reports);
  return copy;
}
