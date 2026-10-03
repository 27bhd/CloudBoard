PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  github_id   INTEGER NOT NULL UNIQUE,
  login       TEXT NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  owner_id     TEXT NOT NULL REFERENCES users(id),
  ticket_seq   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE project_members (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at   INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_members_user ON project_members(user_id);

-- Only the SHA-256 of an invite token is stored, so a database leak never exposes live links.
CREATE TABLE invites (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_invites_project ON invites(project_id);

CREATE TABLE tickets (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number       INTEGER NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  priority     TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
  assignee_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  creator_id   TEXT NOT NULL REFERENCES users(id),
  position     REAL NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  archived_at  INTEGER,
  UNIQUE (project_id, number)
);
CREATE INDEX idx_tickets_board ON tickets(project_id, archived_at, status, position);

-- Append-only audit trail: one row per field change.
CREATE TABLE ticket_events (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  from_value  TEXT,
  to_value    TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_events_ticket ON ticket_events(ticket_id, created_at);
