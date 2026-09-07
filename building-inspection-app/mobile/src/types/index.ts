export type UrgencyLevel = 'välitön' | '1-2v' | '3-5v' | 'seurattava' | 'ei_toimenpiteitä';

export interface Photo {
  id: string;
  uri: string;
  base64?: string;
  mediaType: string;
  caption: string;
  captionLoading?: boolean;
  timestamp: string;
}

export interface Observation {
  id: string;
  rawText: string;
  processedText: string;
  withTheory: string;
  photos: Photo[];
  urgency: UrgencyLevel;
  moistureReading: string;
  aiProcessing?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  observations: Observation[];
  notes: string;
}

export interface RepairHistoryItem {
  id: string;
  year: string;
  description: string;
}

export interface PropertyInfo {
  address: string;
  postalCode: string;
  city: string;
  propertyId: string;
  buildYear: string;
  buildingType: string;
  floorArea: string;
  floors: string;
  energyClass: string;
  owner: string;
  ownerPhone: string;
  realEstateAgent: string;
  inspector: string;
  inspectorTitle: string;
  inspectorQualification: string;
  inspectionDate: string;
  weatherConditions: string;
  outdoorTemp: string;
  outdoorHumidity: string;
  indoorTemp: string;
  indoorHumidity: string;
  devicesUsed: string;
  heatingSystem: string;
  heatingDistribution: string;
  foundationType: string;
  wallType: string;
  roofType: string;
  ventilationType: string;
  drainagePipeType: string;
  waterPipeType: string;
  accessLimitations: string;
  availableDocuments: string;
  ownerDefects: string;
  repairHistory: RepairHistoryItem[];
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  additionalInfo: string;
}

export interface RiskStructure {
  name: string;
  description: string;
  severity: 'high' | 'medium';
  recommendation: string;
}

export interface ReportSummary {
  findingsSummary: string;
  finalSummary: string;
  generatedAt: string;
}

export type ReportStatus = 'draft' | 'in_progress' | 'review' | 'completed';

export interface InspectionReport {
  id: string;
  status: ReportStatus;
  propertyInfo: PropertyInfo;
  categories: InspectionCategory[];
  summary: ReportSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  item: string;
  priority: 'high' | 'medium' | 'low';
  hint: string;
  checked: boolean;
}

export interface BuildingContext {
  buildYear?: string;
  buildingType?: string;
  foundationType?: string;
  wallType?: string;
  roofType?: string;
  heatingSystem?: string;
  ventilationType?: string;
  drainagePipeType?: string;
  waterPipeType?: string;
}

export const INSPECTION_CATEGORIES: Omit<InspectionCategory, 'observations' | 'notes'>[] = [
  { id: 'perustukset', name: 'Perustukset ja alapohja', icon: 'layers', description: 'Sokkelit, perustukset, routasuojaus, salaojitus' },
  { id: 'ulkoalueet', name: 'Ulkoalueet ja tontti', icon: 'tree', description: 'Tontin rajat, maanpinnan kallistukset, piha' },
  { id: 'ulkoseinat', name: 'Ulkoseinät ja julkisivu', icon: 'home', description: 'Ulkoverhous, tuuletusraot, maalaus' },
  { id: 'ikkunat', name: 'Ikkunat ja ulko-ovet', icon: 'maximize-2', description: 'Ikkunat, ulko-ovet, tiivisteet' },
  { id: 'vesikatto', name: 'Vesikatto ja yläpohja', icon: 'triangle', description: 'Kattorakenne, kate, yläpohjan eristys' },
  { id: 'markatilat', name: 'Märkätilat', icon: 'droplets', description: 'Kylpyhuone, WC, sauna, vesieristykset' },
  { id: 'keittio', name: 'Keittiö', icon: 'utensils', description: 'Kalusteet, kodinkoneet, liesituuletin' },
  { id: 'muut_sisatilat', name: 'Muut sisätilat', icon: 'door-open', description: 'Olohuone, makuuhuoneet, käytävät' },
  { id: 'lammitys', name: 'Lämmitysjärjestelmä', icon: 'thermometer', description: 'Lämmityslaitteisto, patterit, tulisijat' },
  { id: 'vesi_viemari', name: 'Vesi- ja viemärijärjestelmä', icon: 'pipette', description: 'Käyttövesiputket, viemärit' },
  { id: 'sahko', name: 'Sähköjärjestelmä', icon: 'zap', description: 'Sähkökeskus, johdotukset, maadoitus' },
  { id: 'ilmanvaihto', name: 'Ilmanvaihto', icon: 'wind', description: 'IV-koneisto, kanavat, venttiilit' },
  { id: 'turvallisuus', name: 'Paloturvallisuus ja haitta-aineet', icon: 'shield-alert', description: 'Palovaroittimet, asbesti, radon' },
];
