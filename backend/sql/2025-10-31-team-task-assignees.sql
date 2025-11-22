-- Teams and Task Assignees schema

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_team_member UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_assignees (
  id SERIAL PRIMARY KEY,
  task_type VARCHAR(32) NOT NULL,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'ASSIGNED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_type, task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_status ON task_assignees(user_id, status);

-- Task assignment meta (policy, optional team)
CREATE TABLE IF NOT EXISTS task_assignment_info (
  id SERIAL PRIMARY KEY,
  task_type VARCHAR(32) NOT NULL,
  task_id INTEGER NOT NULL,
  policy VARCHAR(16) NOT NULL DEFAULT 'ANY_DONE',
  team_id INTEGER NULL REFERENCES teams(id) ON DELETE SET NULL,
  created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_task_assignment_info UNIQUE(task_type, task_id)
);

-- Non-invasive completion mark when ALL_DONE policy satisfies
ALTER TABLE IF EXISTS task_assignment_info
  ADD COLUMN IF NOT EXISTS all_done_at TIMESTAMPTZ NULL;
