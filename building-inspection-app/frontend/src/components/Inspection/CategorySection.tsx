import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { InspectionCategory, Observation, Photo } from '../../types';
import { ObservationCard } from './ObservationCard';
import { VoiceRecorder } from './VoiceRecorder';
import { Button } from '../UI/Button';
import * as Icons from 'lucide-react';

interface CategorySectionProps {
  category: InspectionCategory;
  onAddObservation: (rawText: string) => void;
  onUpdateObservation: (obsId: string, changes: Partial<Observation>) => void;
  onDeleteObservation: (obsId: string) => void;
  onAddPhoto: (obsId: string, photo: Photo) => void;
  onUpdatePhoto: (obsId: string, photoId: string, changes: Partial<Photo>) => void;
  onDeletePhoto: (obsId: string, photoId: string) => void;
  onUpdateNotes: (notes: string) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  onAddObservation,
  onUpdateObservation,
  onDeleteObservation,
  onAddPhoto,
  onUpdatePhoto,
  onDeletePhoto,
  onUpdateNotes,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [quickText, setQuickText] = useState('');

  // Get icon component dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = ((Icons as unknown) as Record<string, React.ComponentType<{size?: number; className?: string}>>)[category.icon] || Icons.FileText;

  const obsCount = category.observations.length;
  const hasContent = obsCount > 0 || category.notes;

  const handleAddText = () => {
    const text = quickText.trim();
    if (text) {
      onAddObservation(text);
      setQuickText('');
    }
  };

  const handleVoiceTranscript = (text: string) => {
    onAddObservation(text);
    setShowVoice(false);
  };

  return (
    <div className={`border rounded-xl transition-all ${hasContent ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
      {/* Category header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/60 transition-colors rounded-xl"
      >
        <div className={`p-2 rounded-lg ${hasContent ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          <IconComponent size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">{category.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {obsCount > 0 && (
            <span className="bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {obsCount}
            </span>
          )}
          {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Add observation controls */}
          <div className="space-y-3">
            {/* Text input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={quickText}
                onChange={e => setQuickText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddText()}
                placeholder="Havainto..."
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={15} />}
                onClick={handleAddText}
                disabled={!quickText.trim()}
              >
                Lisää
              </Button>
            </div>

            {/* Voice toggle */}
            <div>
              <button
                onClick={() => setShowVoice(!showVoice)}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <MessageSquare size={13} />
                {showVoice ? 'Sulje sanelu' : 'Sanelu'}
              </button>

              {showVoice && (
                <div className="mt-3 bg-white rounded-lg border border-gray-200 p-3">
                  <VoiceRecorder onTranscript={handleVoiceTranscript} />
                </div>
              )}
            </div>
          </div>

          {/* Observations */}
          {category.observations.length > 0 && (
            <div className="space-y-3">
              {category.observations.map(obs => (
                <ObservationCard
                  key={obs.id}
                  observation={obs}
                  categoryId={category.id}
                  categoryName={category.name}
                  onUpdate={(changes) => onUpdateObservation(obs.id, changes)}
                  onDelete={() => onDeleteObservation(obs.id)}
                  onPhotoAdded={(photo) => onAddPhoto(obs.id, photo)}
                  onPhotoUpdated={(photoId, changes) => onUpdatePhoto(obs.id, photoId, changes)}
                  onPhotoDeleted={(photoId) => onDeletePhoto(obs.id, photoId)}
                />
              ))}
            </div>
          )}

          {/* Category notes */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Muistiinpanot
            </label>
            <textarea
              value={category.notes}
              onChange={e => onUpdateNotes(e.target.value)}
              placeholder="Lisätiedot, mittaustulokset, viittaukset..."
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
};
