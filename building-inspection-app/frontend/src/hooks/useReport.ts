import { useState, useCallback, useRef } from 'react';
import { InspectionReport, Observation, Photo, UrgencyLevel } from '../types';
import { updateReport, getReport } from '../services/storage';
import { processObservationFull, BuildingContext } from '../services/api';
import { v4 as uuidv4 } from 'uuid';

export function useReport(initialReport: InspectionReport) {
  const [report, setReport] = useState<InspectionReport>(initialReport);
  const processingQueue = useRef<Set<string>>(new Set());

  const save = useCallback((updatedReport: InspectionReport) => {
    updateReport(updatedReport);
    setReport(updatedReport);
  }, []);

  const refresh = useCallback(() => {
    const fresh = getReport(report.id);
    if (fresh) setReport(fresh);
  }, [report.id]);

  // Build context from property info for AI requests
  const getBuildingContext = useCallback((): BuildingContext => ({
    buildYear: report.propertyInfo.buildYear,
    buildingType: report.propertyInfo.buildingType,
    foundationType: report.propertyInfo.foundationType,
    wallType: report.propertyInfo.wallType,
    roofType: report.propertyInfo.roofType,
    heatingSystem: report.propertyInfo.heatingSystem,
    ventilationType: report.propertyInfo.ventilationType,
    drainagePipeType: report.propertyInfo.drainagePipeType,
    waterPipeType: report.propertyInfo.waterPipeType,
  }), [report.propertyInfo]);

  const updatePropertyInfo = useCallback(
    (field: string, value: unknown) => {
      const updated = {
        ...report,
        propertyInfo: { ...report.propertyInfo, [field]: value },
      };
      save(updated);
    },
    [report, save]
  );

  /**
   * Adds an observation and automatically triggers AI processing.
   * AI will professionalize text, add theory, suggest urgency.
   */
  const addObservation = useCallback(
    (categoryId: string, rawText: string): Observation => {
      const now = new Date().toISOString();
      const observation: Observation = {
        id: uuidv4(),
        rawText,
        processedText: rawText,
        withTheory: '',
        photos: [],
        urgency: 'seurattava',
        moistureReading: '',
        aiProcessing: true, // Mark as processing
        createdAt: now,
        updatedAt: now,
      };

      const updated = {
        ...report,
        status: 'in_progress' as const,
        categories: report.categories.map(cat =>
          cat.id === categoryId
            ? { ...cat, observations: [...cat.observations, observation] }
            : cat
        ),
      };
      save(updated);

      // Auto-process with AI in the background
      const obsId = observation.id;
      if (!processingQueue.current.has(obsId)) {
        processingQueue.current.add(obsId);
        const categoryName = report.categories.find(c => c.id === categoryId)?.name || categoryId;
        const context = getBuildingContext();

        processObservationFull(rawText, categoryName, context)
          .then((result) => {
            // Update observation with AI results
            setReport(prevReport => {
              const newReport = {
                ...prevReport,
                categories: prevReport.categories.map(cat =>
                  cat.id === categoryId
                    ? {
                        ...cat,
                        observations: cat.observations.map(obs =>
                          obs.id === obsId
                            ? {
                                ...obs,
                                processedText: result.processedText || obs.rawText,
                                withTheory: result.withTheory || '',
                                urgency: (result.urgency as UrgencyLevel) || obs.urgency,
                                aiProcessing: false,
                                updatedAt: new Date().toISOString(),
                              }
                            : obs
                        ),
                      }
                    : cat
                ),
              };
              updateReport(newReport);
              return newReport;
            });
          })
          .catch((err) => {
            console.error('Auto-process failed:', err);
            // Clear processing flag on error
            setReport(prevReport => {
              const newReport = {
                ...prevReport,
                categories: prevReport.categories.map(cat =>
                  cat.id === categoryId
                    ? {
                        ...cat,
                        observations: cat.observations.map(obs =>
                          obs.id === obsId ? { ...obs, aiProcessing: false } : obs
                        ),
                      }
                    : cat
                ),
              };
              updateReport(newReport);
              return newReport;
            });
          })
          .finally(() => {
            processingQueue.current.delete(obsId);
          });
      }

      return observation;
    },
    [report, save, getBuildingContext]
  );

  /**
   * Adds an observation from a risk template without AI processing
   * (already pre-processed by the risk observation generator).
   */
  const addObservationFromTemplate = useCallback(
    (categoryId: string, rawText: string, urgency: UrgencyLevel): Observation => {
      const now = new Date().toISOString();
      const observation: Observation = {
        id: uuidv4(),
        rawText,
        processedText: rawText,
        withTheory: '',
        photos: [],
        urgency,
        moistureReading: '',
        aiProcessing: false,
        createdAt: now,
        updatedAt: now,
      };

      const updated = {
        ...report,
        status: 'in_progress' as const,
        categories: report.categories.map(cat =>
          cat.id === categoryId
            ? { ...cat, observations: [...cat.observations, observation] }
            : cat
        ),
      };
      save(updated);
      return observation;
    },
    [report, save]
  );

  const updateObservation = useCallback(
    (categoryId: string, observationId: string, changes: Partial<Observation>) => {
      const updated = {
        ...report,
        categories: report.categories.map(cat =>
          cat.id === categoryId
            ? {
                ...cat,
                observations: cat.observations.map(obs =>
                  obs.id === observationId
                    ? { ...obs, ...changes, updatedAt: new Date().toISOString() }
                    : obs
                ),
              }
            : cat
        ),
      };
      save(updated);
    },
    [report, save]
  );

  const deleteObservation = useCallback(
    (categoryId: string, observationId: string) => {
      const updated = {
        ...report,
        categories: report.categories.map(cat =>
          cat.id === categoryId
            ? { ...cat, observations: cat.observations.filter(obs => obs.id !== observationId) }
            : cat
        ),
      };
      save(updated);
    },
    [report, save]
  );

  const addPhoto = useCallback(
    (categoryId: string, observationId: string, photo: Photo) => {
      updateObservation(categoryId, observationId, {
        photos: [
          ...(report.categories
            .find(c => c.id === categoryId)
            ?.observations.find(o => o.id === observationId)?.photos || []),
          photo,
        ],
      });
    },
    [report, updateObservation]
  );

  const updatePhoto = useCallback(
    (categoryId: string, observationId: string, photoId: string, changes: Partial<Photo>) => {
      const cat = report.categories.find(c => c.id === categoryId);
      const obs = cat?.observations.find(o => o.id === observationId);
      if (!obs) return;

      updateObservation(categoryId, observationId, {
        photos: obs.photos.map(p => (p.id === photoId ? { ...p, ...changes } : p)),
      });
    },
    [report, updateObservation]
  );

  const deletePhoto = useCallback(
    (categoryId: string, observationId: string, photoId: string) => {
      const cat = report.categories.find(c => c.id === categoryId);
      const obs = cat?.observations.find(o => o.id === observationId);
      if (!obs) return;

      updateObservation(categoryId, observationId, {
        photos: obs.photos.filter(p => p.id !== photoId),
      });
    },
    [report, updateObservation]
  );

  const updateCategoryNotes = useCallback(
    (categoryId: string, notes: string) => {
      const updated = {
        ...report,
        categories: report.categories.map(cat =>
          cat.id === categoryId ? { ...cat, notes } : cat
        ),
      };
      save(updated);
    },
    [report, save]
  );

  const setUrgency = useCallback(
    (categoryId: string, observationId: string, urgency: UrgencyLevel) => {
      updateObservation(categoryId, observationId, { urgency });
    },
    [updateObservation]
  );

  const updateSummary = useCallback(
    (findingsSummary: string, finalSummary: string) => {
      const updated = {
        ...report,
        status: 'completed' as const,
        summary: {
          findingsSummary,
          finalSummary,
          generatedAt: new Date().toISOString(),
        },
      };
      save(updated);
    },
    [report, save]
  );

  return {
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
    setUrgency,
    updateSummary,
    getBuildingContext,
    refresh,
    save,
  };
}
