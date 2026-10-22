import React, { useState } from 'react';
import {
  ShieldAlert, ChevronDown, ChevronUp, AlertTriangle, AlertCircle,
  Sparkles, Plus, Clock, CheckCircle2
} from 'lucide-react';
import { RiskStructure, UrgencyLevel } from '../../types';
import { generateRiskObservations, BuildingContext } from '../../services/api';
import { Button } from '../UI/Button';
import { AIProcessingBadge } from '../UI/Spinner';
import { LifespanWarning } from '../../utils/lifespanDatabase';

interface RiskStructurePanelProps {
  risks: RiskStructure[];
  buildYear: string;
  buildingContext?: BuildingContext;
  lifespanWarnings?: LifespanWarning[];
  onAddRiskObservation?: (categoryId: string, text: string, urgency: UrgencyLevel) => void;
}

export const RiskStructurePanel: React.FC<RiskStructurePanelProps> = ({
  risks,
  buildYear,
  buildingContext,
  lifespanWarnings = [],
  onAddRiskObservation,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showLifespan, setShowLifespan] = useState(false);
  const [generatingTemplates, setGeneratingTemplates] = useState(false);
  const [riskTemplates, setRiskTemplates] = useState<Array<{
    riskName: string;
    category: string;
    observationTemplate: string;
    urgency: string;
    added: boolean;
  }>>([]);

  if (!buildYear || (risks.length === 0 && lifespanWarnings.length === 0)) return null;

  const highRisks = risks.filter(r => r.severity === 'high');
  const mediumRisks = risks.filter(r => r.severity === 'medium');

  const exceededLifespans = lifespanWarnings.filter(w => w.status === 'exceeded');
  const approachingLifespans = lifespanWarnings.filter(w => w.status === 'approaching');

  // Generate AI observation templates from risks
  const handleGenerateTemplates = async () => {
    if (risks.length === 0) return;
    setGeneratingTemplates(true);
    try {
      const result = await generateRiskObservations(risks, buildingContext);
      setRiskTemplates(result.observations.map(o => ({ ...o, added: false })));
    } catch (err) {
      console.error('Failed to generate risk templates:', err);
    } finally {
      setGeneratingTemplates(false);
    }
  };

  // Add a risk observation template to the report
  const handleAddTemplate = (index: number) => {
    const template = riskTemplates[index];
    if (!template || !onAddRiskObservation) return;

    const urgencyMap: Record<string, UrgencyLevel> = {
      'välitön': 'välitön',
      '1-2v': '1-2v',
      '3-5v': '3-5v',
      'seurattava': 'seurattava',
      'ei_toimenpiteitä': 'ei_toimenpiteitä',
    };

    onAddRiskObservation(
      template.category,
      template.observationTemplate,
      urgencyMap[template.urgency] || 'seurattava'
    );

    setRiskTemplates(prev =>
      prev.map((t, i) => i === index ? { ...t, added: true } : t)
    );
  };

  // Add all templates at once
  const handleAddAllTemplates = () => {
    riskTemplates.forEach((_, i) => {
      if (!riskTemplates[i].added) {
        handleAddTemplate(i);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Risk structures panel */}
      {risks.length > 0 && (
        <div className="border border-amber-300 rounded-xl overflow-hidden bg-amber-50">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-amber-100/60 transition-colors"
          >
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 flex-shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-900 text-sm">
                Tunnistetut riskirakenteet ({risks.length})
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Rakennusvuosi {buildYear} · {highRisks.length > 0 && `${highRisks.length} korkea · `}
                {mediumRisks.length > 0 && `${mediumRisks.length} kohtalainen`}
              </p>
            </div>
            <div className="flex-shrink-0 text-amber-600">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {expanded && (
            <div className="border-t border-amber-200">
              {/* Risk items */}
              <div className="divide-y divide-amber-100">
                {risks.map((risk, i) => (
                  <div key={i} className="p-4 bg-white/60">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 mt-0.5 ${risk.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`}>
                        {risk.severity === 'high'
                          ? <AlertTriangle size={15} />
                          : <AlertCircle size={15} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{risk.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            risk.severity === 'high'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {risk.severity === 'high' ? 'Korkea riski' : 'Kohtalainen riski'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed mb-2">{risk.description}</p>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-blue-700">Suositus: </span>
                          <span className="text-xs text-blue-800">{risk.recommendation}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Generate observation templates from risks */}
              <div className="px-4 py-3 bg-amber-50/80 border-t border-amber-200">
                {generatingTemplates ? (
                  <AIProcessingBadge text="Luodaan havaintopohjia riskirakenteista..." />
                ) : riskTemplates.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                        AI-generoidut havaintopohjat ({riskTemplates.length})
                      </span>
                      {onAddRiskObservation && (
                        <Button
                          size="xs"
                          variant="primary"
                          icon={<Plus size={12} />}
                          onClick={handleAddAllTemplates}
                          disabled={riskTemplates.every(t => t.added)}
                        >
                          Lisää kaikki raporttiin
                        </Button>
                      )}
                    </div>
                    {riskTemplates.map((template, i) => (
                      <div key={i} className={`bg-white rounded-lg border p-3 ${template.added ? 'border-green-200 opacity-60' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-gray-700">{template.riskName}</span>
                          {template.added ? (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle2 size={11} /> Lisätty
                            </span>
                          ) : onAddRiskObservation ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={<Plus size={11} />}
                              onClick={() => handleAddTemplate(i)}
                            >
                              Lisää
                            </Button>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{template.observationTemplate}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-amber-700 leading-relaxed">
                      <strong>Huom:</strong> Riskirakenteiden tunnistus perustuu rakennusvuoteen ja rakennetyyppeihin.
                    </p>
                    {onAddRiskObservation && (
                      <Button
                        size="xs"
                        variant="secondary"
                        icon={<Sparkles size={12} />}
                        onClick={handleGenerateTemplates}
                      >
                        Luo havaintopohjat
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Technical lifespan warnings */}
      {lifespanWarnings.length > 0 && (
        <div className="border border-blue-300 rounded-xl overflow-hidden bg-blue-50">
          <button
            onClick={() => setShowLifespan(!showLifespan)}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-blue-100/60 transition-colors"
          >
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700 flex-shrink-0">
              <Clock size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-blue-900 text-sm">
                Tekniset käyttöiät ({lifespanWarnings.length})
              </h3>
              <p className="text-xs text-blue-700 mt-0.5">
                {exceededLifespans.length > 0 && `${exceededLifespans.length} ylitetty · `}
                {approachingLifespans.length > 0 && `${approachingLifespans.length} lähestyy`}
              </p>
            </div>
            <div className="flex-shrink-0 text-blue-600">
              {showLifespan ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {showLifespan && (
            <div className="border-t border-blue-200 divide-y divide-blue-100">
              {lifespanWarnings.map((warning, i) => (
                <div key={i} className={`p-3 ${
                  warning.status === 'exceeded' ? 'bg-red-50/60' :
                  warning.status === 'approaching' ? 'bg-amber-50/60' :
                  'bg-white/60'
                }`}>
                  <div className="flex items-start gap-2">
                    <div className={`flex-shrink-0 mt-0.5 ${
                      warning.status === 'exceeded' ? 'text-red-500' :
                      warning.status === 'approaching' ? 'text-amber-500' :
                      'text-blue-500'
                    }`}>
                      {warning.status === 'exceeded'
                        ? <AlertTriangle size={13} />
                        : warning.status === 'approaching'
                        ? <AlertCircle size={13} />
                        : <Clock size={13} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-gray-800">{warning.entry.component}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          warning.status === 'exceeded' ? 'bg-red-100 text-red-700' :
                          warning.status === 'approaching' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {warning.status === 'exceeded' ? 'Ylitetty' :
                           warning.status === 'approaching' ? 'Lähestyy' :
                           'Tarkastus'}
                        </span>
                        {warning.entry.rtReference && (
                          <span className="text-[10px] text-gray-400">{warning.entry.rtReference}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{warning.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
