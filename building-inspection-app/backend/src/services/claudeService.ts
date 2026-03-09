import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-opus-4-6';

// System prompt for building inspection context
const INSPECTION_SYSTEM_PROMPT = `Avustat rakennustarkastajaa muotoilemaan kenttähavainnot kirjalliseen raporttiformaattiin.
Muotoilet tarkastajan havainnot selkeäksi, ammattimaiseksi tekstiksi säilyttäen tarkastajan alkuperäisen arvion ja johtopäätökset.
Et lisää omia tulkintoja tai arviointeja - tarkastaja on asiantuntija. Kirjoitat selkeää, ammattimaista suomen kieltä.`;

/**
 * Transcribes and professionalizes voice note text in Finnish
 */
export async function transcribeAndProfessionalize(rawText: string, category: string): Promise<string> {
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: INSPECTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Muotoile seuraava kenttähavainto raporttikielelle. Säilytä tarkastajan alkuperäinen havainto ja arvio.
Kategoria: ${category}

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
