import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, RefreshCw, TableProperties, FileText } from 'lucide-react';
import { InspectionReport } from '../../types';
import { generateFindingsSummary, generateFinalSummary } from '../../services/api';
import { Button } from '../UI/Button';
import { Spinner } from '../UI/Spinner';

interface ReportSummaryViewProps {
  report: InspectionReport;
  onSummaryGenerated: (findingsSummary: string, finalSummary: string) => void;
}

export const ReportSummaryView: React.FC<ReportSummaryViewProps> = ({
  report,
  onSummaryGenerated,
}) => {
  const [generatingFindings, setGeneratingFindings] = React.useState(false);
  const [generatingFinal, setGeneratingFinal] = React.useState(false);
  const [localFindings, setLocalFindings] = React.useState(report.summary?.findingsSummary || '');
  const [localFinal, setLocalFinal] = React.useState(report.summary?.finalSummary || '');

  // Collect all observations across all categories
  const allObservations = report.categories.flatMap(cat =>
    cat.observations.map(obs => ({
      category: cat.name,
      text: obs.withTheory || obs.processedText || obs.rawText,
    }))
  ).filter(o => o.text);

  const handleGenerateFindings = async () => {
    if (allObservations.length === 0) {
      alert('Lisää ensin havaintoja ennen yhteenvedon luomista.');
      return;
    }

    setGeneratingFindings(true);
    try {
      const summary = await generateFindingsSummary(allObservations);
      setLocalFindings(summary);
      onSummaryGenerated(summary, localFinal);
    } catch (err) {
      console.error('Failed to generate findings summary:', err);
      alert('Havaintoyhteenvedon luominen epäonnistui. Tarkista API-yhteys.');
    } finally {
      setGeneratingFindings(false);
    }
  };

  const handleGenerateFinal = async () => {
    setGeneratingFinal(true);
    try {
      const finalSummary = await generateFinalSummary({
        propertyInfo: report.propertyInfo as unknown as Record<string, string>,
        observations: allObservations,
        findingsSummary: localFindings,
      });
      setLocalFinal(finalSummary);
      onSummaryGenerated(localFindings, finalSummary);
    } catch (err) {
      console.error('Failed to generate final summary:', err);
      alert('Loppuyhteenvedon luominen epäonnistui. Tarkista API-yhteys.');
    } finally {
      setGeneratingFinal(false);
    }
  };

  const handleGenerateAll = async () => {
    await handleGenerateFindings();
    await handleGenerateFinal();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Tekoälyanalyysi ja yhteenvedot</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {allObservations.length} havaintoa · {report.categories.filter(c => c.observations.length > 0).length} kategoriaa
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Sparkles size={15} />}
          onClick={handleGenerateAll}
          loading={generatingFindings || generatingFinal}
        >
          Luo kaikki
        </Button>
      </div>

      {/* Findings summary */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TableProperties size={16} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Havaintoyhteenveto</h3>
          </div>
          <Button
            size="xs"
            variant={localFindings ? 'ghost' : 'primary'}
            icon={localFindings ? <RefreshCw size={12} /> : <Sparkles size={12} />}
            onClick={handleGenerateFindings}
            loading={generatingFindings}
          >
            {localFindings ? 'Päivitä' : 'Luo taulukko'}
          </Button>
        </div>

        <div className="p-4">
          {generatingFindings ? (
            <Spinner size="sm" text="Tekoäly analysoi havainnot..." className="py-8" />
          ) : localFindings ? (
            <div className="prose-inspection">
              <ReactMarkdown>{localFindings}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8">
              <TableProperties size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                Tekoäly luo automaattisesti taulukon havainnoista kiireellisyyden mukaan järjestettynä.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Final summary */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-green-600" />
            <h3 className="font-semibold text-gray-900 text-sm">Loppuyhteenveto</h3>
          </div>
          <Button
            size="xs"
            variant={localFinal ? 'ghost' : 'success'}
            icon={localFinal ? <RefreshCw size={12} /> : <Sparkles size={12} />}
            onClick={handleGenerateFinal}
            loading={generatingFinal}
          >
            {localFinal ? 'Päivitä' : 'Luo yhteenveto'}
          </Button>
        </div>

        <div className="p-4">
          {generatingFinal ? (
            <Spinner size="sm" text="Tekoäly kirjoittaa loppuyhteenvetoa..." className="py-8" />
          ) : localFinal ? (
            <div className="prose-inspection">
              <ReactMarkdown>{localFinal}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                Tekoäly kirjoittaa ammattimaisen loppuyhteenvedon kohteen kunnosta.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      {allObservations.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Havaintojen erittely</h4>
          <div className="space-y-2">
            {report.categories
              .filter(c => c.observations.length > 0)
              .map(cat => (
                <div key={cat.id} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{cat.name}</span>
                  <span className="text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    {cat.observations.length} hav.
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
