-- Create the partners table
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

-- Create the projects table
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partners(id),
  name TEXT NOT NULL,
  description TEXT,
  missive_conversation_id TEXT
);

-- Create the people table
CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES partners(id),
  project_ids INTEGER[],
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone_number TEXT,
  oldest_interaction_at TIMESTAMP,
  latest_interaction_at TIMESTAMP,
  backup_contact TEXT
);

-- Create the todos table
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT CHECK (priority IN ('now', 'next', 'later')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by INTEGER REFERENCES people(id),
  assigned_to INTEGER REFERENCES people(id),
  name_history JSONB,
  description_history JSONB
);


-- Create the todo_assignments table
CREATE TABLE IF NOT EXISTS todo_assignments (
  id SERIAL PRIMARY KEY,
  todo_id INTEGER REFERENCES todos(id),
  person_id INTEGER REFERENCES people(id),
  UNIQUE (todo_id, person_id)
);

-- Create the todo_relations table
CREATE TABLE IF NOT EXISTS todo_relations (
  id SERIAL PRIMARY KEY,
  todo_id INTEGER REFERENCES todos(id),
  parent_todo_id INTEGER REFERENCES todos(id),
  child_todo_id INTEGER REFERENCES todos(id),
  peer_todo_id INTEGER REFERENCES todos(id),
  CHECK (
    (parent_todo_id IS NOT NULL AND child_todo_id IS NULL AND peer_todo_id IS NULL) OR
    (parent_todo_id IS NULL AND child_todo_id IS NOT NULL AND peer_todo_id IS NULL) OR
    (parent_todo_id IS NULL AND child_todo_id IS NULL AND peer_todo_id IS NOT NULL)
  )
);

-- Create the todo_attachments table
CREATE TABLE IF NOT EXISTS todo_attachments (
  id SERIAL PRIMARY KEY,
  todo_id INTEGER REFERENCES todos(id),
  attachment_url TEXT NOT NULL
);

-- Create the todo_external_links table
CREATE TABLE IF NOT EXISTS todo_external_links (
  id SERIAL PRIMARY KEY,
  todo_id INTEGER REFERENCES todos(id),
  external_url TEXT NOT NULL
);

-- Create the todo_missive_conversations table
CREATE TABLE IF NOT EXISTS todo_missive_conversations (
  id SERIAL PRIMARY KEY,
  todo_id INTEGER REFERENCES todos(id),
  missive_conversation_id TEXT NOT NULL,
  UNIQUE (todo_id, missive_conversation_id)
);

-- Create the transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  transaction_date TIMESTAMP NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  client_id INTEGER REFERENCES partners(id),
  vendor_id INTEGER REFERENCES partners(id),
  is_pdw_payer BOOLEAN NOT NULL,
  transaction_url TEXT,
  attachment_urls TEXT[]
);

-- Create the audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  operation TEXT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by INTEGER REFERENCES people(id)
);

-- Create the briefings table
CREATE TABLE IF NOT EXISTS briefings (
  id SERIAL PRIMARY KEY,
  briefing_type TEXT NOT NULL,
  content TEXT NOT NULL,
  missive_conversation_id TEXT NOT NULL,
  is_new_conversation BOOLEAN DEFAULT TRUE,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  project_id INTEGER REFERENCES projects(id),
  CONSTRAINT unique_briefing_type_generated_at UNIQUE (briefing_type, generated_at)
);

-- Create the briefing_proposals table
CREATE TABLE IF NOT EXISTS briefing_proposals (
  id SERIAL PRIMARY KEY,
  briefing_id INTEGER REFERENCES briefings(id),
  reflection TEXT NOT NULL,
  proposal TEXT NOT NULL,
  decision TEXT CHECK (decision IN ('accepted', 'adjusted', 'rejected')),
  decision_notes TEXT,
  decided_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the briefing_prompts table
CREATE TABLE IF NOT EXISTS briefing_prompts (
  id SERIAL PRIMARY KEY,
  briefing_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the weekly_conversations table
CREATE TABLE IF NOT EXISTS weekly_conversations (
  id SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  missive_conversation_id TEXT NOT NULL,
  CONSTRAINT unique_start_date UNIQUE (start_date)
);
