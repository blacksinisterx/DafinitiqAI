import { z } from 'zod';

// Gemini response validators
export const TriageSchema = z.object({
  category: z.enum(['billing', 'technical', 'account', 'general']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'angry']),
  triage_summary: z.string().min(1).max(500),
});

export const EscalationSchema = z.object({
  should_escalate: z.boolean(),
  reason: z.string().min(1),
  suggested_team: z.enum(['billing-ops', 'engineering', 'management']),
});

// API request validators
export const CreateTicketSchema = z.object({
  customer_name: z.string().min(1).max(100),
  customer_email: z.string().email().max(200),
  subject: z.string().min(1).max(200),
  body: z.string().min(20).max(5000),
  assigned_agent_id: z.number().int().positive().optional().nullable(),
});

export const PatchTicketSchema = z.object({
  status: z.enum(['open', 'in-progress', 'resolved', 'escalated']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assigned_agent_id: z.number().int().positive().nullable().optional(),
  escalated_to: z.enum(['billing-ops', 'engineering', 'management']).nullable().optional(),
});

export const CreateReplySchema = z.object({
  body: z.string().min(1).max(5000),
  author_type: z.enum(['agent', 'ai_draft']).default('agent'),
});

export type TriageResult = z.infer<typeof TriageSchema>;
export type EscalationResult = z.infer<typeof EscalationSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type PatchTicketInput = z.infer<typeof PatchTicketSchema>;
export type CreateReplyInput = z.infer<typeof CreateReplySchema>;
