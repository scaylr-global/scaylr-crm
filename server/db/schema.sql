-- Scaylr CRM schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','employee')),
  avatar_initials TEXT,
  avatar_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role_title TEXT,
  company TEXT,
  phone1 TEXT,
  phone2 TEXT,
  email TEXT,
  industry TEXT CHECK (industry IN ('Vehicle','Food','Service','Technology','Other')),
  status TEXT NOT NULL DEFAULT 'New'
    CHECK (status IN ('New','Contacted','Call Again','Follow-up','Qualified','Closed','Lost')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contact_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS call_logs (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  logged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('Interested','Converted','Callback','No Answer','Not Interested','Wrong Number')),
  duration_seconds INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','deleted')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_targets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_target INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_calls_lead ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
