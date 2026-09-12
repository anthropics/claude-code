import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  InspectionReport, Observation, Photo, UrgencyLevel,
  PropertyInfo, BuildingContext,
} from '../types';
import { updateReport } from '../services/storage';
import { processObservationFull } from '../services/api';

export function useReport(initialReport: InspectionReport) {
  const [report, setReport] = useState<InspectionReport>(initialReport);
  const reportRef = useRef(report);
  reportRef.current = report;

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      updateReport(reportRef.current);
    }, 1000);
    return () => clearTimeout(timer);
  }, [report]);

  const updatePropertyInfo = useCallback((changes: Partial<PropertyInfo>) => {
    setReport(prev => ({
      ...prev,
      propertyInfo: { ...prev.propertyInfo, ...changes },
    }));
  }, []);

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

  const addObservation = useCallback(async (categoryId: string, rawText: string) => {
    const now = new Date().toISOString();
    const obsId = uuidv4();
    const newObs: Observation = {
      id: obsId,
      rawText,
      processedText: '',
      withTheory: '',
      photos: [],
      urgency: 'seurattava',
      moistureReading: '',
      aiProcessing: true,
      createdAt: now,
      updatedAt: now,
    };

    setReport(prev => ({
      ...prev,
      status: prev.status === 'draft' ? 'in_progress' : prev.status,
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, observations: [...cat.observations, newObs] }
          : cat
      ),
    }));

    // AI processing in background
    try {
      const context = reportRef.current.propertyInfo;
      const catName = reportRef.current.categories.find(c => c.id === categoryId)?.name || '';
      const result = await processObservationFull(rawText, catName, {
        buildYear: context.buildYear,
        buildingType: context.buildingType,
      });

      setReport(prev => ({
        ...prev,
        categories: prev.categories.map(cat =>
          cat.id === categoryId
            ? {
                ...cat,
                observations: cat.observations.map(o =>
                  o.id === obsId
                    ? {
                        ...o,
                        processedText: result.processedText,
                        withTheory: result.withTheory,
                        urgency: result.urgency as UrgencyLevel,
                        aiProcessing: false,
                        updatedAt: new Date().toISOString(),
                      }
                    : o
                ),
              }
            : cat
        ),
      }));
    } catch {
      setReport(prev => ({
        ...prev,
        categories: prev.categories.map(cat =>
          cat.id === categoryId
            ? {
                ...cat,
                observations: cat.observations.map(o =>
                  o.id === obsId ? { ...o, aiProcessing: false } : o
                ),
              }
            : cat
        ),
      }));
    }
  }, []);

  const updateObservation = useCallback((categoryId: string, obsId: string, changes: Partial<Observation>) => {
    setReport(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              observations: cat.observations.map(o =>
                o.id === obsId ? { ...o, ...changes, updatedAt: new Date().toISOString() } : o
              ),
            }
          : cat
      ),
    }));
  }, []);

  const deleteObservation = useCallback((categoryId: string, obsId: string) => {
    setReport(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, observations: cat.observations.filter(o => o.id !== obsId) }
          : cat
      ),
    }));
  }, []);

  const addPhoto = useCallback((categoryId: string, obsId: string, photo: Photo) => {
    setReport(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              observations: cat.observations.map(o =>
                o.id === obsId ? { ...o, photos: [...o.photos, photo] } : o
              ),
            }
          : cat
      ),
    }));
  }, []);

  const deletePhoto = useCallback((categoryId: string, obsId: string, photoId: string) => {
    setReport(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              observations: cat.observations.map(o =>
                o.id === obsId ? { ...o, photos: o.photos.filter(p => p.id !== photoId) } : o
              ),
            }
          : cat
      ),
    }));
  }, []);

  const updateCategoryNotes = useCallback((categoryId: string, notes: string) => {
    setReport(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, notes } : cat
      ),
    }));
  }, []);

  const updateSummary = useCallback((findingsSummary: string, finalSummary: string) => {
    setReport(prev => ({
      ...prev,
      summary: {
        findingsSummary,
        finalSummary,
        generatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  return {
    report,
    updatePropertyInfo,
    addObservation,
    updateObservation,
    deleteObservation,
    addPhoto,
    deletePhoto,
    updateCategoryNotes,
    updateSummary,
    getBuildingContext,
  };
}
