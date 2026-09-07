import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PropertyInfo } from '../types';
import { colors } from '../theme/colors';

interface PropertyFormProps {
  propertyInfo: PropertyInfo;
  onChange: (changes: Partial<PropertyInfo>) => void;
}

interface FieldConfig {
  key: keyof PropertyInfo;
  label: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
}

const sections: { title: string; fields: FieldConfig[] }[] = [
  {
    title: 'Kohteen tiedot',
    fields: [
      { key: 'address', label: 'Osoite', placeholder: 'Esimerkkikatu 1' },
      { key: 'postalCode', label: 'Postinumero', placeholder: '00100', keyboardType: 'numeric' },
      { key: 'city', label: 'Kaupunki', placeholder: 'Helsinki' },
      { key: 'propertyId', label: 'Kiinteistötunnus' },
      { key: 'buildYear', label: 'Rakennusvuosi', keyboardType: 'numeric' },
      { key: 'buildingType', label: 'Rakennustyyppi', placeholder: 'Omakotitalo' },
      { key: 'floorArea', label: 'Pinta-ala (m²)', keyboardType: 'numeric' },
      { key: 'floors', label: 'Kerrokset', keyboardType: 'numeric' },
      { key: 'energyClass', label: 'Energialuokka' },
    ],
  },
  {
    title: 'Osapuolet',
    fields: [
      { key: 'owner', label: 'Omistaja' },
      { key: 'ownerPhone', label: 'Omistajan puhelin', keyboardType: 'phone-pad' },
      { key: 'realEstateAgent', label: 'Kiinteistönvälittäjä' },
      { key: 'inspector', label: 'Tarkastaja' },
      { key: 'inspectorTitle', label: 'Nimike' },
      { key: 'inspectorQualification', label: 'Pätevyys' },
    ],
  },
  {
    title: 'Tarkastusolosuhteet',
    fields: [
      { key: 'inspectionDate', label: 'Tarkastuspäivä', placeholder: 'VVVV-KK-PP' },
      { key: 'weatherConditions', label: 'Sää' },
      { key: 'outdoorTemp', label: 'Ulkolämpötila (°C)' },
      { key: 'outdoorHumidity', label: 'Ulkoilman kosteus (%)' },
      { key: 'indoorTemp', label: 'Sisälämpötila (°C)' },
      { key: 'indoorHumidity', label: 'Sisäilman kosteus (%)' },
      { key: 'devicesUsed', label: 'Käytetyt laitteet', multiline: true },
    ],
  },
  {
    title: 'Rakennetyypit',
    fields: [
      { key: 'heatingSystem', label: 'Lämmitysjärjestelmä' },
      { key: 'heatingDistribution', label: 'Lämmönjako' },
      { key: 'foundationType', label: 'Perustyyppi' },
      { key: 'wallType', label: 'Seinätyyppi' },
      { key: 'roofType', label: 'Kattotyyppi' },
      { key: 'ventilationType', label: 'Ilmanvaihto' },
      { key: 'drainagePipeType', label: 'Viemärimateriaali' },
      { key: 'waterPipeType', label: 'Vesiputkimateriaali' },
    ],
  },
  {
    title: 'Muut tiedot',
    fields: [
      { key: 'accessLimitations', label: 'Rajaukset', multiline: true },
      { key: 'availableDocuments', label: 'Käytettävissä olevat asiakirjat', multiline: true },
      { key: 'ownerDefects', label: 'Omistajan ilmoittamat puutteet', multiline: true },
    ],
  },
  {
    title: 'Tilaajan tiedot',
    fields: [
      { key: 'clientName', label: 'Tilaajan nimi' },
      { key: 'clientPhone', label: 'Puhelin', keyboardType: 'phone-pad' },
      { key: 'clientEmail', label: 'Sähköposti', keyboardType: 'email-address' },
      { key: 'additionalInfo', label: 'Lisätiedot', multiline: true },
    ],
  },
];

export const PropertyForm: React.FC<PropertyFormProps> = ({ propertyInfo, onChange }) => {
  return (
    <View>
      <Text style={styles.pageTitle}>Kohde- ja tarkastustiedot</Text>
      <Text style={styles.pageSubtitle}>
        Täytä kaikki oleelliset tiedot ennen tarkastuksen aloittamista.
      </Text>

      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.fields.map(field => (
            <View key={field.key} style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={[styles.fieldInput, field.multiline && styles.fieldInputMultiline]}
                value={String(propertyInfo[field.key] ?? '')}
                onChangeText={text => onChange({ [field.key]: text })}
                placeholder={field.placeholder}
                placeholderTextColor={colors.gray400}
                keyboardType={field.keyboardType || 'default'}
                multiline={field.multiline}
                numberOfLines={field.multiline ? 3 : 1}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  pageTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  pageSubtitle: { fontSize: 13, color: colors.gray500, marginTop: 4, marginBottom: 16 },
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldContainer: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: colors.gray700, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.white,
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
