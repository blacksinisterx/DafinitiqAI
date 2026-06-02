# SupportIQ — AI-Powered Customer Support Platform

An internal customer support ticket management platform powered by Google Gemini AI. Built for the Dafinitiq AI Technical Assessment (AI-AUTO-2026-06-02).

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Google Gemini API key** — get one free at https://aistudio.google.com

## Quick Start

### 1. Backend Setup

```bash
cd supportiq/backend

# Install dependencies
npm install

# Copy env file and add your Gemini API key
cp .env.example .env
# Edit .env — set GEMINI_API_KEY to your key from aistudio.google.com

# Run database migrations (creates SQLite schema)
npm run migrate

# Seed the database (15 tickets, 3 agents, 5+ replies)
npm run seed

# Start backend (runs on http://localhost:3001)
npm run dev
```

### 2. Frontend Setup (new terminal)

```bash
cd supportiq/frontend

# Install dependencies
npm install

# Start frontend (runs on http://localhost:5173)
npm run dev
```

### 3. Open the app

Navigate to **http://localhost:5173**

---

## Environment Variables

Create `backend/.env` with:

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Primary Google Gemini API key (from aistudio.google.com) |
| `GEMINI_API_KEY_BACKUP` | Recommended | Backup key — used automatically if primary fails |
| `PORT` | No | Backend port (default: `3001`) |
| `DATABASE_PATH` | No | SQLite file path (default: `./supportiq.db`) |

**Security:** `GEMINI_API_KEY` is never sent to the browser. All Gemini calls are server-side only.

---

## Backend Framework

This project uses **Express** (Node.js). Express was chosen for its minimal footprint, wide ecosystem, and straightforward middleware model, which is well-suited for a rapid-build assessment. Fastify would be preferred in production for its schema-first validation and faster throughput.

---

## Database: SQLite

**Why SQLite for this assessment:**
SQLite was chosen because it requires zero external services — the database is a single file (`supportiq.db`) that works on any machine without installation. `better-sqlite3` provides a synchronous API that integrates cleanly with Express route handlers. For this assessment's scope (15–100 tickets, single-server), SQLite is perfectly adequate and makes reviewer setup trivially simple with a single `npm run seed` command. The schema is fully compatible with PostgreSQL with minimal changes: `AUTOINCREMENT` becomes `SERIAL`, `TEXT` date columns become `TIMESTAMPTZ`, and all `CHECK` constraints remain identical.

**When to migrate to PostgreSQL:**
At scale (1,000+ concurrent users, 10,000+ tickets/day), PostgreSQL is the correct choice. It handles concurrent writes with proper MVCC locking, supports connection pooling via pgBouncer, and enables read replicas to offload analytics queries. I would add indexes on `tickets(status)`, `tickets(created_at DESC)`, `tickets(assigned_agent_id)`, and a composite index on `tickets(status, priority)` to support the inbox filter queries. Full-text search would use a `tsvector` index on `subject || body` to support keyword search. A connection pool (pg-pool, min 5, max 20) and Redis caching of the analytics summary (5-minute TTL) would handle the load.

---

## Gemini Integration

**Model used:** `gemini-2.5-flash` (the assessment specifies gemini-1.5-flash but that model is no longer available on the free tier — gemini-2.5-flash is the current equivalent and is confirmed working).

All four integration points make **real HTTP calls** to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`. Every call writes a row to the `ai_logs` table with the actual `model`, `prompt_tokens`, `completion_tokens`, and `latency_ms` returned by the API.

| # | Endpoint | Action | Returns |
|---|----------|--------|---------|
| 1 | `POST /api/tickets/:id/triage` | Classify ticket into category/priority/sentiment | Zod-validated JSON |
| 2 | `POST /api/tickets/:id/draft-reply` | Generate context-aware reply draft | Plain text |
| 3 | `POST /api/tickets/:id/assess-escalation` | Evaluate escalation need | Zod-validated JSON |
| 4 | `POST /api/analytics/briefing` | Generate daily support health briefing | Plain text |

To verify real API calls were made:
```bash
sqlite3 supportiq/backend/supportiq.db "SELECT action, model, prompt_tokens, completion_tokens, latency_ms FROM ai_logs;"
```

---

## API Endpoints

### Tickets
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets` | List tickets — paginated, filter by `?status=`, `?priority=`, sort by `?sort=date\|priority&order=asc\|desc` |
| GET | `/api/tickets/:id` | Single ticket with all replies |
| POST | `/api/tickets` | Create ticket; triggers async AI triage in background |
| PATCH | `/api/tickets/:id` | Update status, priority, assigned_agent_id, escalated_to |

### AI Actions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tickets/:id/triage` | Run Gemini triage — persists category/priority/sentiment |
| POST | `/api/tickets/:id/draft-reply` | Get AI-drafted reply (not auto-saved) |
| POST | `/api/tickets/:id/assess-escalation` | Gemini escalation decision |

### Replies
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tickets/:id/replies` | Save an agent reply; sets status to `in-progress` |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/summary` | Aggregated stats (counts, volume, escalation rate) |
| POST | `/api/analytics/briefing` | AI daily briefing via Gemini |

### Agents
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id/dashboard` | Per-agent stats |

---

## The Five Screens

| # | Route | Screen | Key Features |
|---|-------|--------|-------------|
| 1 | `/tickets` | Ticket Inbox | Paginated table, filter by status/priority, sort by date/priority |
| 2 | `/tickets/:id` | Ticket Detail | Message thread, Triage panel, Draft Reply, Escalation Assessment; status/priority/agent controls |
| 3 | `/tickets/new` | Submit Ticket | Form with validation; auto-triggers AI triage on submission |
| 4 | `/dashboard` | Agent Dashboard | Per-agent stats, tickets by status/category, weekly volume |
| 5 | `/analytics` | Analytics | Recharts pie/bar/line charts; AI Daily Briefing panel |

---

## AI Tool Usage Disclosure

This application was built with **Claude Code** (Anthropic). Claude scaffolded the project structure, implemented the Gemini service module with prompt builders and Zod validators, and generated the React components. All architectural decisions, prompt engineering strategy, API design, integration logic, and debugging were directed by the candidate. All Gemini API calls are real, live, and verified via the `ai_logs` table.

---

## Known Limitations & Trade-offs

| Item | Detail |
|------|--------|
| No authentication | Auth stub acceptable per brief; production would use JWT + role-based access (agent vs manager vs admin) |
| SQLite concurrency | No concurrent write support; PostgreSQL required at scale |
| No WebSocket real-time | Ticket auto-triage fires asynchronously on creation — frontend requires manual refresh to see results; SSE would fix this |
| Gemini model version | Using `gemini-2.5-flash` (current free-tier model); `gemini-1.5-flash` specified in brief is no longer available |
| Rate limiting | 20 req/min per IP on AI endpoints; production needs per-user limits + spend controls |
| No CSV export | Deprioritized for 3-hour deadline |

---

## Production Hardening (Discussion Notes)

- **Auth**: JWT with role separation (agent / manager / admin); bcrypt passwords; refresh tokens
- **PII**: Encrypt `customer_email` at rest; redact from logs; GDPR deletion support
- **Cost controls**: Per-request token budgets; daily spend alerts; prompt caching; model fallback to smaller model on high load
- **Observability**: Structured logging (Pino) with request IDs; Gemini call traces in `ai_logs`; latency alerts
- **Eval logging**: Store full prompt + completion in `ai_logs` for quality monitoring and regression testing
- **Scale to 10k/day**: PostgreSQL + pgBouncer (connection pooling) + read replica for analytics; async Gemini via Bull/BullMQ job queue; Redis cache for analytics summary (5-min TTL); horizontal scaling with PM2 cluster mode or containerized deployment on ECS/K8s
