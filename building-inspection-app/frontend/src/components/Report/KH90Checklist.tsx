import React from 'react';
import { CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { KH90CheckStatus } from '../../types';

interface KH90CheckItem {
  id: string;
  label: string;
  required: boolean;
}

interface KH90ChecklistProps {
  categoryId: string;
  items: KH90CheckItem[];
  checkStatus: KH90CheckStatus;
  onToggle: (itemId: string) => void;
}

export const KH90Checklist: React.FC<KH90ChecklistProps> = ({ items, checkStatus, onToggle }) => {
  const checked = items.filter(i => checkStatus[i.id]).length;
  const requiredItems = items.filter(i => i.required);
  const requiredChecked = requiredItems.filter(i => checkStatus[i.id]).length;

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/50 p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-blue-800">KH 90-00394 Tarkistuslista</span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
          requiredChecked === requiredItems.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {checked}/{items.length} tarkastettu
        </span>
      </div>
      <div className="space-y-1">
        {items.map(item => {
          const isChecked = !!checkStatus[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className="flex items-start gap-2 w-full text-left p-1.5 rounded hover:bg-blue-100/50 transition-colors"
            >
              {isChecked
                ? <CheckSquare size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                : <Square size={14} className={`${item.required ? 'text-amber-500' : 'text-gray-400'} flex-shrink-0 mt-0.5`} />
              }
              <span className={`text-xs ${isChecked ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                {item.label}
                {item.required && !isChecked && (
                  <AlertTriangle size={10} className="inline ml-1 text-amber-500" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
