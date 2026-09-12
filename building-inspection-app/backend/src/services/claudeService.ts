import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-opus-4-6';

// System prompt for building inspection context
const INSPECTION_SYSTEM_PROMPT = `Avustat rakennustarkastajaa muotoilemaan kenttähavainnot kirjalliseen raporttiformaattiin.
Muotoilet tarkastajan havainnot selkeäksi, ammattimaiseksi tekstiksi säilyttäen tarkastajan alkuperäisen arvion ja johtopäätökset.
Et lisää omia tulkintoja tai arviointeja - tarkastaja on asiantuntija. Kirjoitat selkeää, ammattimaista suomen kieltä.`;

// Extended system prompt with building context for smarter AI responses
function buildContextPrompt(buildingContext?: BuildingContext): string {
  if (!buildingContext) return INSPECTION_SYSTEM_PROMPT;

  const parts = [INSPECTION_SYSTEM_PROMPT, '\n\nKOHTEEN TAUSTATIEDOT:'];

  if (buildingContext.buildYear) parts.push(`- Rakennusvuosi: ${buildingContext.buildYear}`);
  if (buildingContext.buildingType) parts.push(`- Tyyppi: ${buildingContext.buildingType}`);
  if (buildingContext.foundationType) parts.push(`- Perustus: ${buildingContext.foundationType}`);
  if (buildingContext.wallType) parts.push(`- Ulkoseinä: ${buildingContext.wallType}`);
  if (buildingContext.roofType) parts.push(`- Vesikate: ${buildingContext.roofType}`);
  if (buildingContext.heatingSystem) parts.push(`- Lämmitys: ${buildingContext.heatingSystem}`);
  if (buildingContext.ventilationType) parts.push(`- Ilmanvaihto: ${buildingContext.ventilationType}`);
  if (buildingContext.drainagePipeType) parts.push(`- Viemärit: ${buildingContext.drainagePipeType}`);
  if (buildingContext.waterPipeType) parts.push(`- Käyttövesiputket: ${buildingContext.waterPipeType}`);

  parts.push('\nHuomioi kohteen ikä ja rakennetyypit arvioidessasi havaintojen merkitystä.');

  return parts.join('\n');
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

/**
 * Transcribes and professionalizes voice note text in Finnish
 */
export async function transcribeAndProfessionalize(rawText: string, category: string, fewShotExamples: string = ''): Promise<string> {
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: INSPECTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Muotoile seuraava kenttähavainto raporttikielelle. Säilytä tarkastajan alkuperäinen havainto ja arvio.
Kategoria: ${category}
${fewShotExamples}
Kenttämuistiinpano: "${rawText}"

Kirjoita havainto selkeästi raporttiin sopivaan muotoon. Käytä alan vakiintuneita termejä.
Älä lisää teoriatietoa tai omia tulkintoja. Vastaa vain muotoillulla tekstillä.`
    }],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : rawText;
}

/**
 * Adds technical theory and building regulation references to an observation
 */
export async function addTechnicalTheory(observation: string, category: string): Promise<string> {
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    system: INSPECTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Liitä seuraavaan kuntotarkastushavaintoon alan viitteet: tekninen tausta ja sovellettavat rakennusmääräykset tai standardit.

Kategoria: ${category}
Havainto: "${observation}"

Rakenne:
**Havainto:** [havainto sellaisenaan]

**Tekninen tausta:** [lyhyt kuvaus rakenteen toiminnasta ja havaitun asian merkityksestä]

**Sovellettavat määräykset:** [RT-kortti, rakennusmääräys tai standardi, jos sovellettavissa]

Pidä viiteosuus tiiviinä (2-4 lausetta).`
    }],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : observation;
}

/**
 * Generates automatic caption for a building inspection photo using Claude Vision
 */
export async function generatePhotoCaption(imageBase64: string, mediaType: string, category: string): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: INSPECTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: imageBase64,
          },
        },
        {
          type: 'text',
          text: `Kirjoita tälle kuntotarkastusvalokuvalle ammattimainen ja täsmällinen kuvateksti suomeksi.
Kategoria: ${category}

Kuvaile lyhyesti (1-2 lausetta) mitä kuvassa näkyy rakennusteknisestä näkökulmasta.
Mainitse näkyvät vauriot, rakenteet tai puutteet ammattitermein.
Vastaa vain kuvatekstillä, ilman otsikoita tai erillistä rakennetta.`,
        },
      ],
    }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : `Kuva kohteesta: ${category}`;
}

/**
 * Generates the findings summary table from all report observations
 */
export async function generateFindingsSummary(observations: Array<{
  category: string;
  text: string;
  urgency?: string;
}>): Promise<string> {
  const observationText = observations
    .map(o => `- ${o.category}: ${o.text}`)
    .join('\n');

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 3000,
    thinking: { type: 'adaptive' },
    system: INSPECTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Luo kuntotarkastusraportin havaintoyhteenveto seuraavien havaintojen perusteella.

Havainnot:
${observationText}

Luo selkeä taulukko jossa on seuraavat sarakkeet:
1. Kohde (rakenneosa)
2. Havainto (lyhyt kuvaus)
3. Kiireellisyys (Välitön / 1-2v / 3-5v / Seurattava)
4. Toimenpide-ehdotus

Käytä Markdown-taulukkoa. Järjestä kiireellisimmät ensin.
Lisää taulukon jälkeen lyhyt (3-5 lausetta) yleisarvio kohteen kunnosta.`
    }],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

/**
 * Generates the final report summary
 */
export async function generateFinalSummary(reportData: {
  propertyInfo: Record<string, unknown>;
  observations: Array<{ category: string; text: string }>;
  findingsSummary: string;
}): Promise<string> {
  const p = reportData.propertyInfo as Record<string, string>;

  const olosuhdetiedot = [
    p.inspectionDate && `Päivämäärä: ${p.inspectionDate}`,
    p.weatherConditions && `Sää: ${p.weatherConditions}`,
    p.outdoorTemp && `Ulkolämpötila: ${p.outdoorTemp} °C`,
    p.outdoorHumidity && `Ulkoilman kosteus: ${p.outdoorHumidity} %`,
    p.indoorTemp && `Sisälämpötila: ${p.indoorTemp} °C`,
    p.indoorHumidity && `Sisäilman kosteus: ${p.indoorHumidity} %`,
  ].filter(Boolean).join(', ');

  const kohdetiedot = [
    p.address && `${p.address}, ${p.postalCode} ${p.city}`,
    p.buildYear && `Rakennusvuosi: ${p.buildYear}`,
    p.buildingType && `Tyyppi: ${p.buildingType}`,
    p.floorArea && `Kerrosala: ${p.floorArea} m²`,
    p.energyClass && `Energialuokka: ${p.energyClass}`,
    p.foundationType && `Perustus: ${p.foundationType}`,
    p.wallType && `Ulkoseinä: ${p.wallType}`,
    p.roofType && `Vesikate: ${p.roofType}`,
    p.heatingSystem && `Lämmitys: ${p.heatingSystem}`,
    p.ventilationType && `Ilmanvaihto: ${p.ventilationType}`,
    p.drainagePipeType && `Viemärit: ${p.drainagePipeType}`,
    p.waterPipeType && `Käyttövesiputket: ${p.waterPipeType}`,
  ].filter(Boolean).join('\n');

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 5000,
    thinking: { type: 'adaptive' },
    system: INSPECTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Laadi kattava loppuyhteenveto kuntotarkastusraportille.

KOHDE:
${kohdetiedot}

TARKASTUSOLOSUHTEET:
${olosuhdetiedot || 'Ei kirjattu'}

KÄYTETYT LAITTEET:
${p.devicesUsed || 'Ei kirjattu'}

OMISTAJAN ILMOITTAMAT VIRHEET:
${p.ownerDefects || 'Ei omistajan ilmoituksia'}

TARKASTUKSEN RAJAUKSET:
${p.accessLimitations || 'Ei rajauksia – kaikki tilat tarkastettu'}

KATEGORIOIDEN HAVAINNOT:
${reportData.observations.map(o => `**${o.category}:** ${o.text}`).join('\n\n')}

HAVAINTOYHTEENVETO:
${reportData.findingsSummary}

Kirjoita ammattimainen loppuyhteenveto seuraavilla osioilla:

## Yleisarvio
Kohteen yleinen kuntoluokka (Hyvä / Tyydyttävä / Välttävä / Huono) ja lyhyt perustelu.

## Tärkeimmät havainnot
3–5 keskeisintä löydöstä luettelona.

## Kiireelliset toimenpiteet
Välittömästi tai lähivuosina tehtävät korjaukset.

## Suositukset jatkoselvityksiin
Mahdolliset lisätutkimukset tai -katselmukset (esim. viemärin kuvaus, asbestikartoitus, radonmittaus).

## Vastuunrajaukset
Kirjoita tähän standardin mukaiset vastuunrajauslausekkeet: tarkastus on aistinvarainen eikä paljasta rakenteen sisäisiä piileviä vaurioita; tarkastus ei poista ostajan selonottovelvollisuutta; tarkastuksen ulkopuolelle jääneet tilat eivät kuulu tarkastuksen piiriin.

Kirjoita asiallisella, objektiivisella ammattikielellä. Älä lisää omia arvioita tarkastajan tekemien havaintojen päälle.`
    }],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

/**
 * Streams AI processing with real-time updates
 */
export async function streamProcessObservation(
  rawText: string,
  category: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    system: INSPECTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Muotoile kenttähavainto raporttikielelle ja liitä alan viitteet.

Kategoria: ${category}
Kenttämuistiinpano: "${rawText}"

Rakenne:
**Havainto:** [muotoiltu havainto, tarkastajan arvio säilytetään]

**Tekninen tausta:** [lyhyt kuvaus rakenteen toiminnasta ja havaitun asian merkityksestä]

**Sovellettavat määräykset:** [RT-kortti tai rakennusmääräys, jos sovellettavissa]

**Toimenpide-ehdotus:** [konkreettinen toimenpide]`,
    }],
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      onChunk(event.delta.text);
    }
  }

  return fullText;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW AI FEATURES: Auto-urgency, batch processing, completeness, checklists
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AI-powered urgency suggestion based on observation text.
 * Returns a suggested urgency level with confidence and reasoning.
 */
export async function suggestUrgency(
  observationText: string,
  category: string,
  buildingContext?: BuildingContext
): Promise<{ urgency: string; confidence: number; reasoning: string }> {
  const systemPrompt = buildContextPrompt(buildingContext);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Arvioi seuraavan kuntotarkastushavainnon kiireellisyys. Vastaa JSON-muodossa.

Kategoria: ${category}
Havainto: "${observationText}"

Kiireellisyystasot:
- "välitön" = Turvallisuusriski tai välitöntä korjausta vaativa vaurio
- "1-2v" = Korjattava 1-2 vuoden sisällä, muuten vaurio pahenee
- "3-5v" = Korjaus ajankohtainen 3-5 vuoden sisällä
- "seurattava" = Seurattava tilanne, ei välitöntä korjaustarvetta
- "ei_toimenpiteitä" = Normaali kunto, ei toimenpiteitä

Vastaa VAIN tällä JSON-rakenteella, ei muuta tekstiä:
{"urgency": "kiireellisyystaso", "confidence": 0.0-1.0, "reasoning": "lyhyt perustelu"}`
    }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (textBlock) {
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // fallback
    }
  }
  return { urgency: 'seurattava', confidence: 0.5, reasoning: 'Automaattinen arvio ei onnistunut' };
}

/**
 * Processes observation fully in one call: professionalizes text, adds theory,
 * suggests urgency, and generates action recommendation.
 */
export async function processObservationFull(
  rawText: string,
  category: string,
  buildingContext?: BuildingContext,
  fewShotExamples: string = ''
): Promise<{
  processedText: string;
  withTheory: string;
  urgency: string;
  actionRecommendation: string;
}> {
  const systemPrompt = buildContextPrompt(buildingContext);

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 3000,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Käsittele tämä kuntotarkastushavainto kokonaisuudessaan. Vastaa JSON-muodossa.

Kategoria: ${category}
${fewShotExamples}
Kenttämuistiinpano: "${rawText}"

Vastaa VAIN tällä JSON-rakenteella:
{
  "processedText": "Muotoiltu ammattimainen teksti (säilytä tarkastajan arvio, käytä alan termejä)",
  "withTheory": "**Havainto:** [muotoiltu teksti]\\n\\n**Tekninen tausta:** [rakenteen toiminta ja havaitun asian merkitys]\\n\\n**Sovellettavat määräykset:** [RT-kortti tai rakennusmääräys]\\n\\n**Toimenpide-ehdotus:** [konkreettinen toimenpide]",
  "urgency": "välitön|1-2v|3-5v|seurattava|ei_toimenpiteitä",
  "actionRecommendation": "Konkreettinen toimenpidesuositus yhdellä lauseella"
}`
    }],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find(b => b.type === 'text');
  if (textBlock) {
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // fallback to simpler processing
    }
  }

  // Fallback: return raw text with defaults
  return {
    processedText: rawText,
    withTheory: rawText,
    urgency: 'seurattava',
    actionRecommendation: '',
  };
}

/**
 * Batch processes multiple observations at once, returning results for each.
 */
export async function batchProcessObservations(
  observations: Array<{ id: string; rawText: string; category: string }>,
  buildingContext?: BuildingContext
): Promise<Array<{
  id: string;
  processedText: string;
  withTheory: string;
  urgency: string;
  actionRecommendation: string;
}>> {
  const systemPrompt = buildContextPrompt(buildingContext);

  const observationsList = observations
    .map((o, i) => `[${i + 1}] ID: ${o.id}\nKategoria: ${o.category}\nTeksti: "${o.rawText}"`)
    .join('\n\n');

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Käsittele nämä ${observations.length} kuntotarkastushavaintoa kerralla. Muotoile ammattimainen teksti, lisää tekninen tausta ja viitteet, ehdota kiireellisyys ja toimenpide.

HAVAINNOT:
${observationsList}

Vastaa VAIN JSON-taulukolla:
[
  {
    "id": "havainnon id",
    "processedText": "Muotoiltu teksti",
    "withTheory": "**Havainto:** ...\\n\\n**Tekninen tausta:** ...\\n\\n**Sovellettavat määräykset:** ...\\n\\n**Toimenpide-ehdotus:** ...",
    "urgency": "välitön|1-2v|3-5v|seurattava|ei_toimenpiteitä",
    "actionRecommendation": "Toimenpidesuositus"
  }
]`
    }],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find(b => b.type === 'text');
  if (textBlock) {
    try {
      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // fallback
    }
  }

  // Fallback: return originals with defaults
  return observations.map(o => ({
    id: o.id,
    processedText: o.rawText,
    withTheory: o.rawText,
    urgency: 'seurattava',
    actionRecommendation: '',
  }));
}

/**
 * AI-powered completeness check: analyzes which areas have been inspected
 * and recommends missing inspections based on building type and year.
 */
export async function checkCompleteness(
  inspectedCategories: Array<{ name: string; observationCount: number }>,
  buildingContext?: BuildingContext
): Promise<{
  completenessPercent: number;
  missingAreas: Array<{ area: string; importance: 'critical' | 'recommended' | 'optional'; reason: string }>;
  overallAssessment: string;
}> {
  const systemPrompt = buildContextPrompt(buildingContext);

  const categoriesList = inspectedCategories
    .map(c => `- ${c.name}: ${c.observationCount} havaintoa`)
    .join('\n');

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Arvioi kuntotarkastuksen kattavuus. Tunnista puuttuvat tai vajavaisesti tarkastetut alueet.

TARKASTETUT KATEGORIAT:
${categoriesList}

Vastaa VAIN tällä JSON-rakenteella:
{
  "completenessPercent": 0-100,
  "missingAreas": [
    {"area": "alueen nimi", "importance": "critical|recommended|optional", "reason": "miksi tärkeä"}
  ],
  "overallAssessment": "Lyhyt arvio tarkastuksen kattavuudesta (2-3 lausetta)"
}`
    }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (textBlock) {
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // fallback
    }
  }

  return {
    completenessPercent: 0,
    missingAreas: [],
    overallAssessment: 'Kattavuusarvio ei onnistunut.',
  };
}

/**
 * Generates AI-powered checklist items for a specific inspection category,
 * tailored to the building's type, year, and known systems.
 */
export async function generateCategoryChecklist(
  categoryName: string,
  categoryDescription: string,
  buildingContext?: BuildingContext
): Promise<Array<{ item: string; priority: 'high' | 'medium' | 'low'; hint: string }>> {
  const systemPrompt = buildContextPrompt(buildingContext);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Luo tarkastuslista kategorialle "${categoryName}" (${categoryDescription}).

Luo 5-10 konkreettista tarkastuskohdetta, jotka tarkastajan on käytävä läpi tässä kategoriassa.
Huomioi kohteen rakennusvuosi ja rakennetyypit tarkastuskohteissa.

Vastaa VAIN JSON-taulukolla:
[
  {"item": "Tarkastuskohde lyhyesti", "priority": "high|medium|low", "hint": "Mitä tarkastajan tulee erityisesti huomioida (1 lause)"}
]

Järjestä tärkeimmät ensin.`
    }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (textBlock) {
    try {
      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // fallback
    }
  }

  return [];
}

/**
 * Analyzes a building inspection photo for defects and issues.
 * Returns structured analysis with defect detection and severity.
 */
export async function analyzePhotoDefects(
  imageBase64: string,
  mediaType: string,
  category: string,
  buildingContext?: BuildingContext
): Promise<{
  caption: string;
  defectsFound: boolean;
  defects: Array<{ description: string; severity: 'high' | 'medium' | 'low' }>;
  suggestedObservation: string;
}> {
  const systemPrompt = buildContextPrompt(buildingContext);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: imageBase64,
          },
        },
        {
          type: 'text',
          text: `Analysoi tämä kuntotarkastusvalokuva. Kategoria: ${category}

Tunnista näkyvät vauriot, puutteet tai huomionarvoiset asiat. Vastaa VAIN JSON-muodossa:
{
  "caption": "Ammattimainen kuvateksti 1-2 lauseella",
  "defectsFound": true/false,
  "defects": [
    {"description": "Vaurion kuvaus", "severity": "high|medium|low"}
  ],
  "suggestedObservation": "Ehdotettu havaintoteksti tarkastajan lisättäväksi raporttiin (jos vaurioita löytyy, muuten tyhjä)"
}`,
        },
      ],
    }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (textBlock) {
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // fallback
    }
  }

  return {
    caption: `Kuva kohteesta: ${category}`,
    defectsFound: false,
    defects: [],
    suggestedObservation: '',
  };
}

/**
 * Generates observation templates from detected risk structures.
 * Creates pre-filled observation texts for each risk that the inspector can verify.
 */
export async function generateRiskObservations(
  risks: Array<{ name: string; description: string; severity: string; recommendation: string }>,
  buildingContext?: BuildingContext
): Promise<Array<{
  riskName: string;
  category: string;
  observationTemplate: string;
  urgency: string;
}>> {
  if (risks.length === 0) return [];

  const systemPrompt = buildContextPrompt(buildingContext);

  const risksList = risks
    .map(r => `- ${r.name} (${r.severity}): ${r.description}`)
    .join('\n');

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Luo valmiit havaintopohjat tarkastajalle seuraaville tunnistetuille riskirakenteille.
Jokainen pohja on esimuotoiltu teksti, jonka tarkastaja voi suoraan lisätä raporttiin tarkastuksen jälkeen.

TUNNISTETUT RISKIRAKENTEET:
${risksList}

Vastaa VAIN JSON-taulukolla:
[
  {
    "riskName": "Riskin nimi",
    "category": "kategoria-id (perustukset|ulkoalueet|ulkoseinat|ikkunat|vesikatto|markatilat|keittiö|muut_sisatilat|lammitys|vesi_viemari|sahko|ilmanvaihto|turvallisuus)",
    "observationTemplate": "Valmis havaintopohja jossa tarkastajan tulee täydentää [hakasulkeissa] olevat kohdat",
    "urgency": "välitön|1-2v|3-5v|seurattava|ei_toimenpiteitä"
  }
]`
    }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (textBlock) {
    try {
      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // fallback
    }
  }

  return [];
}
