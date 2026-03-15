import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { v4 as uuidv4 } from 'uuid';
import { Photo } from '../types';
import { generatePhotoCaption } from '../services/api';
import { colors } from '../theme/colors';

interface PhotoCaptureButtonProps {
  categoryName: string;
  onPhotoAdded: (photo: Photo) => void;
}

export const PhotoCaptureButton: React.FC<PhotoCaptureButtonProps> = ({
  categoryName,
  onPhotoAdded,
}) => {
  const handlePickImage = () => {
    Alert.alert('Lisää kuva', 'Valitse lähde', [
      {
        text: 'Kamera',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Lupa vaaditaan', 'Salli kameran käyttö asetuksista');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
            exif: true,
          });
          if (!result.canceled && result.assets[0]) {
            await processImage(result.assets[0]);
          }
        },
      },
      {
        text: 'Galleria',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Lupa vaaditaan', 'Salli kuvagallerian käyttö asetuksista');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
            exif: true,
          });
          if (!result.canceled && result.assets[0]) {
            await processImage(result.assets[0]);
          }
        },
      },
      { text: 'Peruuta', style: 'cancel' },
    ]);
  };

  const processImage = async (asset: ImagePicker.ImagePickerAsset) => {
    const exif = asset.exif;
    const gpsLat = exif?.GPSLatitude as number | undefined;
    const gpsLon = exif?.GPSLongitude as number | undefined;

    const photo: Photo = {
      id: uuidv4(),
      uri: asset.uri,
      base64: asset.base64 || undefined,
      mediaType: 'image/jpeg',
      caption: '',
      captionLoading: true,
      timestamp: new Date().toISOString(),
      ...(gpsLat != null && { gpsLatitude: gpsLat }),
      ...(gpsLon != null && { gpsLongitude: gpsLon }),
      ...(exif && {
        originalExif: {
          make: exif.Make as string | undefined,
          model: exif.Model as string | undefined,
          dateTimeOriginal: exif.DateTimeOriginal as string | undefined,
          ...(gpsLat != null && gpsLon != null && {
            gps: { latitude: gpsLat, longitude: gpsLon },
          }),
        },
      }),
    };

    onPhotoAdded(photo);

    // Generate AI caption in background
    if (asset.base64) {
      try {
        const caption = await generatePhotoCaption(asset.base64, 'image/jpeg', categoryName);
        onPhotoAdded({ ...photo, caption, captionLoading: false });
      } catch {
        onPhotoAdded({ ...photo, captionLoading: false });
      }
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePickImage}>
      <Ionicons name="camera" size={14} color={colors.gray600} />
      <Text style={styles.buttonText}>Kuva</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.gray100,
  },
  buttonText: { fontSize: 12, color: colors.gray600, fontWeight: '500' },
});
