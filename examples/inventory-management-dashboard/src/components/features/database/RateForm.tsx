import React, { useState, useEffect } from 'react';
import { Cloud, Plus, Save } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import {
  CURRENCY_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  UNIT_OPTIONS,
} from '../../../constants';
import type { Rate, RateFormData } from '../../../types';

interface RateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RateFormData) => { success: boolean; errors: string[] };
  editingRate?: Rate | null;
  onSuccess?: () => void;
}

const initialFormData: RateFormData = {
  item: '',
  route: '',
  rate: 0,
  unit: 'кг',
  currency: 'EUR',
  type: 'Нал',
  notes: '',
};

export const RateForm: React.FC<RateFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingRate,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<RateFormData>(initialFormData);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!editingRate;

  useEffect(() => {
    if (editingRate) {
      setFormData({
        item: editingRate.item,
        route: editingRate.route,
        rate: editingRate.rate,
        unit: editingRate.unit,
        currency: editingRate.currency,
        type: editingRate.type,
        notes: editingRate.notes,
      });
    } else {
      setFormData(initialFormData);
    }
    setErrors([]);
  }, [editingRate, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);

    try {
      const result = onSubmit(formData);
      if (result.success) {
        onSuccess?.();
        onClose();
        setFormData(initialFormData);
      } else {
        setErrors(result.errors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = <K extends keyof RateFormData>(
    field: K,
    value: RateFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-2xl font-black flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Cloud className="text-blue-600" size={28} />
            </div>
            {isEditing ? 'Редактировать запись' : 'Добавить в базу данных'}
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {errors.length > 0 && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <ul className="list-disc list-inside text-sm text-red-600 font-medium">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <Input
            label="Товар *"
            placeholder="Например: Электроника, Одежда, Косметика"
            value={formData.item}
            onChange={e => handleChange('item', e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Маршрут"
            placeholder="Например: Милан → Москва"
            value={formData.route}
            onChange={e => handleChange('route', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ставка *"
              type="number"
              placeholder="0.00"
              value={formData.rate || ''}
              onChange={e => handleChange('rate', parseFloat(e.target.value) || 0)}
              min={0}
              step={0.1}
              required
            />
            <Select
              label="Единица"
              options={UNIT_OPTIONS}
              value={formData.unit}
              onChange={e => handleChange('unit', e.target.value as RateFormData['unit'])}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Валюта"
              options={CURRENCY_OPTIONS.map(c => ({ value: c.value, label: `${c.label} (${c.symbol})` }))}
              value={formData.currency}
              onChange={e => handleChange('currency', e.target.value as RateFormData['currency'])}
            />
            <Select
              label="Тип расчета"
              options={PAYMENT_TYPE_OPTIONS}
              value={formData.type}
              onChange={e => handleChange('type', e.target.value as RateFormData['type'])}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Дополнительные условия
            </label>
            <textarea
              placeholder="Например: маркировка, EX1, температурный режим, страховка"
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 h-24 text-sm resize-none transition-all"
              value={formData.notes}
              onChange={e => handleChange('notes', e.target.value)}
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={isEditing ? <Save size={20} /> : <Plus size={20} />}
            className="flex-1"
          >
            {isEditing ? 'Сохранить изменения' : 'Добавить в базу'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
