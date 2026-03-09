// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for the Building Inspection AI application
// ─────────────────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'välitön' | '1-2v' | '3-5v' | 'seurattava' | 'ei_toimenpiteitä';

export interface Photo {
  id: string;
  dataUrl: string;           // Base64 data URL
  mediaType: string;         // image/jpeg etc.
  caption: string;           // AI-generated or manual
  captionLoading?: boolean;
  timestamp: string;
}

export interface Observation {
  id: string;
  rawText: string;           // Original dictated/typed text
  processedText: string;     // AI-formatted text
  withTheory: string;        // Text + technical references
  photos: Photo[];
  urgency: UrgencyLevel;
  moistureReading: string;   // Pintakosteudentunnistimen arvo (esim. "WS 68%")
  aiProcessing?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionCategory {
  id: string;
  name: string;              // Finnish category name
  icon: string;              // Lucide icon name
  description: string;
  observations: Observation[];
  notes: string;             // Free-form category notes
}

export interface RepairHistoryItem {
  id: string;
  year: string;
  description: string;
}

export interface PropertyInfo {
  // Kohteen tiedot
  address: string;
  postalCode: string;
  city: string;
  propertyId: string;        // Kiinteistötunnus
  buildYear: string;
  buildingType: string;
  floorArea: string;         // m²
  floors: string;
  energyClass: string;       // Energialuokka

  // Osapuolet
  owner: string;             // Omistaja
  ownerPhone: string;
  realEstateAgent: string;   // Kiinteistönvälittäjä
  inspector: string;
  inspectorTitle: string;
  inspectorQualification: string; // Pätevyys (esim. PKA, AKK)

  // Tarkastusolosuhteet
  inspectionDate: string;
  weatherConditions: string;
  outdoorTemp: string;
  outdoorHumidity: string;   // Ulkoilman kosteus %
  indoorTemp: string;
  indoorHumidity: string;    // Sisäilman kosteus %

  // Käytetyt laitteet
  devicesUsed: string;       // Esim. "Gann Hydromette RTU 600, kalibroitu 2024-01"

  // Rakennetyypit
  heatingSystem: string;
  heatingDistribution: string; // Lämmönjako (patterit, lattialämmitys)
  foundationType: string;
  wallType: string;
  roofType: string;
  ventilationType: string;
  drainagePipeType: string;  // Viemärimateriaali
  waterPipeType: string;     // Käyttövesiputket

  // Tarkastuksen rajaukset
  accessLimitations: string; // Tilat joihin ei ollut pääsyä

  // Dokumentit ja historia
  availableDocuments: string;  // Käytettävissä olevat asiakirjat
  ownerDefects: string;        // Omistajan ilmoittamat virheet/puutteet
  repairHistory: RepairHistoryItem[];

  // Tilaajan tiedot
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
  findingsSummary: string;   // AI-generated markdown table
  finalSummary: string;      // AI-generated final summary
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

// ─────────────────────────────────────────────────────────────────────────────
// Predefined inspection categories (Finnish building inspection standard)
// ─────────────────────────────────────────────────────────────────────────────

export const INSPECTION_CATEGORIES: Omit<InspectionCategory, 'observations' | 'notes'>[] = [
  {
    id: 'perustukset',
    name: 'Perustukset ja alapohja',
    icon: 'Layers',
    description: 'Sokkelit, perustukset, routasuojaus, salaojitus, sadevesijärjestelmä',
  },
  {
    id: 'ulkoalueet',
    name: 'Ulkoalueet ja tontti',
    icon: 'Trees',
    description: 'Tontin rajat, maanpinnan kallistukset, vierustat, piha',
  },
  {
    id: 'ulkoseinat',
    name: 'Ulkoseinät ja julkisivu',
    icon: 'Home',
    description: 'Ulkoverhous, tuuletusraot, ikkunapellit, räystäät, maalaus',
  },
  {
    id: 'ikkunat',
    name: 'Ikkunat ja ulko-ovet',
    icon: 'Maximize2',
    description: 'Ikkunat, ulko-ovet, tiivisteet, kunto, toimivuus',
  },
  {
    id: 'vesikatto',
    name: 'Vesikatto ja yläpohja',
    icon: 'Triangle',
    description: 'Kattorakenne, kate, aluskate, läpiviennit, yläpohjan eristys, tuuletus, kattoturvatuotteet',
  },
  {
    id: 'markatilat',
    name: 'Märkätilat',
    icon: 'Droplets',
    description: 'Kylpyhuone, WC, sauna, kodinhoitohuone – vesieristykset, kaivot, pinnat',
  },
  {
    id: 'keittiö',
    name: 'Keittiö',
    icon: 'UtensilsCrossed',
    description: 'Keittiö, kalusteet, kodinkoneet, liesituuletin, altaan tiiveys',
  },
  {
    id: 'muut_sisatilat',
    name: 'Muut sisätilat',
    icon: 'DoorOpen',
    description: 'Olohuone, makuuhuoneet, käytävät, porrashuone – pintamateriaalit, kosteus',
  },
  {
    id: 'lammitys',
    name: 'Lämmitysjärjestelmä',
    icon: 'Thermometer',
    description: 'Lämmityslaitteisto, patterit, lattialämmitys, tulisijat, hormit',
  },
  {
    id: 'vesi_viemari',
    name: 'Vesi- ja viemärijärjestelmä',
    icon: 'Pipe',
    description: 'Käyttövesiputket, viemärit, vesikalusteet, iän arviointi',
  },
  {
    id: 'sahko',
    name: 'Sähköjärjestelmä',
    icon: 'Zap',
    description: 'Sähkökeskus, johdotukset, pistorasiat, maadoitus, vikavirtasuojat',
  },
  {
    id: 'ilmanvaihto',
    name: 'Ilmanvaihto',
    icon: 'Wind',
    description: 'IV-koneisto, kanavat, venttiilit, toiminta, puhtaus',
  },
  {
    id: 'turvallisuus',
    name: 'Paloturvallisuus ja haitta-aineet',
    icon: 'ShieldAlert',
    description: 'Palovaroittimet, sammutin, asbesti, radon, lyijy – rakennusvuoden mukaiset riskit',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// API response types
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface TranscribeResponse {
  result: string;
}

export interface PhotoCaptionResponse {
  caption: string;
}

export interface SummaryResponse {
  result: string;
}
