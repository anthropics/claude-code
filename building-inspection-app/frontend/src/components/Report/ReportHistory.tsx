import React from 'react';
import { Clock, Plus, Edit3, Trash2, FileText, Shield, PenTool, Settings } from 'lucide-react';
import { ReportVersion } from '../../types';

interface ReportHistoryProps {
  history: ReportVersion[];
}

const changeIcons: Record<string, React.ReactNode> = {
  observation_added: <Plus size={12} className="text-green-600" />,
  observation_edited: <Edit3 size={12} className="text-blue-600" />,
  observation_deleted: <Trash2 size={12} className="text-red-600" />,
  property_updated: <Settings size={12} className="text-gray-600" />,
  summary_generated: <FileText size={12} className="text-purple-600" />,
  status_changed: <Shield size={12} className="text-amber-600" />,
  signature_added: <PenTool size={12} className="text-indigo-600" />,
};

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('fi-FI', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const ReportHistory: React.FC<ReportHistoryProps> = ({ history }) => {
  const sorted = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">Ei vielä muutoshistoriaa</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 p-2.5 hover:bg-gray-50 rounded-lg">
          <div className="mt-0.5 bg-gray-100 rounded-full p-1.5 flex-shrink-0">
            {changeIcons[entry.changeType] || <Clock size={12} className="text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700">{entry.description}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatTimestamp(entry.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
