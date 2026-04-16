import { PropertyInfo, RiskStructure } from '../types';

/**
 * Tunnistaa automaattisesti riskirakenteet rakennusvuoden ja rakennetyyppien perusteella.
 * Perustuu Suomen rakentamismääräyskokoelmaan, RT-kortistoon ja alan tunnettuihin riskirakenteisiin.
 */
export function detectRiskStructures(propertyInfo: PropertyInfo): RiskStructure[] {
  const risks: RiskStructure[] = [];
  const year = parseInt(propertyInfo.buildYear);

  if (!propertyInfo.buildYear || isNaN(year)) return risks;

  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // ─── Asbesti (ennen 1994) ───────────────────────────────────────────────────
  if (year < 1994) {
    risks.push({
      name: 'Asbestipitoinen materiaali',
      description: `Rakennus on valmistunut ${year}, jolloin asbestia käytettiin yleisesti rakennusaineena. ` +
        'Asbestia voi esiintyä: lattiamassoissa ja -laatoissa, putkieristeissä, tasoitteissa, kattolevyissä, ' +
        'tiivistysmateriaaleissa ja hormeissa.',
      severity: year < 1980 ? 'high' : 'medium',
      recommendation: 'Ennen korjaustöihin ryhtymistä tulee teettää asbestikartoitus. ' +
        'Asbestipurku vaatii aina pätevän urakoitsijan.',
    });
  }

  // ─── Valesokkeli ────────────────────────────────────────────────────────────
  if (propertyInfo.foundationType === 'Valesokkeli') {
    risks.push({
      name: 'Valesokkeli',
      description: 'Valesokkeli on tunnettu riskirakennetyyppi, jossa lattian alapuolinen lämmöneriste ' +
        'sijaitsee kosteudelle alttiissa asemassa maata vasten tai sokkelin sisällä. ' +
        'Kosteuden kertyminen eristeeseen voi aiheuttaa mikrobivaurioita.',
      severity: 'high',
      recommendation: 'Alapohjan kosteusolosuhteet tulee selvittää porareikämittauksin. ' +
        'Rakenteen korjaaminen voi vaatia alapohjan purkamista.',
    });
  }

  // ─── Tasakatto ──────────────────────────────────────────────────────────────
  if (propertyInfo.roofType && propertyInfo.roofType.toLowerCase().includes('tasakatto')) {
    risks.push({
      name: 'Tasakatto',
      description: 'Tasakatot ovat alttiita vesivuodoille etenkin läpivientien, reunojen ja vanhenevien ' +
        'katemateriaalien kohdalta. Veden seisominen katolla nopeuttaa vaurioitumista.',
      severity: 'medium',
      recommendation: 'Katteen kunto, läpiviennit, kallistukset ja vedenpoisto tulee tarkastaa vuosittain. ' +
        'Kate on uusittava teknisen käyttöiän (yleensä 20–30 v) päättyessä.',
    });
  }

  // ─── Valurautaviemärit ──────────────────────────────────────────────────────
  if (propertyInfo.drainagePipeType === 'Valurauta') {
    const lifespanYears = 50;
    const severity = age > lifespanYears ? 'high' : 'medium';
    risks.push({
      name: 'Valurautaviemärit',
      description: `Valurautaviemäreillä on tekninen käyttöikä noin ${lifespanYears} vuotta. ` +
        `Rakennus on nyt ${age} vuotta vanha. Valurauta voi olla hapettunutta, halkeillutta tai tukossa.`,
      severity,
      recommendation: 'Viemäreiden kuvaus (TV-kuvaus) suositellaan kunnon selvittämiseksi. ' +
        'Viemärilinjojen uusiminen voi olla ajankohtaista.',
    });
  }

  // ─── Galvanoitu teräs käyttövesiputki ───────────────────────────────────────
  if (propertyInfo.waterPipeType === 'Galvanoitu teräs') {
    risks.push({
      name: 'Galvanoidut teräsputket (käyttövesi)',
      description: 'Galvanoiduilla teräsputkilla on tekninen käyttöikä 30–50 vuotta. ' +
        'Ne ruostuvat sisäpinnaltaan, mikä heikentää vedenpainetta ja voi aiheuttaa ' +
        'rautapitoista käyttövettä sekä vuotoriskiä.',
      severity: 'high',
      recommendation: 'Putkiston kunto on selvitettävä ja putkiremontin tarve arvioitava. ' +
        'Veden laatu suositellaan tarkistettavaksi.',
    });
  }

  // ─── Painovoimainen ilmanvaihto ─────────────────────────────────────────────
  if (propertyInfo.ventilationType === 'Painovoimainen') {
    risks.push({
      name: 'Painovoimainen ilmanvaihto',
      description: 'Painovoimainen ilmanvaihto ei täytä nykyisiä rakentamismääräyksiä (D2) ' +
        'eikä takaa riittävää ilmanvaihtoa erityisesti kesäaikaan, kun paine-erot ovat pienet. ' +
        'Sisäilman laatu voi kärsiä.',
      severity: 'medium',
      recommendation: 'Ilmanvaihdon toimivuus on tarkistettava ja parantamistoimenpiteitä harkittava. ' +
        'Korvausilman saanti on varmistettava.',
    });
  }

  // ─── Vanha sähköjärjestelmä ─────────────────────────────────────────────────
  if (year < 1970) {
    risks.push({
      name: 'Vanhentunut sähköjärjestelmä',
      description: `Ennen 1970-lukua rakennetuissa kohteissa sähköjärjestelmä ei välttämättä täytä ` +
        'nykyisiä turvallisuusmääräyksiä. Johdotukset voivat olla PVC-päällysteisiä kumijohdinkaapeleita ' +
        'ilman maadoitusta tai vikavirtasuojia.',
      severity: 'medium',
      recommendation: 'Sähkötarkastus valtuutetulla sähköasentajalla suositellaan. ' +
        'Sähkökeskuksen ja johdotusten uusiminen voi olla tarpeen.',
    });
  }

  // ─── Vanha öljylämmitys ─────────────────────────────────────────────────────
  if (propertyInfo.heatingSystem === 'Öljylämmitys' && year < 1990) {
    risks.push({
      name: 'Öljylämmitys – öljysäiliön kunto',
      description: 'Vanhat öljysäiliöt (yleensä maanalaiset tai kellariset) voivat olla ' +
        'korrosoituneita ja aiheuttaa öljyvahingon riskin. Öljylämmityksestä on myös ' +
        'suunniteltu luopumisvelvoitetta tulevaisuudessa.',
      severity: 'medium',
      recommendation: 'Öljysäiliön kunto ja tiiviys tulee tarkistaa. Säiliön ikä ja ' +
        'mahdollinen öljymaaperä on selvitettävä.',
    });
  }

  // ─── Radon ─────────────────────────────────────────────────────────────────
  if (year < 1995 && propertyInfo.foundationType &&
      ['Maanvarainen laatta', 'Valesokkeli', 'Rossipohja'].includes(propertyInfo.foundationType)) {
    risks.push({
      name: 'Radonriski',
      description: 'Radon on radioaktiivinen maaperästä vapautuva kaasu, joka on merkittävä ' +
        'keuhkosyöpäriskiä aiheuttava tekijä. Rakennusvuosi ja perustusratkaisu voivat altistaa ' +
        'korkeille radonpitoisuuksille.',
      severity: 'medium',
      recommendation: 'Radonmittaus suositellaan. Mittaus on tehtävä pitkäaikaismittauksena (vähintään 2 kk). ' +
        'Tarvittaessa radonkorjaus toteutetaan alipaineistuksella.',
    });
  }

  // ─── Lyijyputket (erittäin vanhat kohteet) ────────────────────────────────
  if (year < 1960 && propertyInfo.waterPipeType !== 'Muovi' && propertyInfo.waterPipeType !== 'Kupari') {
    risks.push({
      name: 'Mahdolliset lyijyputket',
      description: 'Ennen 1960-lukua rakennetuissa kohteissa käyttövesiputket saattoivat olla lyijyä. ' +
        'Lyijy on myrkyllinen raskasmetalli ja sen käyttö putkistossa on kielletty.',
      severity: 'high',
      recommendation: 'Käyttövesiputkiston materiaalit on selvitettävä. ' +
        'Tarvittaessa putket on uusittava välittömästi.',
    });
  }

  // ─── Vanhat muoviviemärit (ristisillytetty PE) ───────────────────────────
  if (year >= 1960 && year <= 1985 && propertyInfo.drainagePipeType === 'Muovi PVC') {
    risks.push({
      name: 'Alkuvaiheen muoviviemärit',
      description: '1960–1980-luvuilla asennetut muoviviemärit voivat olla hauraita tai ' +
        'huonolaatuisia alkuvaiheen muovilaaduista. Liitokset ja tiivisteet voivat olla vuotavia.',
      severity: 'medium',
      recommendation: 'Viemäreiden TV-kuvaus suositellaan kunnon selvittämiseksi.',
    });
  }

  return risks;
}

export function getRiskSummary(risks: RiskStructure[]): { high: number; medium: number } {
  return {
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
  };
}
