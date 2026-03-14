import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Save, CheckCircle, ClipboardList,
  LayoutList, Sparkles, Building2, AlertCircle
} from 'lucide-react';
import { getReport } from '../services/storage';
import { InspectionReport, UrgencyLevel } from '../types';
import { useReport } from '../hooks/useReport';
import { PropertyForm } from '../components/Report/PropertyForm';
import { RiskStructurePanel } from '../components/Report/RiskStructurePanel';
import { CategorySection } from '../components/Inspection/CategorySection';
import { ReportSummaryView } from '../components/Report/ReportSummaryView';
import { Button } from '../components/UI/Button';
import { generatePDF } from '../utils/pdfGenerator';
import { detectRiskStructures } from '../utils/riskDetector';
import { getLifespanWarnings } from '../utils/lifespanDatabase';

type Tab = 'property' | 'inspection' | 'summary';

export const ReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initialReport, setInitialReport] = useState<InspectionReport | null>(null);

  useEffect(() => {
    if (!id) return navigate('/');
    const r = getReport(id);
    if (!r) return navigate('/');
    setInitialReport(r);
  }, [id, navigate]);

  if (!initialReport) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Building2 size={40} className="text-gray-200 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-400 text-sm">Ladataan raporttia...</p>
        </div>
      </div>
    );
  }

  return <ReportPageContent initialReport={initialReport} navigate={navigate} />;
};

const ReportPageContent: React.FC<{
  initialReport: InspectionReport;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ initialReport, navigate }) => {
  const {
    report,
    updatePropertyInfo,
    addObservation,
    addObservationFromTemplate,
    updateObservation,
    deleteObservation,
    addPhoto,
    updatePhoto,
    deletePhoto,
    updateCategoryNotes,
    updateSummary,
    getBuildingContext,
  } = useReport(initialReport);

  const [activeTab, setActiveTab] = useState<Tab>('property');
  const [exporting, setExporting] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const totalObs = report.categories.reduce((s, c) => s + c.observations.length, 0);
  const filledCategories = report.categories.filter(c => c.observations.length > 0).length;
  const hasPropertyInfo = report.propertyInfo.address && report.propertyInfo.inspectionDate;

  const buildingContext = getBuildingContext();

  // Get risk structures and lifespan warnings
  const risks = detectRiskStructures(report.propertyInfo);
  const buildYear = parseInt(report.propertyInfo.buildYear);
  const lifespanWarnings = !isNaN(buildYear)
    ? getLifespanWarnings(buildYear, report.propertyInfo)
    : [];

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await generatePDF(report);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF-vienti epäonnistui. Tarkista tiedot.');
    } finally {
      setExporting(false);
    }
  };

  const handleSave = () => {
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  // Handler for adding risk observation templates to the report
  const handleAddRiskObservation = (categoryId: string, text: string, urgency: UrgencyLevel) => {
    addObservationFromTemplate(categoryId, text, urgency);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'property',
      label: 'Kohdetiedot',
      icon: <Building2 size={15} />,
    },
    {
      id: 'inspection',
      label: 'Tarkastushavainnot',
      icon: <LayoutList size={15} />,
      badge: totalObs || undefined,
    },
    {
      id: 'summary',
      label: 'Yhteenveto',
      icon: <Sparkles size={15} />,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 flex items-center gap-3 flex-shrink-0 sticky top-0 z-10">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Takaisin"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">
            {report.propertyInfo.address || 'Uusi kuntotarkastus'}
          </h1>
          <p className="text-xs text-gray-400">
            {filledCategories} kategoriaa · {totalObs} havaintoa
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={saveFlash ? <CheckCircle size={15} className="text-green-600" /> : <Save size={15} />}
            onClick={handleSave}
            className={saveFlash ? 'text-green-600' : ''}
          >
            {saveFlash ? 'Tallennettu' : 'Tallenna'}
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Download size={15} />}
            onClick={handleExportPDF}
            loading={exporting}
          >
            Vie PDF
          </Button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100 px-4 lg:px-6 py-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <ClipboardList size={13} />
          <span>Edistyminen:</span>
        </div>
        <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-xs">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (filledCategories / report.categories.length) * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-400">
          {filledCategories}/{report.categories.length} osioita
        </span>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6 flex gap-0 flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative
              ${activeTab === tab.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="absolute top-1.5 right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {/* Property info tab */}
        {activeTab === 'property' && (
          <div className="p-4 lg:p-6 max-w-3xl mx-auto">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Kohde- ja tarkastustiedot</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Täytä kaikki oleelliset tiedot ennen tarkastuksen aloittamista.
              </p>
            </div>

            {!hasPropertyInfo && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Täytä osoite ja tarkastuspäivä ennen havaintojen kirjaamista.
                </p>
              </div>
            )}

            <PropertyForm
              propertyInfo={report.propertyInfo}
              onChange={updatePropertyInfo}
            />

            {/* Risk structure detection panel + lifespan warnings */}
            {report.propertyInfo.buildYear && (
              <div className="mt-6">
                <RiskStructurePanel
                  risks={risks}
                  buildYear={report.propertyInfo.buildYear}
                  buildingContext={buildingContext}
                  lifespanWarnings={lifespanWarnings}
                  onAddRiskObservation={handleAddRiskObservation}
                />
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                onClick={() => setActiveTab('inspection')}
                icon={<LayoutList size={15} />}
              >
                Siirry tarkastukseen
              </Button>
            </div>
          </div>
        )}

        {/* Inspection categories tab */}
        {activeTab === 'inspection' && (
          <div className="p-4 lg:p-6 max-w-3xl mx-auto">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Tarkastushavainnot</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Kirjaa havainnot jokaisesta rakenneosasta. AI muotoilee ja lisää viitteet automaattisesti.
              </p>
            </div>

            <div className="space-y-3">
              {report.categories.map(cat => (
                <CategorySection
                  key={cat.id}
                  category={cat}
                  buildingContext={buildingContext}
                  onAddObservation={(text) => addObservation(cat.id, text)}
                  onUpdateObservation={(obsId, changes) => updateObservation(cat.id, obsId, changes)}
                  onDeleteObservation={(obsId) => deleteObservation(cat.id, obsId)}
                  onAddPhoto={(obsId, photo) => addPhoto(cat.id, obsId, photo)}
                  onUpdatePhoto={(obsId, photoId, changes) => updatePhoto(cat.id, obsId, photoId, changes)}
                  onDeletePhoto={(obsId, photoId) => deletePhoto(cat.id, obsId, photoId)}
                  onUpdateNotes={(notes) => updateCategoryNotes(cat.id, notes)}
                />
              ))}
            </div>

            {totalObs > 0 && (
              <div className="mt-6 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('summary')}
                  icon={<Sparkles size={15} />}
                >
                  Siirry yhteenvetoon
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Summary tab */}
        {activeTab === 'summary' && (
          <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
            <ReportSummaryView
              report={report}
              buildingContext={buildingContext}
              onSummaryGenerated={(findings, final_summary) => {
                updateSummary(findings, final_summary);
              }}
            />

            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                icon={<Download size={15} />}
                onClick={handleExportPDF}
                loading={exporting}
              >
                Lataa PDF-raportti
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
