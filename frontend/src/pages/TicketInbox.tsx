import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Badge } from '../components/TicketBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Ticket, PaginatedTickets } from '../types';

const STATUSES = ['all', 'open', 'in-progress', 'resolved', 'escalated'];
const PRIORITIES = ['all', 'low', 'medium', 'high', 'critical'];

export default function TicketInbox() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit: 15, sort, order };
      if (status !== 'all') params.status = status;
      if (priority !== 'all') params.priority = priority;
      const res = await api.get<PaginatedTickets>('/tickets', { params });
      setTickets(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, status, priority, sort, order]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Ticket Inbox</h1>
        <button
          onClick={() => navigate('/tickets/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + New Ticket
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Status:</label>
          <select value={status} onChange={handleFilterChange(setStatus)} className="text-sm border rounded px-2 py-1">
            {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Priority:</label>
          <select value={priority} onChange={handleFilterChange(setPriority)} className="text-sm border rounded px-2 py-1">
            {PRIORITIES.map(p => <option key={p} value={p}>{p === 'all' ? 'All Priorities' : p}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sort:</label>
          <select value={sort} onChange={handleFilterChange(setSort)} className="text-sm border rounded px-2 py-1">
            <option value="date">Date</option>
            <option value="priority">Priority</option>
          </select>
          <select value={order} onChange={handleFilterChange(setOrder)} className="text-sm border rounded px-2 py-1">
            <option value="desc">Newest / High first</option>
            <option value="asc">Oldest / Low first</option>
          </select>
        </div>
      </div>

      {loading && <div className="py-8 flex justify-center"><LoadingSpinner /></div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['ID', 'Customer', 'Subject', 'Status', 'Priority', 'Agent', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No tickets found</td></tr>
                )}
                {tickets.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className="hover:bg-blue-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 text-gray-400 font-mono">#{t.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{t.customer_name}</div>
                      <div className="text-gray-400 text-xs">{t.customer_email}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="truncate text-gray-700">{t.subject}</div>
                    </td>
                    <td className="px-4 py-3"><Badge value={t.status} type="status" /></td>
                    <td className="px-4 py-3">{t.priority ? <Badge value={t.priority} type="priority" /> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{t.agent_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-500">{pagination.total} total tickets</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100 transition"
              >Prev</button>
              <span className="text-sm text-gray-600">Page {page} of {pagination.totalPages}</span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100 transition"
              >Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
