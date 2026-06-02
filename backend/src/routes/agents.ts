import { Router, Request, Response } from 'express';
import type { Database } from 'better-sqlite3';

export function createAgentRouter(db: Database): Router {
  const router = Router();

  // GET /api/agents
  router.get('/', (_req: Request, res: Response) => {
    try {
      const agents = db.prepare('SELECT * FROM agents ORDER BY name ASC').all();
      res.json(agents);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  });

  // GET /api/agents/:id/dashboard
  router.get('/:id/dashboard', (req: Request, res: Response) => {
    const agentId = req.params.id;
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    try {
      // Tickets by status for this agent
      const byStatus = db.prepare(`
        SELECT status, COUNT(*) as count FROM tickets WHERE assigned_agent_id = ? GROUP BY status
      `).all(agentId) as Array<{ status: string; count: number }>;

      // Total tickets this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const weekTickets = (db.prepare(`
        SELECT COUNT(*) as count FROM tickets
        WHERE assigned_agent_id = ? AND created_at >= ?
      `).get(agentId, weekStart.toISOString().replace('T', ' ').slice(0, 19)) as { count: number }).count;

      // Category breakdown
      const byCategory = db.prepare(`
        SELECT category, COUNT(*) as count FROM tickets
        WHERE assigned_agent_id = ? AND category IS NOT NULL GROUP BY category
      `).all(agentId) as Array<{ category: string; count: number }>;

      // Average response time (hours from ticket creation to first reply)
      const avgResponse = (db.prepare(`
        SELECT AVG((julianday(r.created_at) - julianday(t.created_at)) * 24) as avg_hours
        FROM replies r
        JOIN tickets t ON r.ticket_id = t.id
        WHERE t.assigned_agent_id = ? AND r.author_type = 'agent'
          AND r.id = (SELECT MIN(id) FROM replies WHERE ticket_id = t.id AND author_type = 'agent')
      `).get(agentId) as { avg_hours: number | null }).avg_hours;

      // Assigned tickets list
      const tickets = db.prepare(`
        SELECT t.*, a.name as agent_name FROM tickets t
        LEFT JOIN agents a ON t.assigned_agent_id = a.id
        WHERE t.assigned_agent_id = ? ORDER BY t.created_at DESC LIMIT 50
      `).all(agentId);

      res.json({
        agent,
        byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
        weekTickets,
        byCategory: Object.fromEntries(byCategory.map(r => [r.category, r.count])),
        avgResponseHours: avgResponse != null ? Math.round(avgResponse * 10) / 10 : null,
        tickets,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
  });

  return router;
}
