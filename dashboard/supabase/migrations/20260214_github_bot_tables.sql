-- GitHub Bot tables for VLayer HIPAA Compliance Scanner

CREATE TABLE IF NOT EXISTS github_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id BIGINT UNIQUE NOT NULL,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  app_id INTEGER,
  target_type TEXT DEFAULT 'all',
  selected_repos JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id BIGINT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id BIGINT,
  repo_full_name TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  pr_title TEXT,
  commit_sha TEXT,
  score INTEGER,
  grade TEXT,
  total_findings INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  check_run_id BIGINT,
  comment_id BIGINT,
  status TEXT DEFAULT 'complete',
  report_json JSONB,
  scan_duration_ms INTEGER,
  files_scanned INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (access via service role key only)
ALTER TABLE github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_scans ENABLE ROW LEVEL SECURITY;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_github_installations_installation_id ON github_installations(installation_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_installation_id ON api_keys(installation_id);
CREATE INDEX IF NOT EXISTS idx_pr_scans_repo ON pr_scans(repo_full_name, pr_number);
CREATE INDEX IF NOT EXISTS idx_pr_scans_installation ON pr_scans(installation_id);
