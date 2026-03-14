import React, { useState } from 'react';
import {
  Plus, ChevronDown, ChevronRight, MessageSquare, ListChecks,
  Sparkles, CheckSquare, Square
} from 'lucide-react';
import { InspectionCategory, Observation, Photo, ChecklistItem } from '../../types';
import { ObservationCard } from './ObservationCard';
import { VoiceRecorder } from './VoiceRecorder';
import { Button } from '../UI/Button';
import { AIProcessingBadge } from '../UI/Spinner';
import { generateCategoryChecklist, BuildingContext } from '../../services/api';
import * as Icons from 'lucide-react';

interface CategorySectionProps {
  category: InspectionCategory;
  buildingContext?: BuildingContext;
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
  buildingContext,
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
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  // Get icon component dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = ((Icons as unknown) as Record<string, React.ComponentType<{size?: number; className?: string}>>)[category.icon] || Icons.FileText;

  const obsCount = category.observations.length;
  const processingCount = category.observations.filter(o => o.aiProcessing).length;
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

  // Generate AI checklist for this category
  const handleGenerateChecklist = async () => {
    setLoadingChecklist(true);
    try {
      const result = await generateCategoryChecklist(
        category.name,
        category.description,
        buildingContext
      );
      setChecklist(result.checklist.map(item => ({ ...item, checked: false })));
      setShowChecklist(true);
    } catch (err) {
      console.error('Checklist generation failed:', err);
    } finally {
      setLoadingChecklist(false);
    }
  };

  // Toggle checklist item and optionally add as observation
  const handleChecklistItemToggle = (index: number) => {
    setChecklist(prev => prev.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    ));
  };

  // Add a checklist item as an observation
  const handleChecklistToObservation = (item: ChecklistItem) => {
    onAddObservation(item.item + (item.hint ? ` – ${item.hint}` : ''));
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
          {processingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              <Sparkles size={11} className="animate-pulse" />
              {processingCount}
            </span>
          )}
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
                placeholder="Havainto... (AI muotoilee ja lisää viitteet automaattisesti)"
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

            {/* Action buttons row */}
            <div className="flex flex-wrap gap-2">
              {/* Voice toggle */}
              <button
                onClick={() => setShowVoice(!showVoice)}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
              >
                <MessageSquare size={13} />
                {showVoice ? 'Sulje sanelu' : 'Sanelu'}
              </button>

              {/* AI Checklist button */}
              <button
                onClick={showChecklist ? () => setShowChecklist(false) : handleGenerateChecklist}
                disabled={loadingChecklist}
                className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded-md hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                <ListChecks size={13} />
                {loadingChecklist ? 'Luodaan...' : showChecklist ? 'Piilota tarkastuslista' : 'AI-tarkastuslista'}
              </button>
            </div>

            {/* Voice recorder */}
            {showVoice && (
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <VoiceRecorder onTranscript={handleVoiceTranscript} />
              </div>
            )}

            {/* AI-Generated Checklist */}
            {showChecklist && checklist.length > 0 && (
              <div className="bg-purple-50 rounded-lg border border-purple-200 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks size={14} className="text-purple-600" />
                  <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
                    AI-tarkastuslista
                  </span>
                  <span className="text-xs text-purple-500 ml-auto">
                    {checklist.filter(i => i.checked).length}/{checklist.length} tarkastettu
                  </span>
                </div>
                <div className="space-y-1.5">
                  {checklist.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2 rounded-md transition-colors ${
                        item.checked ? 'bg-purple-100/50' : 'bg-white hover:bg-white'
                      }`}
                    >
                      <button
                        onClick={() => handleChecklistItemToggle(i)}
                        className="flex-shrink-0 mt-0.5 text-purple-600 hover:text-purple-800"
                      >
                        {item.checked
                          ? <CheckSquare size={14} />
                          : <Square size={14} />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${item.checked ? 'text-purple-400 line-through' : 'text-gray-800'}`}>
                          {item.item}
                        </p>
                        {item.hint && (
                          <p className="text-xs text-gray-500 mt-0.5">{item.hint}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          item.priority === 'high' ? 'bg-red-100 text-red-700' :
                          item.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.priority === 'high' ? 'Tärkeä' : item.priority === 'medium' ? 'Normaali' : 'Lisä'}
                        </span>
                        <button
                          onClick={() => handleChecklistToObservation(item)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50"
                          title="Lisää havaintona"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingChecklist && (
              <div className="py-2">
                <AIProcessingBadge text="Luodaan tarkastuslistaa..." />
              </div>
            )}
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
                  buildingContext={buildingContext}
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
