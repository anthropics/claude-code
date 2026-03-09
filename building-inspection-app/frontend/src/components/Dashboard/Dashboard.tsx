import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, FileText, Clock, CheckCircle, AlertCircle, Trash2,
  Building2, ChevronRight, Copy
} from 'lucide-react';
import { getAllReports, createReport, deleteReport, duplicateReport } from '../../services/storage';
import { InspectionReport } from '../../types';
import { Button } from '../UI/Button';

const statusConfig = {
  draft: { label: 'Luonnos', color: 'text-gray-500 bg-gray-100', icon: FileText },
  in_progress: { label: 'Kesken', color: 'text-amber-600 bg-amber-50', icon: Clock },
  review: { label: 'Tarkistuksessa', color: 'text-blue-600 bg-blue-50', icon: AlertCircle },
  completed: { label: 'Valmis', color: 'text-green-600 bg-green-50', icon: CheckCircle },
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('fi-FI', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getObservationCount(report: InspectionReport): number {
  return report.categories.reduce((sum, cat) => sum + cat.observations.length, 0);
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setReports(getAllReports());
  }, []);

  const handleCreate = () => {
    const report = createReport();
    navigate(`/report/${report.id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Haluatko varmasti poistaa tämän raportin? Tätä ei voi peruuttaa.')) {
      setDeletingId(id);
      deleteReport(id);
      setReports(getAllReports());
      setDeletingId(null);
    }
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const copy = duplicateReport(id);
    if (copy) {
      setReports(getAllReports());
      navigate(`/report/${copy.id}`);
    }
  };

  const stats = {
    total: reports.length,
    completed: reports.filter(r => r.status === 'completed').length,
    inProgress: reports.filter(r => r.status === 'in_progress').length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kuntotarkastukset</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Hallinnoi ja luo ammattimaisia kuntotarkastusraportteja tekoälyn avulla
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          icon={<Plus size={18} />}
          onClick={handleCreate}
        >
          Uusi tarkastus
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Yhteensä', value: stats.total, color: 'text-gray-700' },
          { label: 'Valmiita', value: stats.completed, color: 'text-green-600' },
          { label: 'Kesken', value: stats.inProgress, color: 'text-amber-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Report list */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 border-dashed p-16 text-center">
          <Building2 size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Ei vielä yhtään tarkastusta
          </h3>
          <p className="text-gray-400 text-sm mb-6">
            Aloita luomalla uusi kuntotarkastus. Tekoäly auttaa sinua joka vaiheessa.
          </p>
          <Button variant="primary" icon={<Plus size={16} />} onClick={handleCreate}>
            Aloita ensimmäinen tarkastus
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => {
            const status = statusConfig[report.status];
            const StatusIcon = status.icon;
            const obsCount = getObservationCount(report);
            const address = report.propertyInfo.address
              ? `${report.propertyInfo.address}${report.propertyInfo.city ? `, ${report.propertyInfo.city}` : ''}`
              : 'Osoite puuttuu';

            return (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(`/report/${report.id}`)}
              >
                <div className="p-5 flex items-center gap-4">
                  {/* Icon */}
                  <div className="bg-blue-50 text-blue-600 p-3 rounded-xl flex-shrink-0">
                    <Building2 size={22} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{address}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${status.color}`}>
                        <StatusIcon size={11} />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{report.propertyInfo.buildingType || 'Rakennus'}</span>
                      <span>·</span>
                      <span>{obsCount} havaintoa</span>
                      <span>·</span>
                      <span>{formatDate(report.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDuplicate(e, report.id)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Kopioi raportti"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, report.id)}
                      disabled={deletingId === report.id}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Poista raportti"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
