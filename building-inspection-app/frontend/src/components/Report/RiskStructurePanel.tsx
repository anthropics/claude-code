import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, AlertTriangle, AlertCircle } from 'lucide-react';
import { RiskStructure } from '../../types';

interface RiskStructurePanelProps {
  risks: RiskStructure[];
  buildYear: string;
}

export const RiskStructurePanel: React.FC<RiskStructurePanelProps> = ({ risks, buildYear }) => {
  const [expanded, setExpanded] = useState(true);

  if (!buildYear || risks.length === 0) return null;

  const highRisks = risks.filter(r => r.severity === 'high');
  const mediumRisks = risks.filter(r => r.severity === 'medium');

  return (
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
        <div className="border-t border-amber-200 divide-y divide-amber-100">
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

          <div className="px-4 py-3 bg-amber-50/80">
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>Huom:</strong> Riskirakenteiden tunnistus perustuu rakennusvuoteen ja rakennetyyppeihin.
              Lopullinen arvio edellyttää aina aistinvaraista tarkastusta ja mahdollisia lisätutkimuksia.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
