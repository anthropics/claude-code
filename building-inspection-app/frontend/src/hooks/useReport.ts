import { useState, useCallback } from 'react';
import { InspectionReport, Observation, Photo, UrgencyLevel } from '../types';
import { updateReport, getReport } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';

export function useReport(initialReport: InspectionReport) {
  const [report, setReport] = useState<InspectionReport>(initialReport);

  const save = useCallback((updatedReport: InspectionReport) => {
    updateReport(updatedReport);
    setReport(updatedReport);
  }, []);

  const refresh = useCallback(() => {
    const fresh = getReport(report.id);
    if (fresh) setReport(fresh);
  }, [report.id]);

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
    updateObservation,
    deleteObservation,
    addPhoto,
    updatePhoto,
    deletePhoto,
    updateCategoryNotes,
    setUrgency,
    updateSummary,
    refresh,
    save,
  };
}
