import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { db, initDb } from './db/index';
import { createTicketRouter } from './routes/tickets';
import { createAgentRouter } from './routes/agents';
import { createAnalyticsRouter } from './routes/analytics';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10kb' }));

// Rate limiter for AI endpoints
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Init DB schema on startup
initDb();

// Rate limiting MUST be registered before route handlers
app.use('/api/tickets/:id/triage', aiRateLimit);
app.use('/api/tickets/:id/draft-reply', aiRateLimit);
app.use('/api/tickets/:id/assess-escalation', aiRateLimit);
app.use('/api/analytics/briefing', aiRateLimit);

// Routes
app.use('/api/tickets', createTicketRouter(db));
app.use('/api/agents', createAgentRouter(db));
app.use('/api/analytics', createAnalyticsRouter(db));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SupportIQ backend running on http://localhost:${PORT}`);
});
