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
  processedText: string;     // AI-professionalised text
  withTheory: string;        // Text + technical theory added by AI
  photos: Photo[];
  urgency: UrgencyLevel;
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

export interface PropertyInfo {
  address: string;
  postalCode: string;
  city: string;
  propertyId: string;        // Kiinteistötunnus
  buildYear: string;
  buildingType: string;      // Omakotitalo, Rivitalo, etc.
  floorArea: string;         // m²
  floors: string;
  heatingSystem: string;
  inspector: string;
  inspectorTitle: string;
  inspectionDate: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  weatherConditions: string;
  outdoorTemp: string;
  indoorTemp: string;
  additionalInfo: string;
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
    name: 'Perustukset ja maanvastainen rakenne',
    icon: 'Layers',
    description: 'Perustukset, sokkelit, maanvastaiset seinät, salaojitus',
  },
  {
    id: 'alapohja',
    name: 'Alapohja',
    icon: 'Square',
    description: 'Alapohjarakenne, ryömintätila, kosteus',
  },
  {
    id: 'ulkoseinat',
    name: 'Ulkoseinät ja julkisivu',
    icon: 'Home',
    description: 'Ulkoverhous, ikkunapellit, räystäät, maalaus',
  },
  {
    id: 'ikkunat',
    name: 'Ikkunat ja ulko-ovet',
    icon: 'Maximize2',
    description: 'Ikkunat, ulko-ovet, tiivisteet, kunto',
  },
  {
    id: 'vesikatto',
    name: 'Vesikatto ja yläpohja',
    icon: 'Triangle',
    description: 'Kattorakenne, kate, läpiviennit, yläpohjan eristys',
  },
  {
    id: 'markatilat',
    name: 'Märkätilat',
    icon: 'Droplets',
    description: 'Kylpyhuone, WC, sauna, kosteusvauriot',
  },
  {
    id: 'keittiö',
    name: 'Keittiö',
    icon: 'UtensilsCrossed',
    description: 'Keittiö, kalusteet, koneet, liesituuletin',
  },
  {
    id: 'muut_sisatilat',
    name: 'Muut sisätilat',
    icon: 'DoorOpen',
    description: 'Olohuone, makuuhuoneet, käytävät, porrashuone',
  },
  {
    id: 'lammitys',
    name: 'Lämmitysjärjestelmä',
    icon: 'Thermometer',
    description: 'Lämmityslaitteisto, patterit, lattialämmitys, hormit',
  },
  {
    id: 'vesi_viemari',
    name: 'Vesi- ja viemärijärjestelmä',
    icon: 'Pipe',
    description: 'Käyttövesiputket, viemärit, vesikalusteet',
  },
  {
    id: 'sahko',
    name: 'Sähköjärjestelmä',
    icon: 'Zap',
    description: 'Sähkökeskus, johdotukset, pistorasiat, turvallisuus',
  },
  {
    id: 'ilmanvaihto',
    name: 'Ilmanvaihto',
    icon: 'Wind',
    description: 'IV-koneisto, kanavat, venttiilit, toiminta',
  },
  {
    id: 'piha',
    name: 'Piha ja ympäristö',
    icon: 'Trees',
    description: 'Piha-alue, maanpinnan kallistukset, liittymät, autotalli',
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
