-- SPDX-License-Identifier: AGPL-3.0-or-later
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  sector TEXT NOT NULL,
  size_band TEXT NOT NULL,
  departments TEXT NOT NULL,            -- JSON [{code,name}]
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  round INTEGER NOT NULL UNIQUE,
  questionnaire_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','closed')),
  core_process TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS survey_links (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('executive','manager','staff')),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  UNIQUE (assessment_id, tier)
);
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  survey_link_id TEXT NOT NULL REFERENCES survey_links(id) ON DELETE CASCADE,
  answers TEXT NOT NULL,                -- JSON {questionId: number}
  free_text TEXT,
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,                -- JSON ResultV1
  engine_version TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('roadmap','discrepancy','fiveRo','pokaYoke','askReport')),
  provider TEXT NOT NULL,
  model TEXT,
  payload TEXT NOT NULL,
  fallback INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS llm_calls (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  ok INTEGER NOT NULL,
  fallback INTEGER NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_responses_link ON responses(survey_link_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_assessment ON prescriptions(assessment_id, kind, created_at);
