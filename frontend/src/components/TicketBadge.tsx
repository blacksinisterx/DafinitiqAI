import type { TicketStatus, TicketPriority, TicketSentiment } from '../types';

const statusColors: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  escalated: 'bg-red-100 text-red-800',
};

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700 font-bold',
};

const sentimentColors: Record<TicketSentiment, string> = {
  positive: 'bg-green-50 text-green-700',
  neutral: 'bg-gray-100 text-gray-600',
  negative: 'bg-orange-50 text-orange-700',
  angry: 'bg-red-100 text-red-700',
};

interface BadgeProps { value: string; type: 'status' | 'priority' | 'sentiment' | 'category' }

export function Badge({ value, type }: BadgeProps) {
  let cls = 'bg-gray-100 text-gray-700';
  if (type === 'status') cls = statusColors[value as TicketStatus] ?? cls;
  else if (type === 'priority') cls = priorityColors[value as TicketPriority] ?? cls;
  else if (type === 'sentiment') cls = sentimentColors[value as TicketSentiment] ?? cls;

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs capitalize ${cls}`}>
      {value}
    </span>
  );
}
