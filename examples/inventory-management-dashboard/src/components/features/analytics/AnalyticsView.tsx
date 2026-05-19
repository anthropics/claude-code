import React, { useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Route,
  CreditCard,
  DollarSign,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { calculateAnalytics, cn } from '../../../utils';
import type { Rate } from '../../../types';

interface AnalyticsViewProps {
  rates: Rate[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color }) => (
  <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-100">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{title}</p>
        <p className={cn('text-3xl font-black', color)}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={cn('p-3 rounded-xl', color.replace('text-', 'bg-').replace('-600', '-100'))}>
        {icon}
      </div>
    </div>
  </div>
);

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ rates }) => {
  const analytics = useMemo(() => calculateAnalytics(rates), [rates]);

  const paymentTypeData = useMemo(() => [
    { name: 'Наличный', value: analytics.ratesByPaymentType['Нал'] || 0 },
    { name: 'Безналичный', value: analytics.ratesByPaymentType['Безнал'] || 0 },
  ], [analytics]);

  const currencyData = useMemo(() => [
    { name: 'EUR', value: analytics.ratesByCurrency['EUR'] || 0 },
    { name: 'USD', value: analytics.ratesByCurrency['USD'] || 0 },
  ], [analytics]);

  if (rates.length === 0) {
    return (
      <div
        className="max-w-4xl mx-auto"
        role="tabpanel"
        id="analytics-panel"
        aria-labelledby="analytics-tab"
      >
        <div className="bg-white p-16 rounded-3xl shadow-xl border-2 border-gray-200 text-center">
          <BarChart3 className="mx-auto mb-4 text-gray-300" size={64} />
          <p className="text-xl text-slate-400 font-bold">Нет данных для анализа</p>
          <p className="text-sm text-slate-300 mt-2">
            Добавьте записи в базу данных для просмотра аналитики
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-6xl mx-auto space-y-6"
      role="tabpanel"
      id="analytics-panel"
      aria-labelledby="analytics-tab"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-blue-100 rounded-xl">
          <BarChart3 className="text-blue-600" size={28} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Аналитика и статистика</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Всего записей"
          value={analytics.totalRates}
          icon={<Package size={24} className="text-blue-600" />}
          color="text-blue-600"
        />
        <StatCard
          title="Средняя ставка"
          value={`${analytics.avgRate.toFixed(2)} €`}
          icon={<TrendingUp size={24} className="text-green-600" />}
          color="text-green-600"
        />
        <StatCard
          title="Уникальных маршрутов"
          value={analytics.totalRoutes}
          icon={<Route size={24} className="text-purple-600" />}
          color="text-purple-600"
        />
        <StatCard
          title="Наличных / Безнал"
          value={`${analytics.ratesByPaymentType['Нал'] || 0} / ${analytics.ratesByPaymentType['Безнал'] || 0}`}
          icon={<CreditCard size={24} className="text-orange-600" />}
          color="text-orange-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Payment Type Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            Распределение по типу оплаты
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {paymentTypeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Currency Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            Распределение по валюте
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={currencyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {currencyData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      {analytics.ratesByMonth.length > 1 && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            Активность по месяцам
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.ratesByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} name="Количество" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Routes */}
      {analytics.topRoutes.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-100">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
            Популярные маршруты
          </h3>
          <div className="space-y-3">
            {analytics.topRoutes.map((route, index) => (
              <div key={route.route} className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                    index === 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : index === 1
                      ? 'bg-gray-200 text-gray-700'
                      : index === 2
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-50 text-blue-600'
                  )}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{route.route || 'Без маршрута'}</p>
                  <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{
                        width: `${(route.count / analytics.topRoutes[0].count) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="font-bold text-blue-600">{route.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
