-- ============================================================
-- RLS Audit Fix: clean duplicates, add missing policies
-- ============================================================

-- 1. PROJECTS: remove duplicate policies (keep the well-named ones)
DROP POLICY IF EXISTS "Users see own projects" ON projects;
DROP POLICY IF EXISTS "Users insert own projects" ON projects;
DROP POLICY IF EXISTS "Users update own projects" ON projects;
DROP POLICY IF EXISTS "Users delete own projects" ON projects;

-- 2. FINDINGS: remove duplicate ALL policy (granular policies are better)
DROP POLICY IF EXISTS "Users see own findings" ON findings;

-- 3. SCANS: remove duplicate ALL policy
DROP POLICY IF EXISTS "Users see own scans" ON scans;

-- 4. GITHUB_INSTALLATIONS: users can view their own installations
-- Uses account_login matching the GitHub username stored in auth.users metadata
CREATE POLICY "Users can view own installations" ON github_installations
  FOR SELECT
  USING (
    account_login = (
      SELECT COALESCE(
        raw_user_meta_data->>'user_name',
        raw_user_meta_data->>'preferred_username'
      )
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- 5. PR_SCANS: users can view scans for repos linked to their installations
CREATE POLICY "Users can view own pr_scans" ON pr_scans
  FOR SELECT
  USING (
    installation_id IN (
      SELECT gi.installation_id
      FROM github_installations gi
      WHERE gi.account_login = (
        SELECT COALESCE(
          raw_user_meta_data->>'user_name',
          raw_user_meta_data->>'preferred_username'
        )
        FROM auth.users
        WHERE id = auth.uid()
      )
    )
  );

-- 6. API_KEYS: verify no permissive policies exist (should be empty)
-- No action needed — RLS enabled + no policies = only service_role can access
-- This comment serves as audit documentation.

-- 7. Drop the temporary exec_sql helper function (no longer needed)
DROP FUNCTION IF EXISTS public.exec_sql(text);
