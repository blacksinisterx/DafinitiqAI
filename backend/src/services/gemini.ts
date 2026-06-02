import axios from 'axios';
import type { Database } from 'better-sqlite3';
import { TriageSchema, EscalationSchema, type TriageResult, type EscalationResult } from '../schemas/zod';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 15000;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  return key;
}

function getBackupApiKey(): string {
  const key = process.env.GEMINI_API_KEY_BACKUP;
  if (!key) throw new Error('GEMINI_API_KEY_BACKUP not set');
  return key;
}

function stripJsonMarkdown(text: string): string {
  return text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

async function callGeminiWithKey(prompt: string, apiKey: string): Promise<{ text: string; model: string; promptTokens: number; completionTokens: number }> {
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  };

  const response = await axios.post(url, body, { timeout: TIMEOUT_MS });
  const data = response.data;

  // Gemini 2.5 Flash may include thinking tokens in parts; find the non-thought part
  const parts: Array<{ text?: string; thought?: boolean }> = data?.candidates?.[0]?.content?.parts ?? [];
  const responsePart = parts.find(p => !p.thought) ?? parts[0];
  const text: string = responsePart?.text ?? '';
  const model: string = data?.modelVersion ?? GEMINI_MODEL;
  const promptTokens: number = data?.usageMetadata?.promptTokenCount ?? 0;
  const completionTokens: number = data?.usageMetadata?.candidatesTokenCount ?? 0;

  return { text, model, promptTokens, completionTokens };
}

export async function callGemini(prompt: string): Promise<{ text: string; model: string; promptTokens: number; completionTokens: number }> {
  try {
    return await callGeminiWithKey(prompt, getApiKey());
  } catch (primaryErr) {
    console.warn('[Gemini] Primary key failed, trying backup key:', (primaryErr as Error).message);
    try {
      return await callGeminiWithKey(prompt, getBackupApiKey());
    } catch (backupErr) {
      throw new Error(`Both Gemini API keys failed. Last error: ${(backupErr as Error).message}`);
    }
  }
}

export function logAiCall(
  db: Database,
  ticketId: number | null,
  action: 'triage' | 'draft_reply' | 'escalation' | 'analytics_briefing',
  model: string,
  promptTokens: number,
  completionTokens: number,
  latencyMs: number
): void {
  db.prepare(`
    INSERT INTO ai_logs (ticket_id, action, model, prompt_tokens, completion_tokens, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ticketId, action, model, promptTokens, completionTokens, latencyMs);
}

// ── Prompt Builders ──────────────────────────────────────────────────────────

export function buildTriagePrompt(subject: string, body: string): string {
  return `You are a customer support AI. Analyze this support ticket and respond ONLY with valid JSON matching this exact schema:
{"category": "billing|technical|account|general", "priority": "low|medium|high|critical", "sentiment": "positive|neutral|negative|angry", "triage_summary": "one sentence summary of the issue"}

Ticket subject: ${subject}
Ticket body: ${body}

Rules for priority:
- critical: service completely down, data loss, legal/compliance issues, account suspended
- high: significant functionality broken, billing overcharge, account access issues
- medium: partial functionality issues, integration problems
- low: questions, feature requests, minor issues

Respond with JSON only. No explanation, no markdown code fences, just the JSON object.`;
}

export function buildDraftReplyPrompt(
  customerName: string,
  subject: string,
  body: string,
  category: string | null,
  priority: string | null,
  previousReplies: Array<{ author_type: string; body: string }>
): string {
  const repliesText = previousReplies.length > 0
    ? previousReplies.map(r => `[${r.author_type}]: ${r.body}`).join('\n\n')
    : 'No previous replies.';

  return `You are a helpful customer support agent. Write a polite, professional, empathetic reply to this customer support ticket.
Be concise and solution-focused. Do not include a subject line or greeting — start with the message content directly.

Customer name: ${customerName}
Subject: ${subject}
Category: ${category ?? 'general'}
Priority: ${priority ?? 'medium'}

Customer message:
${body}

Previous replies in this thread:
${repliesText}

Write only the reply body. Be helpful and professional.`;
}

export function buildEscalationPrompt(
  subject: string,
  body: string,
  category: string | null,
  priority: string | null,
  sentiment: string | null,
  hoursOpen: number
): string {
  return `You are a support escalation AI. Evaluate whether this ticket needs escalation to a specialist team.
Respond ONLY with valid JSON: {"should_escalate": true or false, "reason": "clear explanation string", "suggested_team": "billing-ops|engineering|management"}

Ticket details:
- Subject: ${subject}
- Category: ${category ?? 'general'}
- Priority: ${priority ?? 'medium'}
- Sentiment: ${sentiment ?? 'neutral'}
- Hours open without resolution: ${hoursOpen.toFixed(1)}
- Body: ${body}

Escalation rules (escalate if ANY of these are true):
- Priority is "critical"
- Sentiment is "angry" AND priority is "high" or "critical"
- Ticket has been open for more than 48 hours without resolution
- Category is "billing" and involves refunds or legal threats
- Account suspension or data loss reported

Suggested team mapping:
- billing-ops: for billing, payment, refund, invoice issues
- engineering: for technical, API, integration, outage issues
- management: for account suspension, legal threats, VIP customers, complaints about support

Respond with JSON only. No markdown, no explanation.`;
}

export function buildAnalyticsBriefingPrompt(stats: {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  escalationRate: number;
  avgResolutionHours: number;
  volumeLast7Days: Array<{ date: string; count: number }>;
  topCategories: string[];
}): string {
  const volumeStr = stats.volumeLast7Days.map(d => `${d.date}: ${d.count}`).join(', ');
  return `You are a support operations analyst. Write a 3-5 sentence plain English briefing for a support manager reviewing today's support health.
Cover: current ticket health, notable trends, and one specific recommended action.

Current statistics:
- Total tickets: ${stats.total}
- By status: open=${stats.byStatus.open ?? 0}, in-progress=${stats.byStatus['in-progress'] ?? 0}, resolved=${stats.byStatus.resolved ?? 0}, escalated=${stats.byStatus.escalated ?? 0}
- Top categories: ${stats.topCategories.join(', ')}
- Escalation rate: ${stats.escalationRate.toFixed(1)}%
- Average resolution time: ${stats.avgResolutionHours.toFixed(1)} hours
- Ticket volume last 7 days: ${volumeStr}

Write a concise, actionable briefing paragraph for a manager. Plain text only, no bullet points, no headers.`;
}

// ── High-level AI action functions ───────────────────────────────────────────

export async function triageTicket(
  db: Database,
  ticket: { id: number; subject: string; body: string }
): Promise<TriageResult & { model: string; latency_ms: number }> {
  const prompt = buildTriagePrompt(ticket.subject, ticket.body);
  const start = Date.now();
  const { text, model, promptTokens, completionTokens } = await callGemini(prompt);
  const latencyMs = Date.now() - start;

  const parsed = JSON.parse(stripJsonMarkdown(text));
  const validated = TriageSchema.parse(parsed);

  logAiCall(db, ticket.id, 'triage', model, promptTokens, completionTokens, latencyMs);

  return { ...validated, model, latency_ms: latencyMs };
}

export async function draftReply(
  db: Database,
  ticket: { id: number; customer_name: string; subject: string; body: string; category: string | null; priority: string | null },
  replies: Array<{ author_type: string; body: string }>
): Promise<{ draft: string; model: string; latency_ms: number }> {
  const prompt = buildDraftReplyPrompt(
    ticket.customer_name,
    ticket.subject,
    ticket.body,
    ticket.category,
    ticket.priority,
    replies
  );
  const start = Date.now();
  const { text, model, promptTokens, completionTokens } = await callGemini(prompt);
  const latencyMs = Date.now() - start;

  if (!text || text.trim().length === 0) throw new Error('Gemini returned empty draft');

  logAiCall(db, ticket.id, 'draft_reply', model, promptTokens, completionTokens, latencyMs);

  return { draft: text.trim(), model, latency_ms: latencyMs };
}

export async function assessEscalation(
  db: Database,
  ticket: { id: number; subject: string; body: string; category: string | null; priority: string | null; sentiment: string | null; created_at: string }
): Promise<EscalationResult & { model: string; latency_ms: number }> {
  const createdAt = new Date(ticket.created_at.replace(' ', 'T'));
  const hoursOpen = (Date.now() - createdAt.getTime()) / 3600000;

  const prompt = buildEscalationPrompt(
    ticket.subject,
    ticket.body,
    ticket.category,
    ticket.priority,
    ticket.sentiment,
    hoursOpen
  );
  const start = Date.now();
  const { text, model, promptTokens, completionTokens } = await callGemini(prompt);
  const latencyMs = Date.now() - start;

  const parsed = JSON.parse(stripJsonMarkdown(text));
  const validated = EscalationSchema.parse(parsed);

  logAiCall(db, ticket.id, 'escalation', model, promptTokens, completionTokens, latencyMs);

  return { ...validated, model, latency_ms: latencyMs };
}

export async function generateAnalyticsBriefing(
  db: Database,
  stats: Parameters<typeof buildAnalyticsBriefingPrompt>[0]
): Promise<{ briefing: string; model: string; latency_ms: number; generated_at: string }> {
  const prompt = buildAnalyticsBriefingPrompt(stats);
  const start = Date.now();
  const { text, model, promptTokens, completionTokens } = await callGemini(prompt);
  const latencyMs = Date.now() - start;

  const briefing = text.trim();
  if (briefing.length < 50) throw new Error('Gemini returned insufficient briefing text');

  logAiCall(db, null, 'analytics_briefing', model, promptTokens, completionTokens, latencyMs);

  return { briefing, model, latency_ms: latencyMs, generated_at: new Date().toISOString() };
}
