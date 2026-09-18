import React, { useState, useCallback, useMemo } from 'react';
import { Search, Plus, Cloud, Download, Upload, Trash2 } from 'lucide-react';
import { RateTable } from './RateTable';
import { RateForm } from './RateForm';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { debounce, exportToJSON, exportToCSV, downloadFile, importFromJSON } from '../../../utils';
import { EXCHANGE_RATE_RANGE, DEFAULT_SETTINGS } from '../../../constants';
import type { Rate, RateFormData, SortConfig, SortField, AppSettings } from '../../../types';

interface DatabaseViewProps {
  rates: Rate[];
  filteredRates: Rate[];
  sort: SortConfig;
  onSort: (field: SortField) => void;
  onAdd: (data: RateFormData) => { success: boolean; errors: string[] };
  onUpdate: (id: string, data: Partial<Rate>) => { success: boolean; errors: string[] };
  onDelete: (id: string) => boolean;
  onImport: (rates: Rate[], replace: boolean) => number;
  onClearAll: () => void;
  onSearchChange: (term: string) => void;
  settings: AppSettings;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  rates,
  filteredRates,
  sort,
  onSort,
  onAdd,
  onUpdate,
  onDelete,
  onImport,
  onClearAll,
  onSearchChange,
  settings,
  onSettingsChange,
  onSuccess,
  onError,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((term: string) => onSearchChange(term), 300),
    [onSearchChange]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  const handleAddSubmit = useCallback((data: RateFormData) => {
    const result = onAdd(data);
    if (result.success) {
      onSuccess('Запись успешно добавлена');
    }
    return result;
  }, [onAdd, onSuccess]);

  const handleEditSubmit = useCallback((data: RateFormData) => {
    if (!editingRate) return { success: false, errors: ['Ошибка'] };
    const result = onUpdate(editingRate.id, data);
    if (result.success) {
      onSuccess('Запись успешно обновлена');
    }
    return result;
  }, [editingRate, onUpdate, onSuccess]);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirm) {
      const success = onDelete(deleteConfirm);
      if (success) {
        onSuccess('Запись удалена');
      } else {
        onError('Не удалось удалить запись');
      }
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, onDelete, onSuccess, onError]);

  const handleClearConfirm = useCallback(() => {
    onClearAll();
    onSuccess('База данных очищена');
    setClearConfirm(false);
  }, [onClearAll, onSuccess]);

  const handleExportJSON = useCallback(() => {
    const json = exportToJSON(rates, settings);
    downloadFile(json, `elp-backup-${new Date().toISOString().split('T')[0]}.json`);
    onSuccess('Данные экспортированы в JSON');
  }, [rates, settings, onSuccess]);

  const handleExportCSV = useCallback(() => {
    const csv = exportToCSV(rates);
    downloadFile(csv, `elp-rates-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    onSuccess('Данные экспортированы в CSV');
  }, [rates, onSuccess]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = importFromJSON(text);
        if (!data) {
          onError('Неверный формат файла');
          return;
        }
        const count = onImport(data.rates, false);
        onSuccess(`Импортировано ${count} записей`);
      } catch {
        onError('Ошибка при чтении файла');
      }
    };
    input.click();
  }, [onImport, onSuccess, onError]);

  return (
    <div className="space-y-5" role="tabpanel" id="database-panel" aria-labelledby="database-tab">
      {/* Search & Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        <div className="relative flex-1">
          <Input
            placeholder="Поиск по товарам, маршрутам, примечаниям..."
            value={searchInput}
            onChange={handleSearchChange}
            leftIcon={<Search size={22} />}
            className="py-4 text-lg"
            aria-label="Поиск"
          />
        </div>
        <div className="flex items-center gap-4 bg-white p-3 px-5 rounded-2xl border-2 border-gray-200 shadow-lg">
          <div className="flex-1 lg:flex-none">
            <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">Курс EUR/RUB</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={EXCHANGE_RATE_RANGE.min}
                max={EXCHANGE_RATE_RANGE.max}
                step={EXCHANGE_RATE_RANGE.step}
                value={settings.exchangeRate}
                onChange={e => onSettingsChange({ exchangeRate: parseFloat(e.target.value) })}
                className="w-full lg:w-40 h-2.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                aria-label="Курс EUR/RUB"
              />
              <span className="text-xl font-black text-blue-600 min-w-[60px]">
                {settings.exchangeRate}₽
              </span>
            </div>
          </div>
          <div className="h-12 w-[2px] bg-gray-200 hidden lg:block" aria-hidden="true" />
          <Button onClick={() => setShowAddModal(true)} leftIcon={<Plus size={20} />}>
            <span className="hidden sm:inline">Добавить</span>
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <Cloud size={14} className="text-green-500" aria-hidden="true" />
          <span>Данные актуальны • {rates.length} записей в базе</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold uppercase">
            Найдено: {filteredRates.length}
          </div>
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase hover:bg-green-100 transition flex items-center gap-1"
          >
            <Download size={12} /> JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold uppercase hover:bg-green-100 transition flex items-center gap-1"
          >
            <Download size={12} /> CSV
          </button>
          <button
            onClick={handleImport}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold uppercase hover:bg-blue-100 transition flex items-center gap-1"
          >
            <Upload size={12} /> Импорт
          </button>
          <button
            onClick={() => setClearConfirm(true)}
            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold uppercase hover:bg-red-100 transition flex items-center gap-1"
          >
            <Trash2 size={12} /> Очистить
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
        <RateTable
          rates={filteredRates}
          sort={sort}
          onSort={onSort}
          onEdit={setEditingRate}
          onDelete={setDeleteConfirm}
        />
      </div>

      {/* Add Modal */}
      <RateForm
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddSubmit}
      />

      {/* Edit Modal */}
      <RateForm
        isOpen={!!editingRate}
        onClose={() => setEditingRate(null)}
        onSubmit={handleEditSubmit}
        editingRate={editingRate}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        title="Удалить запись?"
        message="Это действие нельзя отменить. Запись будет удалена из базы данных."
        confirmText="Удалить"
        variant="danger"
      />

      {/* Clear All Confirmation */}
      <ConfirmDialog
        isOpen={clearConfirm}
        onConfirm={handleClearConfirm}
        onCancel={() => setClearConfirm(false)}
        title="Очистить базу данных?"
        message="Все записи будут удалены. Это действие нельзя отменить!"
        confirmText="Очистить всё"
        variant="danger"
      />
    </div>
  );
};
