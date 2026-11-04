import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

// Layout
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';

// Features
import { DatabaseView } from './components/features/database';
import { CalculatorView } from './components/features/calculator';
import { AnalyticsView } from './components/features/analytics';

// UI
import { ToastContainer } from './components/ui/Toast';

// Hooks
import { useRates, useCalculator, useToast, useLocalStorage } from './hooks';

// Constants & Types
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './constants';
import type { TabType, AppSettings, RateFormData, Rate } from './types';

const App: React.FC = () => {
  // App state
  const [activeTab, setActiveTab] = useState<TabType>('database');
  const [settings, setSettings] = useLocalStorage<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize after a short delay (simulating data load)
  React.useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Toast notifications
  const toast = useToast();

  // Rates management
  const {
    rates,
    filteredRates,
    sort,
    toggleSort,
    setSearchTerm,
    addRate,
    updateRate,
    deleteRate,
    importRates,
    clearAllRates,
    totalCount,
  } = useRates();

  // Calculator
  const {
    selectedRate,
    weight,
    result,
    history,
    selectRate,
    updateWeight,
    saveToHistory,
    removeFromHistory,
    clearAllHistory,
  } = useCalculator(settings);

  // Settings update handler
  const handleSettingsChange = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, [setSettings]);

  // Add rate handler
  const handleAddRate = useCallback((data: RateFormData) => {
    return addRate(data);
  }, [addRate]);

  // Update rate handler
  const handleUpdateRate = useCallback((id: string, data: Partial<Rate>) => {
    return updateRate(id, data);
  }, [updateRate]);

  // Save to history handler
  const handleSaveToHistory = useCallback(() => {
    const saved = saveToHistory();
    if (saved) {
      toast.success('Расчет сохранен в историю');
    }
  }, [saveToHistory, toast]);

  // Loading screen
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mb-4 text-blue-500" size={56} />
        <p className="font-bold uppercase tracking-widest text-sm">Загрузка ELP Cloud...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col font-sans">
      {/* Navigation */}
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8">
        {activeTab === 'database' && (
          <DatabaseView
            rates={rates}
            filteredRates={filteredRates}
            sort={sort}
            onSort={toggleSort}
            onAdd={handleAddRate}
            onUpdate={handleUpdateRate}
            onDelete={deleteRate}
            onImport={importRates}
            onClearAll={clearAllRates}
            onSearchChange={setSearchTerm}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onSuccess={toast.success}
            onError={toast.error}
          />
        )}

        {activeTab === 'calculator' && (
          <CalculatorView
            rates={rates}
            selectedRate={selectedRate}
            weight={weight}
            result={result}
            history={history}
            settings={settings}
            onSelectRate={selectRate}
            onWeightChange={updateWeight}
            onSaveToHistory={handleSaveToHistory}
            onRemoveFromHistory={removeFromHistory}
            onClearHistory={clearAllHistory}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView rates={rates} />
        )}
      </main>

      {/* Footer */}
      <Footer totalRecords={totalCount} />

      {/* Toast Notifications */}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />
    </div>
  );
};

export default App;
