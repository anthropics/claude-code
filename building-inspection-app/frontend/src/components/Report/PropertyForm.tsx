import React from 'react';
import { PropertyInfo } from '../../types';

interface PropertyFormProps {
  propertyInfo: PropertyInfo;
  onChange: (field: string, value: string) => void;
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

const heatingSystems = [
  'Kaukolämpö', 'Maalämpö', 'Ilma-vesilämpöpumppu', 'Öljylämmitys',
  'Sähkölämmitys', 'Pelletti/puu', 'Ilmalämpöpumppu', 'Muu',
];

export const PropertyForm: React.FC<PropertyFormProps> = ({ propertyInfo, onChange }) => {
  const Field: React.FC<FieldConfig> = ({ field, label, placeholder, type = 'text', options, span }) => (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {options ? (
        <select
          value={propertyInfo[field]}
          onChange={e => onChange(field, e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={propertyInfo[field]}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
        />
      ) : (
        <input
          type={type}
          value={propertyInfo[field]}
          onChange={e => onChange(field, e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Property identification */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">1</span>
          Kohdetiedot
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="address" label="Osoite" placeholder="Kadunnimi 1" span />
          <Field field="postalCode" label="Postinumero" placeholder="00100" />
          <Field field="city" label="Kaupunki" placeholder="Helsinki" />
          <Field field="propertyId" label="Kiinteistötunnus" placeholder="091-001-0001-0001" />
          <Field field="buildYear" label="Rakennusvuosi" placeholder="1985" type="number" />
          <Field field="buildingType" label="Rakennustyyppi" options={buildingTypes} />
          <Field field="floorArea" label="Kerrosala (m²)" placeholder="120" type="number" />
          <Field field="floors" label="Kerroksia" placeholder="2" type="number" />
          <Field field="heatingSystem" label="Lämmitysjärjestelmä" options={heatingSystems} />
        </div>
      </section>

      {/* Inspection info */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">2</span>
          Tarkastustiedot
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="inspector" label="Tarkastaja" placeholder="Etu Sukunimi" />
          <Field field="inspectorTitle" label="Titteli" placeholder="Rakennusterveysasiantuntija" />
          <Field field="inspectionDate" label="Tarkastuspäivä" type="date" />
          <Field field="weatherConditions" label="Sääolosuhteet" placeholder="Pilvinen, tuulinen" />
          <Field field="outdoorTemp" label="Ulkolämpötila (°C)" placeholder="+5" />
          <Field field="indoorTemp" label="Sisälämpötila (°C)" placeholder="+21" />
        </div>
      </section>

      {/* Client info */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">3</span>
          Tilaajan tiedot
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="clientName" label="Tilaajan nimi" placeholder="Etu Sukunimi" span />
          <Field field="clientPhone" label="Puhelinnumero" placeholder="+358 40 000 0000" type="tel" />
          <Field field="clientEmail" label="Sähköposti" placeholder="tilaus@example.com" type="email" />
          <Field field="additionalInfo" label="Lisätiedot" placeholder="Muuta huomionarvoista..." type="textarea" span />
        </div>
      </section>
    </div>
  );
};
