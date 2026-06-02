import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Badge } from '../components/TicketBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Ticket, TriageResult, DraftReplyResult, EscalationResult, Agent } from '../types';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);

  // Ticket update controls
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAgent, setUpdatingAgent] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  // Triage
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState('');

  // Draft reply
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftMeta, setDraftMeta] = useState<{ model: string; latency_ms: number } | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replySent, setReplySent] = useState(false);

  // Escalation
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [escalationError, setEscalationError] = useState('');
  const [escalationResult, setEscalationResult] = useState<EscalationResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchTicket = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<Ticket>(`/tickets/${id}`);
      setTicket(res.data);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchTicket();
    api.get<Agent[]>('/agents').then(r => setAgents(r.data)).catch(() => {});
  }, [id]);

  const patchTicket = async (patch: Record<string, unknown>) => {
    const res = await api.patch<Ticket>(`/tickets/${id}`, patch);
    setTicket(res.data);
  };

  const updateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try { await patchTicket({ status: newStatus }); }
    catch (e) { setError((e as Error).message); }
    finally { setUpdatingStatus(false); }
  };

  const updateAgent = async (agentId: string) => {
    setUpdatingAgent(true);
    try { await patchTicket({ assigned_agent_id: agentId ? parseInt(agentId) : null }); }
    catch (e) { setError((e as Error).message); }
    finally { setUpdatingAgent(false); }
  };

  const updatePriority = async (priority: string) => {
    setUpdatingPriority(true);
    try { await patchTicket({ priority }); }
    catch (e) { setError((e as Error).message); }
    finally { setUpdatingPriority(false); }
  };

  const runTriage = async () => {
    setTriageLoading(true); setTriageError('');
    try {
      const res = await api.post<TriageResult>(`/tickets/${id}/triage`);
      setTicket(prev => prev ? { ...prev, ...res.data } : prev);
    } catch (e) { setTriageError((e as Error).message); }
    finally { setTriageLoading(false); }
  };

  const getDraft = async () => {
    setDraftLoading(true); setDraftError(''); setDraftText(''); setReplySent(false);
    try {
      const res = await api.post<DraftReplyResult>(`/tickets/${id}/draft-reply`);
      setDraftText(res.data.draft);
      setDraftMeta({ model: res.data.model, latency_ms: res.data.latency_ms });
    } catch (e) { setDraftError((e as Error).message); }
    finally { setDraftLoading(false); }
  };

  const sendReply = async () => {
    if (!draftText.trim()) return;
    setSendingReply(true);
    try {
      await api.post(`/tickets/${id}/replies`, { body: draftText, author_type: 'agent' });
      setReplySent(true);
      setDraftText('');
      setDraftMeta(null);
      fetchTicket();
    } catch (e) { setDraftError((e as Error).message); }
    finally { setSendingReply(false); }
  };

  const assessEscalation = async () => {
    setEscalationLoading(true); setEscalationError(''); setEscalationResult(null);
    try {
      const res = await api.post<EscalationResult>(`/tickets/${id}/assess-escalation`);
      setEscalationResult(res.data);
    } catch (e) { setEscalationError((e as Error).message); }
    finally { setEscalationLoading(false); }
  };

  const confirmEscalation = async () => {
    if (!escalationResult) return;
    setConfirming(true);
    try {
      await patchTicket({ status: 'escalated', escalated_to: escalationResult.suggested_team });
      setEscalationResult(null);
    } catch (e) { setEscalationError((e as Error).message); }
    finally { setConfirming(false); }
  };

  if (loading) return <div className="py-16 flex justify-center"><LoadingSpinner text="Loading ticket..." /></div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>;
  if (!ticket) return null;

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate('/tickets')} className="text-blue-600 text-sm mb-4 hover:underline">← Back to Inbox</button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <h1 className="text-xl font-bold text-gray-800">{ticket.subject}</h1>
          <span className="text-gray-400 text-sm font-mono">#{ticket.id}</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge value={ticket.status} type="status" />
          {ticket.priority && <Badge value={ticket.priority} type="priority" />}
          {ticket.category && <Badge value={ticket.category} type="category" />}
          {ticket.sentiment && <Badge value={ticket.sentiment} type="sentiment" />}
        </div>

        {/* Editable controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 pb-4 border-b">
          {/* Status update */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Status</label>
            <div className="flex gap-1 flex-wrap">
              {(['open', 'in-progress', 'resolved', 'escalated'] as const).map(s => (
                <button
                  key={s}
                  disabled={updatingStatus || ticket.status === s}
                  onClick={() => updateStatus(s)}
                  className={`text-xs px-2 py-1 rounded border transition ${ticket.status === s ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50 border-gray-300'} disabled:opacity-40`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Priority override */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Priority (override)</label>
            <select
              value={ticket.priority ?? ''}
              onChange={e => updatePriority(e.target.value)}
              disabled={updatingPriority}
              className="w-full text-sm border rounded px-2 py-1 disabled:opacity-40"
            >
              <option value="">— not set —</option>
              {['low', 'medium', 'high', 'critical'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Agent assignment */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Assigned Agent</label>
            <select
              value={ticket.assigned_agent_id ?? ''}
              onChange={e => updateAgent(e.target.value)}
              disabled={updatingAgent}
              className="w-full text-sm border rounded px-2 py-1 disabled:opacity-40"
            >
              <option value="">Unassigned</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-1">
          From: <span className="font-medium text-gray-700">{ticket.customer_name}</span> ({ticket.customer_email})
        </div>
        {ticket.escalated_to && (
          <div className="text-sm text-orange-600 font-medium mt-1">Escalated to: {ticket.escalated_to}</div>
        )}
        {ticket.triage_summary && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm text-blue-800">
            <span className="font-semibold">AI Triage Summary:</span> {ticket.triage_summary}
          </div>
        )}
        <div className="mt-3 bg-gray-50 rounded p-4 text-sm text-gray-700 whitespace-pre-wrap border">
          {ticket.body}
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Created: {new Date(ticket.created_at).toLocaleString()} · Updated: {new Date(ticket.updated_at).toLocaleString()}
        </div>
      </div>

      {/* Reply Thread */}
      {ticket.replies && ticket.replies.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">Message Thread ({ticket.replies.length})</h2>
          <div className="space-y-3">
            {ticket.replies.map(r => (
              <div key={r.id} className={`rounded p-3 text-sm border ${r.author_type === 'ai_draft' ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold capitalize text-gray-600">
                    {r.author_type === 'ai_draft' ? 'AI Draft' : 'Agent'}
                    {r.is_ai_draft === 1 && <span className="ml-1 text-xs text-purple-500">(AI generated)</span>}
                  </span>
                  <span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Actions */}
      <div className="grid grid-cols-1 gap-4">

        {/* Triage Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-3">AI Triage <span className="text-xs font-normal text-blue-500 ml-1">Gemini Integration Point #1</span></h2>
          {ticket.category ? (
            <div className="grid grid-cols-3 gap-3 mb-3 text-sm bg-gray-50 rounded p-3 border">
              <div><div className="text-xs text-gray-400 mb-1">Category</div><Badge value={ticket.category} type="category" /></div>
              <div><div className="text-xs text-gray-400 mb-1">Priority</div>{ticket.priority ? <Badge value={ticket.priority} type="priority" /> : '—'}</div>
              <div><div className="text-xs text-gray-400 mb-1">Sentiment</div>{ticket.sentiment ? <Badge value={ticket.sentiment} type="sentiment" /> : '—'}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-3">No triage data yet. Run AI triage to classify this ticket automatically.</p>
          )}
          {triageError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded mb-2">{triageError}</div>}
          <button
            onClick={runTriage}
            disabled={triageLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {triageLoading ? <LoadingSpinner text="Analysing ticket..." /> : (ticket.category ? 'Re-run AI Triage' : 'Run AI Triage')}
          </button>
          <p className="text-xs text-gray-400 mt-2">AI-analyzed classification — review before relying on results.</p>
        </div>

        {/* Draft Reply Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-3">AI Draft Reply <span className="text-xs font-normal text-blue-500 ml-1">Gemini Integration Point #2</span></h2>
          {draftError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded mb-2">{draftError}</div>}
          {replySent && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded mb-2">✓ Reply sent and saved to thread.</div>}
          {draftText ? (
            <div>
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2 rounded mb-2 flex justify-between flex-wrap gap-1">
                <span>⚠️ AI-generated draft — review before sending.</span>
                {draftMeta && <span className="text-yellow-500">Model: {draftMeta.model} · {draftMeta.latency_ms}ms</span>}
              </div>
              <textarea
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                rows={7}
                className="w-full border rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={sendReply} disabled={sendingReply} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">
                  {sendingReply ? 'Sending...' : 'Send Reply'}
                </button>
                <button onClick={() => { setDraftText(''); setDraftMeta(null); }} className="border px-4 py-2 rounded text-sm hover:bg-gray-50 transition">Discard</button>
              </div>
            </div>
          ) : (
            <button onClick={getDraft} disabled={draftLoading} className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition flex items-center gap-2">
              {draftLoading ? <LoadingSpinner text="Drafting reply with Gemini..." /> : 'Draft AI Reply'}
            </button>
          )}
        </div>

        {/* Escalation Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold text-gray-700 mb-3">Escalation Assessment <span className="text-xs font-normal text-blue-500 ml-1">Gemini Integration Point #3</span></h2>
          {escalationError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded mb-2">{escalationError}</div>}

          {ticket.status === 'escalated' && (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm px-3 py-2 rounded mb-3">
              This ticket is already escalated to <strong>{ticket.escalated_to}</strong>.
            </div>
          )}

          {escalationResult ? (
            <div className="text-sm">
              <div className={`rounded p-4 mb-3 border ${escalationResult.should_escalate ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="font-semibold mb-2 text-base">
                  {escalationResult.should_escalate ? '⚠️ Escalation Recommended' : '✓ No Escalation Needed'}
                </div>
                <div className="text-gray-700 mb-2">{escalationResult.reason}</div>
                {escalationResult.should_escalate && (
                  <div className="text-orange-700 font-medium">Suggested team: <strong>{escalationResult.suggested_team}</strong></div>
                )}
                <div className="text-xs text-gray-400 mt-2">Model: {escalationResult.model} · {escalationResult.latency_ms}ms</div>
              </div>
              <div className="flex gap-2">
                {escalationResult.should_escalate && ticket.status !== 'escalated' && (
                  <button onClick={confirmEscalation} disabled={confirming} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">
                    {confirming ? 'Escalating...' : 'Confirm Escalation'}
                  </button>
                )}
                <button onClick={() => setEscalationResult(null)} className="border px-4 py-2 rounded text-sm hover:bg-gray-50 transition">Dismiss</button>
              </div>
            </div>
          ) : (
            <button onClick={assessEscalation} disabled={escalationLoading} className="bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition flex items-center gap-2">
              {escalationLoading ? <LoadingSpinner text="Assessing with Gemini..." /> : 'Assess Escalation'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
