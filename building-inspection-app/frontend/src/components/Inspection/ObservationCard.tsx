import React, { useState } from 'react';
import {
  Trash2, ChevronDown, ChevronUp, Sparkles, RefreshCw,
  AlertTriangle, Clock, Info, CheckCircle2, Eye, Gauge
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Observation, UrgencyLevel } from '../../types';
import { PhotoCapture } from './PhotoCapture';
import { Button } from '../UI/Button';
import { AIProcessingBadge } from '../UI/Spinner';
import { streamProcessObservation, addTechnicalTheory, BuildingContext } from '../../services/api';
import { recordCorrection } from '../../services/learningStore';
import { Photo } from '../../types';

interface ObservationCardProps {
  observation: Observation;
  categoryId: string;
  categoryName: string;
  buildingContext?: BuildingContext;
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
  buildingContext,
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
  const [editingMoisture, setEditingMoisture] = useState(false);
  const [moistureInput, setMoistureInput] = useState(observation.moistureReading || '');
  const [editingProcessed, setEditingProcessed] = useState(false);
  const [processedInput, setProcessedInput] = useState(observation.processedText || '');

  const urgency = urgencyConfig[observation.urgency];
  const isAutoProcessing = observation.aiProcessing;

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
    // Record correction for AI learning if processedText was AI-generated
    if (observation.processedText && observation.processedText !== observation.rawText) {
      recordCorrection(observation.rawText, rawText, categoryName, 'rawText');
    }
    onUpdate({ rawText });
    setEditingRaw(false);
  };

  const handleSaveMoisture = () => {
    onUpdate({ moistureReading: moistureInput });
    setEditingMoisture(false);
  };

  return (
    <div className={`border rounded-xl bg-white overflow-hidden ${isAutoProcessing ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'}`}>
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

          {/* Moisture reading inline display */}
          {observation.moistureReading && !editingMoisture && (
            <button
              onClick={() => { setEditingMoisture(true); setMoistureInput(observation.moistureReading); }}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100"
              title="Muokkaa kosteusarvo"
            >
              <Gauge size={11} />
              {observation.moistureReading}
            </button>
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

      {/* Auto-processing badge */}
      {isAutoProcessing && (
        <div className="px-4 pb-3">
          <AIProcessingBadge text="AI käsittelee automaattisesti..." />
        </div>
      )}

      {/* Manual processing badge */}
      {processing && !isAutoProcessing && (
        <div className="px-4 pb-3">
          <AIProcessingBadge text="Muotoillaan..." />
        </div>
      )}

      {/* Action buttons */}
      {!processing && !isAutoProcessing && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {!observation.withTheory ? (
            <Button
              size="xs"
              variant="primary"
              icon={<Sparkles size={12} />}
              onClick={handleProcessWithAI}
              loading={processing}
            >
              Muotoile teksti
            </Button>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              icon={<RefreshCw size={12} />}
              onClick={handleProcessWithAI}
            >
              Päivitä
            </Button>
          )}
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
          {/* Moisture reading button */}
          {!observation.moistureReading && !editingMoisture && (
            <Button
              size="xs"
              variant="ghost"
              icon={<Gauge size={12} />}
              onClick={() => { setEditingMoisture(true); setExpanded(true); }}
            >
              Kosteusarvo
            </Button>
          )}
        </div>
      )}

      {/* Moisture reading editor (shown when editing) */}
      {editingMoisture && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <Gauge size={14} className="text-blue-600 flex-shrink-0" />
            <input
              type="text"
              value={moistureInput}
              onChange={e => setMoistureInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveMoisture()}
              placeholder="Esim. WS 78%, kohonnut (raja 60%)"
              className="flex-1 text-sm bg-transparent border-none outline-none text-blue-900 placeholder-blue-300"
              autoFocus
            />
            <Button size="xs" variant="primary" onClick={handleSaveMoisture}>OK</Button>
            <Button size="xs" variant="ghost" onClick={() => setEditingMoisture(false)}>✕</Button>
          </div>
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
              editingProcessed ? (
                <div className="space-y-2">
                  <textarea
                    value={processedInput}
                    onChange={e => setProcessedInput(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    rows={6}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="xs" variant="primary" onClick={() => {
                      // Record the correction for AI learning
                      recordCorrection(observation.processedText, processedInput, categoryName, 'processedText');
                      onUpdate({ processedText: processedInput });
                      setEditingProcessed(false);
                    }}>Tallenna</Button>
                    <Button size="xs" variant="ghost" onClick={() => { setEditingProcessed(false); setProcessedInput(observation.processedText); }}>Peruuta</Button>
                  </div>
                  <p className="text-xs text-blue-500">AI oppii korjauksistasi ja mukauttaa tyyliaan.</p>
                </div>
              ) : (
                <div
                  className="prose-inspection cursor-text hover:bg-gray-50 rounded p-1 -m-1 transition-colors"
                  onClick={() => { setEditingProcessed(true); setProcessedInput(observation.processedText); }}
                  title="Klikkaa muokataksesi — AI oppii korjauksistasi"
                >
                  <ReactMarkdown>{observation.processedText}</ReactMarkdown>
                </div>
              )
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
                buildingContext={buildingContext}
                photos={observation.photos}
                onPhotoAdded={onPhotoAdded}
                onPhotoUpdated={onPhotoUpdated}
                onPhotoDeleted={onPhotoDeleted}
                onSuggestedObservation={undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function extractProcessedText(theoryText: string): string {
  const match = theoryText.match(/\*\*Havainto:\*\*\s*(.+?)(?=\*\*Tekninen|$)/s);
  return match ? match[1].trim() : theoryText.split('\n')[0] || theoryText;
}
