import React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles, RefreshCw, TableProperties, FileText, ShieldCheck,
  AlertTriangle, AlertCircle, CheckCircle2, Zap
} from 'lucide-react';
import { InspectionReport, CompletenessResult } from '../../types';
import { generateFindingsSummary, generateFinalSummary, checkCompleteness, BuildingContext } from '../../services/api';
import { Button } from '../UI/Button';
import { Spinner } from '../UI/Spinner';

interface ReportSummaryViewProps {
  report: InspectionReport;
  buildingContext?: BuildingContext;
  onSummaryGenerated: (findingsSummary: string, finalSummary: string) => void;
}

export const ReportSummaryView: React.FC<ReportSummaryViewProps> = ({
  report,
  buildingContext,
  onSummaryGenerated,
}) => {
  const [generatingFindings, setGeneratingFindings] = React.useState(false);
  const [generatingFinal, setGeneratingFinal] = React.useState(false);
  const [generatingAll, setGeneratingAll] = React.useState(false);
  const [checkingCompleteness, setCheckingCompleteness] = React.useState(false);
  const [completeness, setCompleteness] = React.useState<CompletenessResult | null>(null);
  const [localFindings, setLocalFindings] = React.useState(report.summary?.findingsSummary || '');
  const [localFinal, setLocalFinal] = React.useState(report.summary?.finalSummary || '');

  // Collect all observations with moisture readings when available
  const allObservations = report.categories.flatMap(cat =>
    cat.observations.map(obs => {
      const baseText = obs.withTheory || obs.processedText || obs.rawText;
      const text = obs.moistureReading
        ? `${baseText} [Kosteusarvo: ${obs.moistureReading}]`
        : baseText;
      return { category: cat.name, text };
    })
  ).filter(o => o.text);

  const processingObservations = report.categories.flatMap(cat =>
    cat.observations.filter(obs => obs.aiProcessing)
  );

  const handleCheckCompleteness = async () => {
    setCheckingCompleteness(true);
    try {
      const categories = report.categories.map(c => ({
        name: c.name,
        observationCount: c.observations.length,
      }));
      const result = await checkCompleteness(categories, buildingContext);
      setCompleteness(result);
    } catch (err) {
      console.error('Completeness check failed:', err);
    } finally {
      setCheckingCompleteness(false);
    }
  };

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
        propertyInfo: report.propertyInfo as unknown as Record<string, unknown>,
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

  /**
   * One-click: check completeness, generate findings, generate final summary
   */
  const handleGenerateAll = async () => {
    if (allObservations.length === 0) {
      alert('Lisää ensin havaintoja ennen raportin generointia.');
      return;
    }

    setGeneratingAll(true);

    try {
      // Step 1: Check completeness
      const categories = report.categories.map(c => ({
        name: c.name,
        observationCount: c.observations.length,
      }));
      const completenessResult = await checkCompleteness(categories, buildingContext);
      setCompleteness(completenessResult);

      // Step 2: Generate findings summary
      const findings = await generateFindingsSummary(allObservations);
      setLocalFindings(findings);

      // Step 3: Generate final summary
      const finalSummary = await generateFinalSummary({
        propertyInfo: report.propertyInfo as unknown as Record<string, unknown>,
        observations: allObservations,
        findingsSummary: findings,
      });
      setLocalFinal(finalSummary);
      onSummaryGenerated(findings, finalSummary);
    } catch (err) {
      console.error('Generate all failed:', err);
      alert('Raportin generointi epäonnistui osittain. Tarkista tulokset.');
    } finally {
      setGeneratingAll(false);
    }
  };

  const isAnyGenerating = generatingFindings || generatingFinal || generatingAll;

  return (
    <div className="space-y-6">
      {/* Header with one-click generate */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Yhteenvedot</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {allObservations.length} havaintoa · {report.categories.filter(c => c.observations.length > 0).length} kategoriaa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ShieldCheck size={15} />}
            onClick={handleCheckCompleteness}
            loading={checkingCompleteness}
          >
            Tarkista kattavuus
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Zap size={15} />}
            onClick={handleGenerateAll}
            loading={isAnyGenerating}
          >
            Generoi koko raportti
          </Button>
        </div>
      </div>

      {/* Processing warning */}
      {processingObservations.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            {processingObservations.length} havaintoa on vielä AI-käsittelyssä. Odota käsittelyn valmistumista ennen raportin generointia.
          </p>
        </div>
      )}

      {/* Completeness check results */}
      {completeness && (
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className={
                completeness.completenessPercent >= 80 ? 'text-green-600' :
                completeness.completenessPercent >= 50 ? 'text-amber-600' :
                'text-red-600'
              } />
              <h3 className="font-semibold text-gray-900 text-sm">Tarkastuksen kattavuus</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 rounded-full h-2 w-24">
                <div
                  className={`h-2 rounded-full transition-all ${
                    completeness.completenessPercent >= 80 ? 'bg-green-500' :
                    completeness.completenessPercent >= 50 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${completeness.completenessPercent}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gray-700">{completeness.completenessPercent}%</span>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-600">{completeness.overallAssessment}</p>

            {completeness.missingAreas.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Puuttuvat tai vajavaiset alueet
                </h4>
                {completeness.missingAreas.map((area, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg ${
                    area.importance === 'critical' ? 'bg-red-50 border border-red-100' :
                    area.importance === 'recommended' ? 'bg-amber-50 border border-amber-100' :
                    'bg-gray-50 border border-gray-100'
                  }`}>
                    {area.importance === 'critical'
                      ? <AlertTriangle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                      : area.importance === 'recommended'
                      ? <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      : <CheckCircle2 size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <span className="text-xs font-semibold text-gray-800">{area.area}</span>
                      <p className="text-xs text-gray-600 mt-0.5">{area.reason}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto flex-shrink-0 ${
                      area.importance === 'critical' ? 'bg-red-100 text-red-700' :
                      area.importance === 'recommended' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {area.importance === 'critical' ? 'Kriittinen' :
                       area.importance === 'recommended' ? 'Suositeltu' : 'Valinnainen'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

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
            loading={generatingFindings || generatingAll}
          >
            {localFindings ? 'Päivitä' : 'Luo taulukko'}
          </Button>
        </div>

        <div className="p-4">
          {(generatingFindings || (generatingAll && !localFindings)) ? (
            <Spinner size="sm" text="Laaditaan havaintoyhteenvetoa..." className="py-8" />
          ) : localFindings ? (
            <div className="prose-inspection">
              <ReactMarkdown>{localFindings}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8">
              <TableProperties size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-xs text-gray-400">Generoi havaintoyhteenveto automaattisesti</p>
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
            loading={generatingFinal || generatingAll}
          >
            {localFinal ? 'Päivitä' : 'Luo yhteenveto'}
          </Button>
        </div>

        <div className="p-4">
          {(generatingFinal || (generatingAll && !localFinal)) ? (
            <Spinner size="sm" text="Laaditaan loppuyhteenvetoa..." className="py-8" />
          ) : localFinal ? (
            <div className="prose-inspection">
              <ReactMarkdown>{localFinal}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-xs text-gray-400">Generoi loppuyhteenveto automaattisesti</p>
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
