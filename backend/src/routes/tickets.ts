import { Router, Request, Response } from 'express';
import type { Database } from 'better-sqlite3';
import { CreateTicketSchema, PatchTicketSchema, CreateReplySchema } from '../schemas/zod';
import { triageTicket, draftReply, assessEscalation } from '../services/gemini';

export function createTicketRouter(db: Database): Router {
  const router = Router();

  // GET /api/tickets
  router.get('/', (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      const { status, priority, sort, order } = req.query as Record<string, string>;

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (status && status !== 'all') {
        conditions.push('t.status = ?');
        params.push(status);
      }
      if (priority && priority !== 'all') {
        conditions.push('t.priority = ?');
        params.push(priority);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const priorityOrder = `CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`;
      let orderClause = 't.created_at DESC';
      if (sort === 'priority') orderClause = `${priorityOrder} ${order === 'desc' ? 'DESC' : 'ASC'}`;
      else if (sort === 'date') orderClause = `t.created_at ${order === 'asc' ? 'ASC' : 'DESC'}`;

      const total = (db.prepare(`SELECT COUNT(*) as count FROM tickets t ${where}`).get(...params) as { count: number }).count;
      const tickets = db.prepare(`
        SELECT t.*, a.name as agent_name
        FROM tickets t
        LEFT JOIN agents a ON t.assigned_agent_id = a.id
        ${where}
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      res.json({
        data: tickets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  });

  // GET /api/tickets/:id
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const ticket = db.prepare(`
        SELECT t.*, a.name as agent_name
        FROM tickets t
        LEFT JOIN agents a ON t.assigned_agent_id = a.id
        WHERE t.id = ?
      `).get(req.params.id);

      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      const replies = db.prepare('SELECT * FROM replies WHERE ticket_id = ? ORDER BY created_at ASC').all(req.params.id);
      res.json({ ...ticket as object, replies });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  });

  // POST /api/tickets
  router.post('/', (req: Request, res: Response) => {
    const parsed = CreateTicketSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    try {
      const { customer_name, customer_email, subject, body, assigned_agent_id } = parsed.data;
      const result = db.prepare(`
        INSERT INTO tickets (customer_name, customer_email, subject, body, assigned_agent_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(customer_name, customer_email, subject, body, assigned_agent_id ?? null);

      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(result.lastInsertRowid);

      // Async triage — fire and forget
      setImmediate(async () => {
        try {
          const t = ticket as { id: number; subject: string; body: string };
          const triage = await triageTicket(db, t);
          db.prepare(`
            UPDATE tickets SET category=?, priority=?, sentiment=?, triage_summary=?, updated_at=datetime('now') WHERE id=?
          `).run(triage.category, triage.priority, triage.sentiment, triage.triage_summary, t.id);
        } catch (e) {
          console.error('[Auto-triage] Failed:', (e as Error).message);
        }
      });

      res.status(201).json(ticket);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  });

  // PATCH /api/tickets/:id
  router.patch('/:id', (req: Request, res: Response) => {
    const parsed = PatchTicketSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    try {
      const updates = parsed.data;
      const fields: string[] = [];
      const values: unknown[] = [];
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
      }
      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

      fields.push("updated_at = datetime('now')");
      values.push(req.params.id);
      db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).run(...values);

      const updated = db.prepare(`
        SELECT t.*, a.name as agent_name FROM tickets t
        LEFT JOIN agents a ON t.assigned_agent_id = a.id
        WHERE t.id = ?
      `).get(req.params.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update ticket' });
    }
  });

  // POST /api/tickets/:id/triage
  router.post('/:id/triage', async (req: Request, res: Response) => {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as any;
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    try {
      const result = await triageTicket(db, ticket);
      db.prepare(`
        UPDATE tickets SET category=?, priority=?, sentiment=?, triage_summary=?, updated_at=datetime('now') WHERE id=?
      `).run(result.category, result.priority, result.sentiment, result.triage_summary, ticket.id);

      res.json(result);
    } catch (err) {
      console.error('[Triage] Error:', (err as Error).message);
      res.status(502).json({ error: 'AI service unavailable. Please try again.' });
    }
  });

  // POST /api/tickets/:id/draft-reply
  router.post('/:id/draft-reply', async (req: Request, res: Response) => {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as any;
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const replies = db.prepare('SELECT * FROM replies WHERE ticket_id = ? ORDER BY created_at ASC').all(req.params.id) as any[];

    try {
      const result = await draftReply(db, ticket, replies);
      res.json(result);
    } catch (err) {
      console.error('[DraftReply] Error:', (err as Error).message);
      res.status(502).json({ error: 'AI service unavailable. Please try again.' });
    }
  });

  // POST /api/tickets/:id/assess-escalation
  router.post('/:id/assess-escalation', async (req: Request, res: Response) => {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id) as any;
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    try {
      const result = await assessEscalation(db, ticket);
      res.json(result);
    } catch (err) {
      console.error('[Escalation] Error:', (err as Error).message);
      res.status(502).json({ error: 'AI service unavailable. Please try again.' });
    }
  });

  // POST /api/tickets/:id/replies
  router.post('/:id/replies', (req: Request, res: Response) => {
    const parsed = CreateReplySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    try {
      const { body, author_type } = parsed.data;
      const result = db.prepare(`
        INSERT INTO replies (ticket_id, author_type, body, is_ai_draft) VALUES (?, ?, ?, 0)
      `).run(req.params.id, author_type, body);

      db.prepare(`UPDATE tickets SET status='in-progress', updated_at=datetime('now') WHERE id=? AND status='open'`).run(req.params.id);

      const reply = db.prepare('SELECT * FROM replies WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(reply);
    } catch (err) {
      res.status(500).json({ error: 'Failed to save reply' });
    }
  });

  return router;
}
