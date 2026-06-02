import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Badge } from '../components/TicketBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Agent, AgentDashboard as DashData } from '../types';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [dash, setDash] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Agent[]>('/agents').then(r => {
      setAgents(r.data);
      if (r.data.length > 0) setSelectedId(String(r.data[0].id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true); setError('');
    api.get<DashData>(`/agents/${selectedId}/dashboard`)
      .then(r => setDash(r.data))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const statusOrder = ['open', 'in-progress', 'resolved', 'escalated'];

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Agent Dashboard</h1>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          {agents.map(a => <option key={a.id} value={a.id}>{a.name} — {a.team}</option>)}
        </select>
      </div>

      {loading && <div className="py-12 flex justify-center"><LoadingSpinner text="Loading dashboard..." /></div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

      {!loading && dash && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Open Tickets" value={dash.byStatus.open ?? 0} color="blue" />
            <StatCard label="In Progress" value={dash.byStatus['in-progress'] ?? 0} color="yellow" />
            <StatCard label="Resolved This Week" value={dash.weekTickets} color="green" />
            <StatCard label="Avg Response" value={dash.avgResponseHours != null ? `${dash.avgResponseHours}h` : '—'} color="gray" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Status breakdown */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Tickets by Status</h2>
              <div className="space-y-2">
                {statusOrder.map(s => (
                  <div key={s} className="flex items-center justify-between">
                    <Badge value={s} type="status" />
                    <span className="font-semibold text-gray-700">{dash.byStatus[s] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Category Breakdown</h2>
              {Object.keys(dash.byCategory).length === 0
                ? <p className="text-sm text-gray-400">No categorized tickets</p>
                : (
                  <div className="space-y-2">
                    {Object.entries(dash.byCategory).map(([cat, count]) => (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-gray-600">{cat}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 bg-blue-400 rounded" style={{ width: `${Math.max(4, count * 20)}px` }} />
                          <span className="font-semibold text-gray-700 w-6 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Assigned tickets table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Assigned Tickets</h2>
              <span className="text-sm text-gray-400">{dash.tickets.length} tickets</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID', 'Subject', 'Status', 'Priority', 'Created'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {dash.tickets.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-gray-400">No tickets assigned</td></tr>}
                {dash.tickets.map(t => (
                  <tr key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="hover:bg-blue-50 cursor-pointer transition">
                    <td className="px-4 py-2 text-gray-400 font-mono">#{t.id}</td>
                    <td className="px-4 py-2 max-w-xs"><div className="truncate">{t.subject}</div></td>
                    <td className="px-4 py-2"><Badge value={t.status} type="status" /></td>
                    <td className="px-4 py-2">{t.priority ? <Badge value={t.priority} type="priority" /> : '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = { blue: 'text-blue-600', yellow: 'text-yellow-600', green: 'text-green-600', gray: 'text-gray-600' };
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[color] ?? 'text-gray-600'}`}>{value}</div>
    </div>
  );
}
