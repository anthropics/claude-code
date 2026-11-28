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

    const photo: Photo = {
      id: uuidv4(),
      dataUrl: compressedBase64,
      mediaType,
      caption: '',
      captionLoading: true,
      timestamp: new Date().toISOString(),
    };

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
