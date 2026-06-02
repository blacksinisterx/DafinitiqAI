export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'escalated';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketCategory = 'billing' | 'technical' | 'account' | 'general';
export type TicketSentiment = 'positive' | 'neutral' | 'negative' | 'angry';

export interface Agent {
  id: number;
  name: string;
  email: string;
  team: string;
  created_at: string;
}

export interface Reply {
  id: number;
  ticket_id: number;
  author_type: 'agent' | 'ai_draft';
  body: string;
  is_ai_draft: number;
  created_at: string;
}

export interface Ticket {
  id: number;
  customer_name: string;
  customer_email: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority | null;
  category: TicketCategory | null;
  sentiment: TicketSentiment | null;
  triage_summary: string | null;
  assigned_agent_id: number | null;
  agent_name: string | null;
  escalated_to: string | null;
  created_at: string;
  updated_at: string;
  replies?: Reply[];
}

export interface PaginatedTickets {
  data: Ticket[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface TriageResult {
  category: TicketCategory;
  priority: TicketPriority;
  sentiment: TicketSentiment;
  triage_summary: string;
  model: string;
  latency_ms: number;
}

export interface DraftReplyResult {
  draft: string;
  model: string;
  latency_ms: number;
}

export interface EscalationResult {
  should_escalate: boolean;
  reason: string;
  suggested_team: 'billing-ops' | 'engineering' | 'management';
  model: string;
  latency_ms: number;
}

export interface AnalyticsSummary {
  total: number;
  ticketsByStatus: Record<string, number>;
  ticketsByCategory: Record<string, number>;
  topCategories: string[];
  volumeLast7Days: Array<{ date: string; count: number }>;
  escalationRate: number;
  avgResolutionTimeHours: number;
}

export interface BriefingResult {
  briefing: string;
  model: string;
  latency_ms: number;
  generated_at: string;
}

export interface AgentDashboard {
  agent: Agent;
  byStatus: Record<string, number>;
  weekTickets: number;
  byCategory: Record<string, number>;
  avgResponseHours: number | null;
  tickets: Ticket[];
}
