-- Migration: Update projects table for scanner integration
-- Fixes column mismatches between code and database

-- 1. Rename path -> repo_url (code uses repo_url)
ALTER TABLE public.projects RENAME COLUMN path TO repo_url;

-- 2. Make repo_url nullable (projects can exist without a repo)
ALTER TABLE public.projects ALTER COLUMN repo_url DROP NOT NULL;

-- 3. Add missing columns
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS grade text NOT NULL DEFAULT 'N/A';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS findings_summary jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS stack_info jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Drop old scans jsonb column (now using separate scans table)
ALTER TABLE public.projects DROP COLUMN IF EXISTS scans;

-- 5. Update status CHECK constraint to include 'scanning'
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending', 'scanning', 'compliant', 'at_risk', 'critical'));

-- 6. Update existing row: fix the old "ariaba" record path -> repo_url value
UPDATE public.projects
  SET repo_url = 'https://github.com/Francosimon53/ariaba'
  WHERE name = 'ariaba' AND repo_url = 'https://github.com/Francosimon53/ariaba';
