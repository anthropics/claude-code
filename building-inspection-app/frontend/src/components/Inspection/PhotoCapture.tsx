import React, { useRef, useState } from 'react';
import { Camera, Upload, X, Sparkles, Edit2, Check, AlertTriangle, Eye } from 'lucide-react';
import { Photo } from '../../types';
import { analyzePhotoDefects, generatePhotoCaption, BuildingContext } from '../../services/api';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../UI/Button';

interface PhotoCaptureProps {
  categoryName: string;
  buildingContext?: BuildingContext;
  photos: Photo[];
  onPhotoAdded: (photo: Photo) => void;
  onPhotoUpdated: (photoId: string, changes: Partial<Photo>) => void;
  onPhotoDeleted: (photoId: string) => void;
  onSuggestedObservation?: ((text: string) => void) | undefined;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  categoryName,
  buildingContext,
  photos,
  onPhotoAdded,
  onPhotoUpdated,
  onPhotoDeleted,
  onSuggestedObservation,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [editCaptionText, setEditCaptionText] = useState('');
  const [defectAlerts, setDefectAlerts] = useState<Record<string, Array<{ description: string; severity: string }>>>({});

  const processImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    // Compress image if needed (max 1200px wide)
    const compressedBase64 = await compressImage(file, 1200, 0.85);
    const mediaType = file.type;

    // Extract EXIF GPS data before compression
    const exifData = await extractExifGps(file);

    const photo: Photo = {
      id: uuidv4(),
      dataUrl: compressedBase64,
      mediaType,
      caption: '',
      captionLoading: true,
      timestamp: new Date().toISOString(),
      ...(exifData.latitude != null && {
        gpsLatitude: exifData.latitude,
        gpsLongitude: exifData.longitude,
      }),
      ...(exifData.dateTimeOriginal && {
        originalExif: {
          dateTimeOriginal: exifData.dateTimeOriginal,
          ...(exifData.latitude != null && {
            gps: { latitude: exifData.latitude!, longitude: exifData.longitude! },
          }),
        },
      }),
    };

    // Also try browser geolocation if no EXIF GPS
    if (photo.gpsLatitude == null && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        photo.gpsLatitude = pos.coords.latitude;
        photo.gpsLongitude = pos.coords.longitude;
        photo.gpsAccuracy = pos.coords.accuracy;
      } catch {
        // GPS not available, skip
      }
    }

    onPhotoAdded(photo);

    // Use enhanced AI photo analysis with defect detection
    try {
      const base64Data = compressedBase64.split(',')[1];

      // Try enhanced analysis first, fall back to simple caption
      try {
        const analysis = await analyzePhotoDefects(base64Data, mediaType, categoryName, buildingContext);
        onPhotoUpdated(photo.id, { caption: analysis.caption, captionLoading: false });

        // Show defect alerts if found
        if (analysis.defectsFound && analysis.defects.length > 0) {
          setDefectAlerts(prev => ({ ...prev, [photo.id]: analysis.defects }));
        }

        // Auto-suggest observation from detected defects
        if (analysis.suggestedObservation && onSuggestedObservation) {
          onSuggestedObservation(analysis.suggestedObservation);
        }
      } catch {
        // Fallback to simple caption
        const caption = await generatePhotoCaption(base64Data, mediaType, categoryName);
        onPhotoUpdated(photo.id, { caption, captionLoading: false });
      }
    } catch {
      onPhotoUpdated(photo.id, {
        caption: `Kuva kohteesta: ${categoryName}`,
        captionLoading: false,
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      await processImage(file);
    }
    e.target.value = '';
  };

  const startEditCaption = (photo: Photo) => {
    setEditingCaption(photo.id);
    setEditCaptionText(photo.caption);
  };

  const saveEditCaption = (photoId: string) => {
    onPhotoUpdated(photoId, { caption: editCaptionText });
    setEditingCaption(null);
  };

  const dismissDefects = (photoId: string) => {
    setDefectAlerts(prev => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Upload buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          icon={<Camera size={15} />}
          onClick={() => cameraInputRef.current?.click()}
        >
          Ota kuva
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload size={15} />}
          onClick={() => fileInputRef.current?.click()}
        >
          Lisää kuva
        </Button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
              {/* Image */}
              <div className="aspect-video relative">
                <img
                  src={photo.dataUrl}
                  alt={photo.caption || 'Tarkastuskuva'}
                  className="w-full h-full object-cover"
                />

                {/* Delete button */}
                <button
                  onClick={() => onPhotoDeleted(photo.id)}
                  className="absolute top-1.5 right-1.5 bg-red-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  aria-label="Poista kuva"
                >
                  <X size={12} />
                </button>

                {/* Defect indicator */}
                {defectAlerts[photo.id] && defectAlerts[photo.id].length > 0 && (
                  <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white p-1 rounded-md">
                    <AlertTriangle size={12} />
                  </div>
                )}
              </div>

              {/* Caption */}
              <div className="p-2">
                {photo.captionLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600">
                    <Sparkles size={11} className="animate-pulse" />
                    <span className="ai-shimmer bg-clip-text">AI analysoi kuvaa...</span>
                  </div>
                ) : editingCaption === photo.id ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editCaptionText}
                      onChange={e => setEditCaptionText(e.target.value)}
                      className="w-full text-xs border border-gray-300 rounded p-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => saveEditCaption(photo.id)}
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                      >
                        <Check size={11} /> Tallenna
                      </button>
                      <button
                        onClick={() => setEditingCaption(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 ml-2"
                      >
                        Peruuta
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs text-gray-600 leading-relaxed flex-1">{photo.caption}</p>
                    <button
                      onClick={() => startEditCaption(photo)}
                      className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5"
                      title="Muokkaa kuvatekstiä"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                )}

                {/* Defect alerts */}
                {defectAlerts[photo.id] && defectAlerts[photo.id].length > 0 && (
                  <div className="mt-2 space-y-1">
                    {defectAlerts[photo.id].map((defect, i) => (
                      <div key={i} className={`flex items-start gap-1.5 text-xs p-1.5 rounded ${
                        defect.severity === 'high' ? 'bg-red-50 text-red-700' :
                        defect.severity === 'medium' ? 'bg-amber-50 text-amber-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        <Eye size={10} className="flex-shrink-0 mt-0.5" />
                        <span>{defect.description}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => dismissDefects(photo.id)}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      Kuittaa
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Extract GPS coordinates and date from JPEG EXIF data
async function extractExifGps(file: File): Promise<{
  latitude?: number;
  longitude?: number;
  dateTimeOriginal?: string;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // Check for JPEG SOI marker
    if (view.getUint16(0) !== 0xFFD8) return {};

    let offset = 2;
    while (offset < view.byteLength - 1) {
      const marker = view.getUint16(offset);
      if (marker === 0xFFE1) {
        // APP1 (EXIF)
        const length = view.getUint16(offset + 2);
        const exifData = buffer.slice(offset + 4, offset + 2 + length);
        return parseExifSegment(exifData);
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      offset += 2 + view.getUint16(offset + 2);
    }
  } catch {
    // EXIF parsing failed silently
  }
  return {};
}

function parseExifSegment(data: ArrayBuffer): {
  latitude?: number;
  longitude?: number;
  dateTimeOriginal?: string;
} {
  const view = new DataView(data);
  // Check for 'Exif\0\0'
  if (view.getUint32(0) !== 0x45786966 || view.getUint16(4) !== 0x0000) return {};

  const tiffOffset = 6;
  const littleEndian = view.getUint16(tiffOffset) === 0x4949;
  const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);

  let dateTimeOriginal: string | undefined;
  let gpsIfdOffset: number | undefined;

  // Read IFD0
  const ifd0Count = view.getUint16(tiffOffset + ifdOffset, littleEndian);
  for (let i = 0; i < ifd0Count; i++) {
    const entryOffset = tiffOffset + ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > data.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x8825) {
      // GPSInfo IFD pointer
      gpsIfdOffset = view.getUint32(entryOffset + 8, littleEndian);
    }
    if (tag === 0x8769) {
      // ExifIFD pointer - look for DateTimeOriginal
      const exifIfd = view.getUint32(entryOffset + 8, littleEndian);
      const exifCount = view.getUint16(tiffOffset + exifIfd, littleEndian);
      for (let j = 0; j < exifCount; j++) {
        const eOffset = tiffOffset + exifIfd + 2 + j * 12;
        if (eOffset + 12 > data.byteLength) break;
        const eTag = view.getUint16(eOffset, littleEndian);
        if (eTag === 0x9003) {
          // DateTimeOriginal
          const strOffset = view.getUint32(eOffset + 8, littleEndian);
          const bytes = new Uint8Array(data, tiffOffset + strOffset, 19);
          dateTimeOriginal = String.fromCharCode(...bytes);
        }
      }
    }
  }

  let latitude: number | undefined;
  let longitude: number | undefined;

  if (gpsIfdOffset != null) {
    const gpsCount = view.getUint16(tiffOffset + gpsIfdOffset, littleEndian);
    let latRef = 'N', lonRef = 'E';
    let latVals: number[] | undefined, lonVals: number[] | undefined;

    for (let i = 0; i < gpsCount; i++) {
      const gOffset = tiffOffset + gpsIfdOffset + 2 + i * 12;
      if (gOffset + 12 > data.byteLength) break;
      const gTag = view.getUint16(gOffset, littleEndian);
      const valOffset = view.getUint32(gOffset + 8, littleEndian);

      if (gTag === 1) latRef = String.fromCharCode(view.getUint8(gOffset + 8));
      if (gTag === 3) lonRef = String.fromCharCode(view.getUint8(gOffset + 8));
      if (gTag === 2 || gTag === 4) {
        const rOffset = tiffOffset + valOffset;
        if (rOffset + 24 <= data.byteLength) {
          const d = view.getUint32(rOffset, littleEndian) / view.getUint32(rOffset + 4, littleEndian);
          const m = view.getUint32(rOffset + 8, littleEndian) / view.getUint32(rOffset + 12, littleEndian);
          const s = view.getUint32(rOffset + 16, littleEndian) / view.getUint32(rOffset + 20, littleEndian);
          const dec = d + m / 60 + s / 3600;
          if (gTag === 2) latVals = [dec];
          if (gTag === 4) lonVals = [dec];
        }
      }
    }

    if (latVals && lonVals) {
      latitude = latRef === 'S' ? -latVals[0] : latVals[0];
      longitude = lonRef === 'W' ? -lonVals[0] : lonVals[0];
    }
  }

  return { latitude, longitude, dateTimeOriginal };
}

// Compress image to specified max width and quality
async function compressImage(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(outputType, quality));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}
