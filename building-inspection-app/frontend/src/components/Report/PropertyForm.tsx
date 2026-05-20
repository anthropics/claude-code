import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PropertyInfo, RepairHistoryItem } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface PropertyFormProps {
  propertyInfo: PropertyInfo;
  onChange: (field: string, value: unknown) => void;
}

interface FieldConfig {
  field: keyof PropertyInfo;
  label: string;
  placeholder?: string;
  type?: string;
  options?: string[];
  span?: boolean;
}

const buildingTypes = [
  'Omakotitalo', 'Paritalo', 'Rivitalo', 'Kerrostalo',
  'Vapaa-ajan asunto', 'Toimistotila', 'Liiketila', 'Teollisuushalli', 'Muu',
];

const energyClasses = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'Ei tiedossa'];

const heatingSystems = [
  'Kaukolämpö', 'Maalämpö', 'Ilma-vesilämpöpumppu', 'Öljylämmitys',
  'Sähkölämmitys', 'Pelletti/puu', 'Ilmalämpöpumppu', 'Muu',
];

const heatingDistributions = [
  '', 'Vesikiertoinen patterijärjestelmä', 'Vesikiertoinen lattialämmitys',
  'Sähköinen lattialämmitys', 'Ilmalämmitys', 'Suorasähkölämmitys (sähköpatterit)', 'Yhdistelmä',
];

const foundationTypes = [
  '', 'Maanvarainen laatta', 'Valesokkeli', 'Rossipohja (ryömintätila)',
  'Paalutettu', 'Kellarillinen', 'Reunavahvistettu laatta', 'Muu',
];

const wallTypes = [
  '', 'Puurunko + mineraalivilla', 'Puurunko + polyuretaani',
  'Tiilimuuraus', 'Kevytbetoniharkko (esim. Siporex)', 'Hirsirunko',
  'Betonielementti', 'Sandwich-elementti', 'Muu',
];

const roofTypes = [
  '', 'Harjakatto + tiilikate', 'Harjakatto + profiilipeltikate',
  'Harjakatto + bitumihuopa', 'Harjakatto + betonikate',
  'Tasakatto + bitumikermi', 'Tasakatto + TPO-kalvo',
  'Pulpettikatto', 'Mansardikatto', 'Muu',
];

const ventilationTypes = [
  '', 'Painovoimainen', 'Koneellinen poistoilma',
  'Koneellinen tulo- ja poistoilma', 'Koneellinen tulo- ja poistoilma + LTO',
];

const drainagePipeTypes = [
  '', 'Valurauta', 'Muovi PVC', 'Muovi PP', 'Muovi PE', 'Ei tiedossa',
];

const waterPipeTypes = [
  '', 'Kupari', 'Muovi (PEX)', 'Muovi (PPR)', 'Galvanoitu teräs',
  'Komposiitti (kupari-muovi)', 'Ei tiedossa',
];

const inspectorQualifications = [
  '', 'PKA (Pätevä kuntotarkastaja)', 'AKK (Asuntokauppaan perehtynyt kuntoarvioija)',
  'Rakennusterveysasiantuntija (RTA)', 'Homekoiraohjaaja', 'Rakennusinsinööri (RI)',
  'Rakennusmestari (RM)', 'Muu',
];

export const PropertyForm: React.FC<PropertyFormProps> = ({ propertyInfo, onChange }) => {
  const [newRepairYear, setNewRepairYear] = useState('');
  const [newRepairDesc, setNewRepairDesc] = useState('');

  const Field: React.FC<FieldConfig> = ({ field, label, placeholder, type = 'text', options, span }) => (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {options ? (
        <select
          value={propertyInfo[field] as string}
          onChange={e => onChange(field, e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt || '– Valitse –'}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={propertyInfo[field] as string}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
        />
      ) : (
        <input
          type={type}
          value={propertyInfo[field] as string}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  );

  const SectionHeader: React.FC<{ num: number; title: string }> = ({ num, title }) => (
    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
      <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
        {num}
      </span>
      {title}
    </h3>
  );

  const addRepairItem = () => {
    const desc = newRepairDesc.trim();
    if (!desc) return;
    const updated: RepairHistoryItem[] = [
      ...(propertyInfo.repairHistory || []),
      { id: uuidv4(), year: newRepairYear, description: desc },
    ];
    onChange('repairHistory', updated);
    setNewRepairYear('');
    setNewRepairDesc('');
  };

  const removeRepairItem = (id: string) => {
    onChange('repairHistory', (propertyInfo.repairHistory || []).filter(r => r.id !== id));
  };

  return (
    <div className="space-y-8">

      {/* 1. Kohteen tiedot */}
      <section>
        <SectionHeader num={1} title="Kohteen tiedot" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="address" label="Osoite" placeholder="Kadunnimi 1" span />
          <Field field="postalCode" label="Postinumero" placeholder="00100" />
          <Field field="city" label="Kaupunki" placeholder="Helsinki" />
          <Field field="propertyId" label="Kiinteistötunnus" placeholder="091-001-0001-0001" />
          <Field field="buildYear" label="Rakennusvuosi" placeholder="1985" type="number" />
          <Field field="buildingType" label="Rakennustyyppi" options={buildingTypes} />
          <Field field="floorArea" label="Kerrosala (m²)" placeholder="120" type="number" />
          <Field field="floors" label="Kerroksia" placeholder="2" type="number" />
          <Field field="energyClass" label="Energialuokka" options={energyClasses} />
        </div>
      </section>

      {/* 2. Osapuolet */}
      <section>
        <SectionHeader num={2} title="Osapuolet" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="owner" label="Omistaja" placeholder="Etu Sukunimi" />
          <Field field="ownerPhone" label="Omistajan puhelin" placeholder="+358 40 000 0000" type="tel" />
          <Field field="realEstateAgent" label="Kiinteistönvälittäjä" placeholder="Välittäjä Oy / Etu Sukunimi" />
          <Field field="clientName" label="Tilaaja" placeholder="Etu Sukunimi" />
          <Field field="clientPhone" label="Tilaajan puhelin" placeholder="+358 40 000 0000" type="tel" />
          <Field field="clientEmail" label="Tilaajan sähköposti" placeholder="tilaus@example.com" type="email" />
          <Field field="inspector" label="Tarkastaja" placeholder="Etu Sukunimi" />
          <Field field="inspectorTitle" label="Titteli" placeholder="Rakennusterveysasiantuntija" />
          <Field field="inspectorQualification" label="Pätevyys" options={inspectorQualifications} />
        </div>
      </section>

      {/* 3. Tarkastusolosuhteet */}
      <section>
        <SectionHeader num={3} title="Tarkastusolosuhteet" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="inspectionDate" label="Tarkastuspäivä" type="date" />
          <Field field="weatherConditions" label="Sääolosuhteet" placeholder="Pilvinen, tuulinen" />
          <Field field="outdoorTemp" label="Ulkolämpötila (°C)" placeholder="+5" />
          <Field field="outdoorHumidity" label="Ulkoilman kosteus (%)" placeholder="75" type="number" />
          <Field field="indoorTemp" label="Sisälämpötila (°C)" placeholder="+21" />
          <Field field="indoorHumidity" label="Sisäilman kosteus (%)" placeholder="45" type="number" />
        </div>
      </section>

      {/* 4. Käytetyt laitteet */}
      <section>
        <SectionHeader num={4} title="Käytetyt laitteet ja menetelmät" />
        <div className="grid grid-cols-1 gap-3">
          <Field
            field="devicesUsed"
            label="Laitteet (malli ja kalibrointitiedot)"
            placeholder="Pintakosteudentunnistin: Gann Hydromette RTU 600, kalibroitu 2024-01. Lämpö-/kosteusmittari: Trotec BL30, kalibroitu 2024-01."
            type="textarea"
            span
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          Kalibrointitodistukset tulee olla saatavilla. Tarkastus on aistinvarainen – pintapuolinen tarkastus ei paljasta rakenteen sisäisiä vaurioita.
        </p>
      </section>

      {/* 5. Rakennetyypit */}
      <section>
        <SectionHeader num={5} title="Rakennetyypit" />
        <p className="text-xs text-gray-500 mb-3">
          Rakennetyyppien perusteella tunnistetaan automaattisesti kohteen tunnetut riskirakenteet.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="foundationType" label="Perustusratkaisu" options={foundationTypes} />
          <Field field="wallType" label="Ulkoseinärakenne" options={wallTypes} />
          <Field field="roofType" label="Vesikattotyyppi" options={roofTypes} />
          <Field field="heatingSystem" label="Lämmitysjärjestelmä" options={heatingSystems} />
          <Field field="heatingDistribution" label="Lämmönjako" options={heatingDistributions} />
          <Field field="ventilationType" label="Ilmanvaihtotyyppi" options={ventilationTypes} />
          <Field field="drainagePipeType" label="Viemäriputkimateriaali" options={drainagePipeTypes} />
          <Field field="waterPipeType" label="Käyttövesiputkimateriaali" options={waterPipeTypes} />
        </div>
      </section>

      {/* 6. Dokumentit ja korjaushistoria */}
      <section>
        <SectionHeader num={6} title="Dokumentit ja korjaushistoria" />
        <div className="space-y-4">
          <Field
            field="availableDocuments"
            label="Käytettävissä olevat asiakirjat"
            placeholder="Esim. rakennuslupa-asiakirjat, aiempi kuntoarvio 2015, sähköpiirustukset, LVI-suunnitelmat..."
            type="textarea"
            span
          />

          <Field
            field="ownerDefects"
            label="Omistajan ilmoittamat virheet ja puutteet"
            placeholder="Kirjaa omistajan ennakkoon ilmoittamat havainnot, kuten 'kylpyhuoneessa ajoittain haju', 'kellarikerros kastuu rankkasateella'..."
            type="textarea"
            span
          />

          {/* Korjaushistoria */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Tehdyt korjaukset ja huollot</label>
            <div className="space-y-2 mb-3">
              {(propertyInfo.repairHistory || []).map(item => (
                <div key={item.id} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                    {item.year || '?'}
                  </span>
                  <span className="text-sm text-gray-700 flex-1">{item.description}</span>
                  <button
                    onClick={() => removeRepairItem(item.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {(propertyInfo.repairHistory || []).length === 0 && (
                <p className="text-xs text-gray-400 italic">Ei kirjattuja korjauksia</p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={newRepairYear}
                onChange={e => setNewRepairYear(e.target.value)}
                placeholder="Vuosi"
                className="w-20 text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newRepairDesc}
                onChange={e => setNewRepairDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRepairItem()}
                placeholder="Kuvaus (esim. Katto uusittu, profiilipeltikate)"
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addRepairItem}
                disabled={!newRepairDesc.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={14} />
                Lisää
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Tarkastuksen rajaukset */}
      <section>
        <SectionHeader num={7} title="Tarkastuksen rajaukset" />
        <Field
          field="accessLimitations"
          label="Tilat tai rakenteet joihin ei ollut pääsyä"
          placeholder="Esim. 'Ullakkotila lumen vuoksi saavuttamaton', 'Sähkökeskushuoneen lukko – ei pääsyä', 'Vinttikellaria ei voitu tarkastaa'..."
          type="textarea"
          span
        />
        <p className="mt-1.5 text-xs text-gray-400">
          Rajaukset kirjataan raporttiin. Tarkastamatta jääneet tilat eivät kuulu tarkastuksen piiriin.
        </p>

        <div className="mt-3">
          <Field
            field="additionalInfo"
            label="Muut huomiot"
            placeholder="Muuta huomionarvoista tarkastuksen suorittamisen kannalta..."
            type="textarea"
            span
          />
        </div>
      </section>

    </div>
  );
};
