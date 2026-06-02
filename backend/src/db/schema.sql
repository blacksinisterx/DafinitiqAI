CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  team TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','resolved','escalated')),
  priority TEXT CHECK(priority IN ('low','medium','high','critical')),
  category TEXT CHECK(category IN ('billing','technical','account','general')),
  sentiment TEXT CHECK(sentiment IN ('positive','neutral','negative','angry')),
  triage_summary TEXT,
  assigned_agent_id INTEGER REFERENCES agents(id),
  escalated_to TEXT CHECK(escalated_to IN ('billing-ops','engineering','management')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  author_type TEXT NOT NULL CHECK(author_type IN ('agent','ai_draft')),
  body TEXT NOT NULL,
  is_ai_draft INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER REFERENCES tickets(id),
  action TEXT NOT NULL CHECK(action IN ('triage','draft_reply','escalation','analytics_briefing')),
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
