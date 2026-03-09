import React, { useState } from 'react';
import {
  Trash2, ChevronDown, ChevronUp, Sparkles, RefreshCw,
  AlertTriangle, Clock, Info, CheckCircle2, Eye
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Observation, UrgencyLevel } from '../../types';
import { PhotoCapture } from './PhotoCapture';
import { Button } from '../UI/Button';
import { AIProcessingBadge } from '../UI/Spinner';
import { streamProcessObservation, addTechnicalTheory } from '../../services/api';
import { Photo } from '../../types';

interface ObservationCardProps {
  observation: Observation;
  categoryId: string;
  categoryName: string;
  onUpdate: (changes: Partial<Observation>) => void;
  onDelete: () => void;
  onPhotoAdded: (photo: Photo) => void;
  onPhotoUpdated: (photoId: string, changes: Partial<Photo>) => void;
  onPhotoDeleted: (photoId: string) => void;
}

const urgencyConfig: Record<UrgencyLevel, {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
}> = {
  välitön: {
    label: 'Välitön',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    icon: <AlertTriangle size={12} />,
  },
  '1-2v': {
    label: '1–2 vuotta',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    icon: <Clock size={12} />,
  },
  '3-5v': {
    label: '3–5 vuotta',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50 border-yellow-200',
    icon: <Clock size={12} />,
  },
  seurattava: {
    label: 'Seurattava',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    icon: <Eye size={12} />,
  },
  ei_toimenpiteitä: {
    label: 'Ei toimenpiteitä',
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
    icon: <CheckCircle2 size={12} />,
  },
};

export const ObservationCard: React.FC<ObservationCardProps> = ({
  observation,
  categoryName,
  onUpdate,
  onDelete,
  onPhotoAdded,
  onPhotoUpdated,
  onPhotoDeleted,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [activeTab, setActiveTab] = useState<'processed' | 'theory'>('processed');
  const [editingRaw, setEditingRaw] = useState(false);
  const [rawText, setRawText] = useState(observation.rawText);

  const urgency = urgencyConfig[observation.urgency];

  const handleProcessWithAI = async () => {
    setProcessing(true);
    setStreamedText('');
    setExpanded(true);
    setActiveTab('theory');

    await streamProcessObservation(
      observation.rawText,
      categoryName,
      (chunk) => setStreamedText(prev => prev + chunk),
      (fullText) => {
        onUpdate({ withTheory: fullText, processedText: extractProcessedText(fullText) });
        setProcessing(false);
        setStreamedText('');
      },
      () => {
        setProcessing(false);
      }
    );
  };

  const handleAddTheory = async () => {
    if (!observation.processedText) return;
    setProcessing(true);

    try {
      const withTheory = await addTechnicalTheory(observation.processedText, categoryName);
      onUpdate({ withTheory });
      setActiveTab('theory');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveRaw = () => {
    onUpdate({ rawText });
    setEditingRaw(false);
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Urgency selector */}
        <div className="flex-shrink-0 pt-0.5">
          <select
            value={observation.urgency}
            onChange={e => onUpdate({ urgency: e.target.value as UrgencyLevel })}
            className={`text-xs font-medium px-2 py-1 rounded-md border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 ${urgency.bg} ${urgency.color}`}
            title="Kiireellisyys"
          >
            {Object.entries(urgencyConfig).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Raw text */}
        <div className="flex-1 min-w-0">
          {editingRaw ? (
            <div className="space-y-2">
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="xs" variant="primary" onClick={handleSaveRaw}>Tallenna</Button>
                <Button size="xs" variant="ghost" onClick={() => { setEditingRaw(false); setRawText(observation.rawText); }}>Peruuta</Button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-gray-700 leading-relaxed cursor-text hover:bg-gray-50 rounded p-1 -m-1 transition-colors"
              onClick={() => setEditingRaw(true)}
              title="Klikkaa muokataksesi"
            >
              {observation.rawText || <span className="text-gray-400 italic">Tyhjä havainto</span>}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={expanded ? 'Pienennä' : 'Laajenna'}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Poista havainto"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* AI badge */}
      {processing && (
        <div className="px-4 pb-3">
          <AIProcessingBadge text="Muotoillaan..." />
        </div>
      )}

      {/* AI action buttons */}
      {!processing && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          <Button
            size="xs"
            variant="primary"
            icon={<Sparkles size={12} />}
            onClick={handleProcessWithAI}
            loading={processing}
          >
            Muotoile teksti
          </Button>
          {observation.processedText && !observation.withTheory && (
            <Button
              size="xs"
              variant="secondary"
              icon={<Info size={12} />}
              onClick={handleAddTheory}
            >
              Lisää viitteet
            </Button>
          )}
          {observation.withTheory && (
            <Button
              size="xs"
              variant="ghost"
              icon={<RefreshCw size={12} />}
              onClick={handleProcessWithAI}
            >
              Päivitä
            </Button>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Tabs */}
          {(observation.processedText || observation.withTheory || streamedText) && (
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('processed')}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'processed'
                    ? 'border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Muotoiltu
              </button>
              <button
                onClick={() => setActiveTab('theory')}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'theory'
                    ? 'border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Viitteineen
              </button>
            </div>
          )}

          {/* Tab content */}
          <div className="p-4">
            {processing && streamedText ? (
              <div className="prose-inspection">
                <ReactMarkdown>{streamedText + '▍'}</ReactMarkdown>
              </div>
            ) : activeTab === 'processed' && observation.processedText ? (
              <div className="prose-inspection">
                <ReactMarkdown>{observation.processedText}</ReactMarkdown>
              </div>
            ) : activeTab === 'theory' && (observation.withTheory || streamedText) ? (
              <div className="prose-inspection">
                <ReactMarkdown>{observation.withTheory || streamedText}</ReactMarkdown>
              </div>
            ) : null}

            {/* Photos section */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Valokuvat
              </h4>
              <PhotoCapture
                categoryName={categoryName}
                photos={observation.photos}
                onPhotoAdded={onPhotoAdded}
                onPhotoUpdated={onPhotoUpdated}
                onPhotoDeleted={onPhotoDeleted}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function extractProcessedText(theoryText: string): string {
  // Extract just the observation part from the theory-enhanced text
  const match = theoryText.match(/\*\*Havainto:\*\*\s*(.+?)(?=\*\*Tekninen|$)/s);
  return match ? match[1].trim() : theoryText.split('\n')[0] || theoryText;
}
