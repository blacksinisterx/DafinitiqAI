import { Router, Request, Response } from 'express';
import type { Database } from 'better-sqlite3';
import { generateAnalyticsBriefing } from '../services/gemini';

export function createAnalyticsRouter(db: Database): Router {
  const router = Router();

  // GET /api/analytics/summary
  router.get('/summary', (_req: Request, res: Response) => {
    try {
      // Tickets by status
      const byStatusRows = db.prepare(`SELECT status, COUNT(*) as count FROM tickets GROUP BY status`).all() as Array<{ status: string; count: number }>;
      const ticketsByStatus: Record<string, number> = { open: 0, 'in-progress': 0, resolved: 0, escalated: 0 };
      for (const row of byStatusRows) ticketsByStatus[row.status] = row.count;

      const total = Object.values(ticketsByStatus).reduce((a, b) => a + b, 0);

      // Tickets by category
      const byCategoryRows = db.prepare(`SELECT category, COUNT(*) as count FROM tickets WHERE category IS NOT NULL GROUP BY category`).all() as Array<{ category: string; count: number }>;
      const ticketsByCategory: Record<string, number> = { billing: 0, technical: 0, account: 0, general: 0 };
      for (const row of byCategoryRows) ticketsByCategory[row.category] = row.count;

      // Top 3 categories
      const topCategories = [...byCategoryRows].sort((a, b) => b.count - a.count).slice(0, 3).map(r => r.category);

      // Volume last 7 days
      const volumeLast7Days: Array<{ date: string; count: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const count = (db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE date(created_at) = ?`).get(dateStr) as { count: number }).count;
        volumeLast7Days.push({ date: dateStr, count });
      }

      // Escalation rate
      const escalationRate = total > 0 ? (ticketsByStatus.escalated / total) * 100 : 0;

      // Average resolution time
      const avgRow = db.prepare(`
        SELECT AVG((julianday(updated_at) - julianday(created_at)) * 24) as avg_hours
        FROM tickets WHERE status = 'resolved'
      `).get() as { avg_hours: number | null };
      const avgResolutionTimeHours = avgRow.avg_hours != null ? Math.round(avgRow.avg_hours * 10) / 10 : 0;

      res.json({
        total,
        ticketsByStatus,
        ticketsByCategory,
        topCategories,
        volumeLast7Days,
        escalationRate: Math.round(escalationRate * 10) / 10,
        avgResolutionTimeHours,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // POST /api/analytics/briefing
  router.post('/briefing', async (_req: Request, res: Response) => {
    try {
      // Get summary stats
      const byStatusRows = db.prepare(`SELECT status, COUNT(*) as count FROM tickets GROUP BY status`).all() as Array<{ status: string; count: number }>;
      const byStatus: Record<string, number> = { open: 0, 'in-progress': 0, resolved: 0, escalated: 0 };
      for (const row of byStatusRows) byStatus[row.status] = row.count;
      const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

      const byCategoryRows = db.prepare(`SELECT category, COUNT(*) as count FROM tickets WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC`).all() as Array<{ category: string; count: number }>;
      const topCategories = byCategoryRows.slice(0, 3).map(r => r.category);

      const volumeLast7Days: Array<{ date: string; count: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const count = (db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE date(created_at) = ?`).get(dateStr) as { count: number }).count;
        volumeLast7Days.push({ date: dateStr, count });
      }

      const escalationRate = total > 0 ? (byStatus.escalated / total) * 100 : 0;
      const avgRow = db.prepare(`SELECT AVG((julianday(updated_at) - julianday(created_at)) * 24) as avg_hours FROM tickets WHERE status = 'resolved'`).get() as { avg_hours: number | null };
      const avgResolutionHours = avgRow.avg_hours ?? 0;

      const byCategory: Record<string, number> = {};
      for (const row of byCategoryRows) byCategory[row.category] = row.count;

      const result = await generateAnalyticsBriefing(db, {
        total,
        byStatus,
        byCategory,
        topCategories,
        volumeLast7Days,
        escalationRate,
        avgResolutionHours,
      });

      res.json(result);
    } catch (err) {
      console.error('[Analytics Briefing] Error:', (err as Error).message);
      res.status(502).json({ error: 'AI service unavailable. Please try again.' });
    }
  });

  return router;
}
