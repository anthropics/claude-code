// ─────────────────────────────────────────────────────────────────────────────
// KH 90-00394 mukainen tarkastuslista kategorioittain
// Perustuu Rakennustietosäätiön suoritusohjeeseen KH 90-00394 (2007)
// ─────────────────────────────────────────────────────────────────────────────

export interface KH90CheckItem {
  id: string;
  label: string;
  required: boolean; // pakollinen vs. suositeltava
}

export const KH90_CHECKLIST: Record<string, KH90CheckItem[]> = {
  perustukset: [
    { id: 'f1', label: 'Perustusten näkyvät osat ja sokkeli', required: true },
    { id: 'f2', label: 'Salaojien toiminta (tarkistuskaivot)', required: true },
    { id: 'f3', label: 'Maanpinnan kallistukset rakennuksen vierellä', required: true },
    { id: 'f4', label: 'Perusmuurin kosteusmerkit ja halkeamat', required: true },
    { id: 'f5', label: 'Sokkelipinnoitteen kunto', required: true },
    { id: 'f6', label: 'Routasuojauksen tarkastus', required: false },
    { id: 'f7', label: 'Alapohjan tuuletus (rossipohja)', required: false },
  ],
  ulkoalueet: [
    { id: 'u1', label: 'Sadevesien ohjaus ja kourut', required: true },
    { id: 'u2', label: 'Piha-alueen kallistukset', required: true },
    { id: 'u3', label: 'Rakennuksen vierusta (kasvillisuus, maa-aines)', required: true },
    { id: 'u4', label: 'Portaat, kaiteet ja kulkuväylät', required: true },
    { id: 'u5', label: 'Autokatokset ja varastorakennukset', required: false },
  ],
  ulkoseinat: [
    { id: 'e1', label: 'Julkisivuverhouksen kunto', required: true },
    { id: 'e2', label: 'Tuuletusraot ja -kanavat', required: true },
    { id: 'e3', label: 'Ikkunoiden ja ovien liittymät ulkoseinään', required: true },
    { id: 'e4', label: 'Pellitykset ja liittymäkohdat', required: true },
    { id: 'e5', label: 'Räystäsrakenteet ja otsalaudat', required: true },
    { id: 'e6', label: 'Maalipinnan/rappauksen kunto', required: true },
  ],
  ikkunat: [
    { id: 'i1', label: 'Ikkunoiden tiiveys ja toimivuus', required: true },
    { id: 'i2', label: 'Tiivisteiden kunto', required: true },
    { id: 'i3', label: 'Ikkunapellitykset ja vesiohjaus', required: true },
    { id: 'i4', label: 'Ulko-ovien tiiveys ja lukitus', required: true },
    { id: 'i5', label: 'Lasien kunto (huurustuminen)', required: true },
  ],
  vesikatto: [
    { id: 'r1', label: 'Vesikatteen kunto ja kiinnitys', required: true },
    { id: 'r2', label: 'Läpiviennit ja pellitykset', required: true },
    { id: 'r3', label: 'Räystäsrakenteet', required: true },
    { id: 'r4', label: 'Yläpohjan tuuletus', required: true },
    { id: 'r5', label: 'Yläpohjan eristeet ja höyrynsulku', required: true },
    { id: 'r6', label: 'Kattoturvatuotteet (tikkaat, kaiteet, lumiesteet)', required: true },
    { id: 'r7', label: 'Aluskatteen kunto', required: false },
  ],
  markatilat: [
    { id: 'm1', label: 'Vesieristyksen kunto (seinät ja lattia)', required: true },
    { id: 'm2', label: 'Lattiakaivon kunto ja toimivuus', required: true },
    { id: 'm3', label: 'Seinä- ja lattiamateriaalien kunto', required: true },
    { id: 'm4', label: 'Kalusteiden ja hanojen tiiviys', required: true },
    { id: 'm5', label: 'Pintakosteuden mittaus', required: true },
    { id: 'm6', label: 'Saunan rakenteet (lauteet, kiuas, tuuletus)', required: true },
    { id: 'm7', label: 'Kynnysrakenteiden kunto', required: true },
  ],
  'keittiö': [
    { id: 'k1', label: 'Altaan ja hanan tiiviys', required: true },
    { id: 'k2', label: 'Tiskikoneen liitäntä ja suojaus', required: true },
    { id: 'k3', label: 'Liesituulettimen toiminta', required: true },
    { id: 'k4', label: 'Kalusteiden kunto', required: false },
    { id: 'k5', label: 'Kodinkoneiden liitännät', required: false },
  ],
  muut_sisatilat: [
    { id: 's1', label: 'Pintamateriaalien kunto (lattiat, seinät, katot)', required: true },
    { id: 's2', label: 'Mahdolliset kosteusmerkit', required: true },
    { id: 's3', label: 'Sisäilman laatu (hajut, tunkkaisuus)', required: true },
    { id: 's4', label: 'Ovien ja ikkunoiden toimivuus', required: true },
    { id: 's5', label: 'Portaiden ja kaiteiden turvallisuus', required: false },
  ],
  lammitys: [
    { id: 'l1', label: 'Lämmityslaitteiston kunto ja toiminta', required: true },
    { id: 'l2', label: 'Pattereiden/lattialämmityksen toimivuus', required: true },
    { id: 'l3', label: 'Tulisijojen ja hormien kunto', required: true },
    { id: 'l4', label: 'Savuhormien tiiviys ja nuohous', required: true },
    { id: 'l5', label: 'Varaajan/lämminvesivaraajan kunto', required: false },
  ],
  vesi_viemari: [
    { id: 'v1', label: 'Käyttövesiputkien kunto ja materiaali', required: true },
    { id: 'v2', label: 'Viemäriputkien kunto ja materiaali', required: true },
    { id: 'v3', label: 'Vesikalusteiden kunto', required: true },
    { id: 'v4', label: 'Putkien ikä suhteessa käyttöikään', required: true },
    { id: 'v5', label: 'Vuotomerkit putkien ympäristössä', required: true },
  ],
  sahko: [
    { id: 'x1', label: 'Sähkökeskuksen kunto ja merkinnät', required: true },
    { id: 'x2', label: 'Vikavirtasuojien toiminta', required: true },
    { id: 'x3', label: 'Maadoituksen olemassaolo', required: true },
    { id: 'x4', label: 'Pistorasioiden ja kytkimien kunto', required: false },
    { id: 'x5', label: 'Sähköasennusten ikä', required: true },
  ],
  ilmanvaihto: [
    { id: 'iv1', label: 'IV-koneen toiminta ja puhtaus', required: true },
    { id: 'iv2', label: 'Venttiilien toimivuus ja säätö', required: true },
    { id: 'iv3', label: 'Suodattimien kunto', required: true },
    { id: 'iv4', label: 'Kanavien puhtaus', required: false },
    { id: 'iv5', label: 'Korvausilman saanti', required: true },
  ],
  turvallisuus: [
    { id: 't1', label: 'Palovaroittimien toiminta ja sijoittelu', required: true },
    { id: 't2', label: 'Sammuttimen olemassaolo ja tarkastus', required: true },
    { id: 't3', label: 'Asbestiriskikartoitus (rakennusvuosi)', required: true },
    { id: 't4', label: 'Radonriski (alue ja rakenne)', required: true },
    { id: 't5', label: 'Poistumistiet ja turvallisuus', required: true },
  ],
};
