import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import type { Agent, Ticket } from '../types';

interface FormErrors { customer_name?: string; customer_email?: string; subject?: string; body?: string }

export default function NewTicket() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [form, setForm] = useState({ customer_name: '', customer_email: '', subject: '', body: '', assigned_agent_id: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Ticket | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.get<Agent[]>('/agents').then(r => setAgents(r.data)).catch(() => {});
  }, []);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.customer_name.trim()) e.customer_name = 'Name is required';
    else if (form.customer_name.length > 100) e.customer_name = 'Max 100 characters';
    if (!form.customer_email.trim()) e.customer_email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email)) e.customer_email = 'Invalid email';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    else if (form.subject.length > 200) e.subject = 'Max 200 characters';
    if (!form.body.trim()) e.body = 'Message is required';
    else if (form.body.length < 20) e.body = 'Minimum 20 characters';
    else if (form.body.length > 5000) e.body = 'Max 5000 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true); setSubmitError('');
    try {
      const payload: Record<string, unknown> = {
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        subject: form.subject,
        body: form.body,
      };
      if (form.assigned_agent_id) payload.assigned_agent_id = parseInt(form.assigned_agent_id);
      const res = await api.post<Ticket>('/tickets', payload);
      setCreated(res.data);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-green-600 text-xl mb-2">✓ Ticket Created!</div>
          <p className="text-gray-600 mb-1">Ticket <strong>#{created.id}</strong> has been submitted.</p>
          <p className="text-sm text-blue-600 mb-4">AI triage is running in the background and will classify this ticket shortly.</p>
          <div className="flex gap-3 justify-center">
            <Link to={`/tickets/${created.id}`} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition">View Ticket</Link>
            <button onClick={() => { setCreated(null); setForm({ customer_name: '', customer_email: '', subject: '', body: '', assigned_agent_id: '' }); }} className="border px-4 py-2 rounded text-sm hover:bg-gray-50 transition">Submit Another</button>
          </div>
        </div>
      </div>
    );
  }

  const field = (name: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
      <input
        type={type}
        value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors[name as keyof FormErrors] ? 'border-red-400' : ''}`}
      />
      {errors[name as keyof FormErrors] && <p className="text-red-500 text-xs mt-1">{errors[name as keyof FormErrors]}</p>}
    </div>
  );

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Submit New Ticket</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        {field('customer_name', 'Customer Name')}
        {field('customer_email', 'Customer Email', 'email')}
        {field('subject', 'Subject')}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={6}
            className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors.body ? 'border-red-400' : ''}`}
            placeholder="Describe your issue in detail (minimum 20 characters)..."
          />
          <div className="flex justify-between">
            {errors.body ? <p className="text-red-500 text-xs mt-1">{errors.body}</p> : <span />}
            <span className="text-xs text-gray-400">{form.body.length}/5000</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assign Agent (optional)</label>
          <select value={form.assigned_agent_id} onChange={e => setForm(f => ({ ...f, assigned_agent_id: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
            <option value="">Unassigned</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.team})</option>)}
          </select>
        </div>
        <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded">AI triage will run automatically in the background after submission.</div>
        {submitError && <div className="text-red-600 text-sm">{submitError}</div>}
        <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition">
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  );
}
