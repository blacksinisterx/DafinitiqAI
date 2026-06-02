import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import type { AnalyticsSummary, BriefingResult } from '../types';

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

export default function Analytics() {
  const [stats, setStats] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState('');

  useEffect(() => {
    api.get<AnalyticsSummary>('/analytics/summary')
      .then(r => setStats(r.data))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const generateBriefing = async () => {
    setBriefingLoading(true); setBriefingError(''); setBriefing(null);
    try {
      const res = await api.post<BriefingResult>('/analytics/briefing');
      setBriefing(res.data);
    } catch (e) {
      setBriefingError((e as Error).message);
    } finally {
      setBriefingLoading(false);
    }
  };

  if (loading) return <div className="py-16 flex justify-center"><LoadingSpinner text="Loading analytics..." /></div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>;
  if (!stats) return null;

  const statusData = Object.entries(stats.ticketsByStatus).map(([name, value]) => ({ name, value }));
  const categoryData = Object.entries(stats.ticketsByCategory).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Analytics</h1>

      {/* AI Daily Briefing */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700 text-lg">AI Daily Briefing</h2>
          <button
            onClick={generateBriefing}
            disabled={briefingLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {briefingLoading ? <LoadingSpinner text="Generating..." /> : 'Generate Briefing'}
          </button>
        </div>
        {briefingError && <div className="text-red-600 text-sm mb-2">{briefingError}</div>}
        {briefing ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-gray-800 text-sm leading-relaxed mb-3">{briefing.briefing}</p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-400 border-t pt-2">
              <span>Generated: {new Date(briefing.generated_at).toLocaleString()}</span>
              <span>Model: {briefing.model}</span>
              <span>Latency: {briefing.latency_ms}ms</span>
            </div>
            <p className="text-xs text-yellow-600 mt-1">AI-generated summary — verify against raw data.</p>
          </div>
        ) : (
          !briefingLoading && <p className="text-sm text-gray-400">Click "Generate Briefing" to get an AI-powered summary of your support health.</p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tickets" value={stats.total} />
        <StatCard label="Open" value={stats.ticketsByStatus.open ?? 0} />
        <StatCard label="Escalation Rate" value={`${stats.escalationRate}%`} />
        <StatCard label="Avg Resolution" value={`${stats.avgResolutionTimeHours}h`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Tickets by Status — Pie */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Tickets by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Categories — Bar */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Tickets by Category</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Volume last 7 days */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Ticket Volume — Last 7 Days</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={stats.volumeLast7Days}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top 3 categories */}
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Top 3 Ticket Categories</h2>
        <div className="flex gap-4">
          {stats.topCategories.map((cat, i) => (
            <div key={cat} className="flex items-center gap-2 bg-gray-50 rounded px-4 py-2">
              <span className="text-gray-400 font-bold text-lg">#{i + 1}</span>
              <span className="capitalize font-medium text-gray-700">{cat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-blue-600">{value}</div>
    </div>
  );
}
