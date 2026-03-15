/**
 * Technical lifespan database for Finnish building components.
 * Based on RT-kortisto (Rakennustietosäätiö) and KH-ohjekortit.
 * Used for automatic age-based warnings and recommendations.
 */

export interface LifespanEntry {
  component: string;
  category: string;
  lifespanYears: [number, number]; // [min, max]
  inspectionIntervalYears: number;
  rtReference?: string;
  description: string;
}

export const LIFESPAN_DATABASE: LifespanEntry[] = [
  // ─── Vesikatto ja yläpohja ──────────────────────────────────────
  {
    component: 'Profiilipeltikate',
    category: 'vesikatto',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 85-11163',
    description: 'Profiilipeltikatteen pinnoitteen kunto ja kiinnitysten tiiviys tarkastettava säännöllisesti.',
  },
  {
    component: 'Tiilikate',
    category: 'vesikatto',
    lifespanYears: [40, 60],
    inspectionIntervalYears: 5,
    rtReference: 'RT 85-11163',
    description: 'Tiilikatteen rikkoutuneet tiilet, sammaloituminen ja aluskateellinen kunto tarkastettava.',
  },
  {
    component: 'Bitumihuopakate',
    category: 'vesikatto',
    lifespanYears: [20, 30],
    inspectionIntervalYears: 3,
    rtReference: 'RT 85-11163',
    description: 'Bitumihuopakate vanhenee UV-säteilyn ja lämpötilamuutosten vaikutuksesta.',
  },
  {
    component: 'Betonikate',
    category: 'vesikatto',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 85-11163',
    description: 'Betonikivikatteen pakkasrapautuminen ja sammaloituminen tarkastettava.',
  },
  {
    component: 'Bitumikermikate (tasakatto)',
    category: 'vesikatto',
    lifespanYears: [20, 30],
    inspectionIntervalYears: 2,
    rtReference: 'RT 85-11163',
    description: 'Tasakaton bitumikermikate vaatii tiheämpää tarkastusta vedenpoiston ja liitoskohtien osalta.',
  },

  // ─── Märkätilat ─────────────────────────────────────────────────
  {
    component: 'Märkätilan vedeneristys',
    category: 'markatilat',
    lifespanYears: [20, 25],
    inspectionIntervalYears: 5,
    rtReference: 'RT 84-11166',
    description: 'Märkätilan vedeneristyksen tekninen käyttöikä. Ennen 1999 rakennetuissa kohteissa vedeneristys voi puuttua kokonaan.',
  },
  {
    component: 'Laatoitus (märkätila)',
    category: 'markatilat',
    lifespanYears: [20, 30],
    inspectionIntervalYears: 5,
    rtReference: 'RT 84-11166',
    description: 'Laatoituksen irtoaminen, halkeamat ja saumauksien rapautuminen.',
  },
  {
    component: 'Silikonisaumat',
    category: 'markatilat',
    lifespanYears: [8, 15],
    inspectionIntervalYears: 3,
    rtReference: 'RT 84-11166',
    description: 'Silikonisaumat ovat kulutusosa ja vaativat säännöllistä uusimista.',
  },
  {
    component: 'Lattiakaivo',
    category: 'markatilat',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 84-11166',
    description: 'Lattiakaivon korokerenkaan, tiivisteen ja vedeneristyksen liitoksen kunto.',
  },

  // ─── Vesi- ja viemärijärjestelmä ────────────────────────────────
  {
    component: 'Kupariset käyttövesiputket',
    category: 'vesi_viemari',
    lifespanYears: [40, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'Kupariputkien pistesyöpymät ja liitoskohtien vuodot.',
  },
  {
    component: 'Galvanoidut teräsputket',
    category: 'vesi_viemari',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 18-11217',
    description: 'Galvanoidut teräsputket ruostuvat sisäpinnaltaan ja tukkeutuvat.',
  },
  {
    component: 'Muoviset käyttövesiputket (PEX)',
    category: 'vesi_viemari',
    lifespanYears: [50, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'PEX-putkien tekninen käyttöikä on pitkä, liitokset tarkastettava.',
  },
  {
    component: 'Valurautaviemärit',
    category: 'vesi_viemari',
    lifespanYears: [40, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'Valurautaviemärit voivat syöpyä, haljeta tai tukkeutua.',
  },
  {
    component: 'Muoviviemärit (PVC)',
    category: 'vesi_viemari',
    lifespanYears: [50, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'Muoviviemäreiden liitoskohtien tiiviys ja painumat.',
  },
  {
    component: 'Lämminvesivaraaja',
    category: 'vesi_viemari',
    lifespanYears: [15, 25],
    inspectionIntervalYears: 5,
    rtReference: 'RT 18-11217',
    description: 'Lämminvesivaraajan anodi, tiivisteet ja paineen kestävyys.',
  },
  {
    component: 'Vesikalusteet (hanat)',
    category: 'vesi_viemari',
    lifespanYears: [15, 25],
    inspectionIntervalYears: 5,
    rtReference: 'RT 18-11217',
    description: 'Vesikalusteiden mekanismit ja tiivisteet.',
  },

  // ─── Lämmitysjärjestelmä ────────────────────────────────────────
  {
    component: 'Öljykattila',
    category: 'lammitys',
    lifespanYears: [20, 30],
    inspectionIntervalYears: 3,
    rtReference: 'RT 18-11217',
    description: 'Öljykattilan poltin, savuhormi ja säiliö vaativat säännöllistä huoltoa.',
  },
  {
    component: 'Öljysäiliö (maanalainen)',
    category: 'lammitys',
    lifespanYears: [30, 40],
    inspectionIntervalYears: 5,
    rtReference: 'RT 18-11217',
    description: 'Maanalaisen öljysäiliön korroosio ja vuotoriskit.',
  },
  {
    component: 'Vesikiertoinen patterijärjestelmä',
    category: 'lammitys',
    lifespanYears: [40, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'Pattereiden venttiilit, putkiliitosten vuodot ja termostaatit.',
  },
  {
    component: 'Lattialämmitysputkisto',
    category: 'lammitys',
    lifespanYears: [40, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'Lattialämmitysputkiston vuodot ja jakotukki.',
  },
  {
    component: 'Ilmalämpöpumppu',
    category: 'lammitys',
    lifespanYears: [10, 20],
    inspectionIntervalYears: 3,
    rtReference: 'RT 18-11217',
    description: 'Ilmalämpöpumpun kompressori, suodattimet ja kylmäaine.',
  },
  {
    component: 'Maalämpöpumppu',
    category: 'lammitys',
    lifespanYears: [20, 30],
    inspectionIntervalYears: 5,
    rtReference: 'RT 18-11217',
    description: 'Maalämpöpumpun kompressori, keruupiiri ja vaihdin.',
  },
  {
    component: 'Tulisija (takka/uuni)',
    category: 'lammitys',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 51-10846',
    description: 'Tulisijan muurauksen halkeamat, pellitykset ja hormin kunto.',
  },
  {
    component: 'Savuhormi',
    category: 'lammitys',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 51-10846',
    description: 'Savuhormin muuraus, pellitys ja läpiviennit. Nuohouksesta huolehdittava.',
  },

  // ─── Sähköjärjestelmä ──────────────────────────────────────────
  {
    component: 'Sähkökeskus',
    category: 'sahko',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'Sähkökeskuksen kapasiteetti ja komponenttien kunto.',
  },
  {
    component: 'Sähköjohdotukset (alumiini)',
    category: 'sahko',
    lifespanYears: [30, 40],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'Alumiinijohdot hapettuvat liitoskohdista ja voivat aiheuttaa palovaaran.',
  },

  // ─── Ilmanvaihto ────────────────────────────────────────────────
  {
    component: 'Koneellinen ilmanvaihtokone',
    category: 'ilmanvaihto',
    lifespanYears: [15, 25],
    inspectionIntervalYears: 5,
    rtReference: 'RT 18-11217',
    description: 'IV-koneen moottori, suodattimet, LTO-kenno ja säätöautomatiikka.',
  },
  {
    component: 'IV-kanavat',
    category: 'ilmanvaihto',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 18-11217',
    description: 'IV-kanavien puhtaus ja tiiviys. Kanavat puhdistettava 5-10 vuoden välein.',
  },

  // ─── Perustukset ────────────────────────────────────────────────
  {
    component: 'Salaojajärjestelmä',
    category: 'perustukset',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 81-11099',
    description: 'Salaojien toimivuus, tarkastuskaivot ja huuhtelu.',
  },
  {
    component: 'Sadevesijärjestelmä (räystäskourut)',
    category: 'perustukset',
    lifespanYears: [20, 30],
    inspectionIntervalYears: 3,
    rtReference: 'RT 81-11099',
    description: 'Räystäskourujen ja syöksytorvien kunto, kallistukset ja kiinnitykset.',
  },
  {
    component: 'Routaeristys',
    category: 'perustukset',
    lifespanYears: [50, 50],
    inspectionIntervalYears: 10,
    rtReference: 'RT 81-11099',
    description: 'Routaeristyksen kunto ja laajuus.',
  },

  // ─── Ulkovaippa ─────────────────────────────────────────────────
  {
    component: 'Puuverhous (maalattu)',
    category: 'ulkoseinat',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 82-11168',
    description: 'Puuverhouksen maalaus uusittava 8-15 v välein. Lahovaurioiden tarkastus.',
  },
  {
    component: 'Ikkunat (puuikkunat)',
    category: 'ikkunat',
    lifespanYears: [30, 50],
    inspectionIntervalYears: 5,
    rtReference: 'RT 41-11217',
    description: 'Puuikkunoiden kitit, tiivisteet, maalaus ja lasien eheys.',
  },
  {
    component: 'Ikkunat (puualumiini)',
    category: 'ikkunat',
    lifespanYears: [40, 60],
    inspectionIntervalYears: 10,
    rtReference: 'RT 41-11217',
    description: 'Puualumiini-ikkunoiden tiivisteet ja lasielementtien kunto.',
  },
  {
    component: 'Ulko-ovet',
    category: 'ikkunat',
    lifespanYears: [25, 40],
    inspectionIntervalYears: 5,
    rtReference: 'RT 42-11217',
    description: 'Ulko-ovien tiivisteet, lukitus, saranakunto ja pinnoite.',
  },
];

/**
 * Returns components whose expected lifespan has been exceeded or is approaching.
 */
export interface LifespanWarning {
  entry: LifespanEntry;
  age: number;
  status: 'exceeded' | 'approaching' | 'due_inspection';
  message: string;
}

export function getLifespanWarnings(
  buildYear: number,
  propertyInfo: { roofType?: string; waterPipeType?: string; drainagePipeType?: string; heatingSystem?: string; ventilationType?: string }
): LifespanWarning[] {
  const currentYear = new Date().getFullYear();
  const age = currentYear - buildYear;
  const warnings: LifespanWarning[] = [];

  if (age <= 0) return warnings;

  // Map property info to relevant components
  const componentMatchers: Array<{ test: () => boolean; components: string[] }> = [
    {
      test: () => !!propertyInfo.roofType?.toLowerCase().includes('profiilipelti'),
      components: ['Profiilipeltikate'],
    },
    {
      test: () => !!propertyInfo.roofType?.toLowerCase().includes('tiili'),
      components: ['Tiilikate'],
    },
    {
      test: () => !!propertyInfo.roofType?.toLowerCase().includes('bitumihuopa'),
      components: ['Bitumihuopakate'],
    },
    {
      test: () => !!propertyInfo.roofType?.toLowerCase().includes('betonikate'),
      components: ['Betonikate'],
    },
    {
      test: () => !!propertyInfo.roofType?.toLowerCase().includes('tasakatto'),
      components: ['Bitumikermikate (tasakatto)'],
    },
    {
      test: () => propertyInfo.waterPipeType === 'Kupari',
      components: ['Kupariset käyttövesiputket'],
    },
    {
      test: () => propertyInfo.waterPipeType === 'Galvanoitu teräs',
      components: ['Galvanoidut teräsputket'],
    },
    {
      test: () => propertyInfo.drainagePipeType === 'Valurauta',
      components: ['Valurautaviemärit'],
    },
    {
      test: () => !!propertyInfo.heatingSystem?.includes('Öljy'),
      components: ['Öljykattila', 'Öljysäiliö (maanalainen)'],
    },
    {
      test: () => !!propertyInfo.ventilationType?.includes('Koneellinen'),
      components: ['Koneellinen ilmanvaihtokone'],
    },
  ];

  // Always check universal components
  const universalComponents = [
    'Märkätilan vedeneristys', 'Silikonisaumat', 'Salaojajärjestelmä',
    'Sadevesijärjestelmä (räystäskourut)', 'Sähkökeskus',
  ];

  const matchedComponentNames = new Set(universalComponents);
  for (const matcher of componentMatchers) {
    if (matcher.test()) {
      matcher.components.forEach(c => matchedComponentNames.add(c));
    }
  }

  for (const entry of LIFESPAN_DATABASE) {
    if (!matchedComponentNames.has(entry.component)) continue;

    const [minLife, maxLife] = entry.lifespanYears;
    const approachingThreshold = Math.floor(minLife * 0.8);

    if (age >= maxLife) {
      warnings.push({
        entry,
        age,
        status: 'exceeded',
        message: `${entry.component}: tekninen käyttöikä (${minLife}–${maxLife} v) ylitetty. Rakennuksen ikä ${age} v. ${entry.description}`,
      });
    } else if (age >= approachingThreshold) {
      warnings.push({
        entry,
        age,
        status: 'approaching',
        message: `${entry.component}: tekninen käyttöikä (${minLife}–${maxLife} v) lähestyy. Rakennuksen ikä ${age} v. ${entry.description}`,
      });
    } else if (age % entry.inspectionIntervalYears === 0 || age > entry.inspectionIntervalYears) {
      warnings.push({
        entry,
        age,
        status: 'due_inspection',
        message: `${entry.component}: tarkastusväli ${entry.inspectionIntervalYears} v. ${entry.rtReference || ''}`,
      });
    }
  }

  // Sort: exceeded first, then approaching, then inspection due
  const statusOrder = { exceeded: 0, approaching: 1, due_inspection: 2 };
  warnings.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return warnings;
}
