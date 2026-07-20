-- Migration: Add RLS policies for scans and findings tables
-- These tables don't have user_id, so policies check via project ownership

-- === SCANS ===

-- Select: user can see scans for their own projects
CREATE POLICY "Users can view scans of own projects"
  ON public.scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = scans.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Insert: user can create scans for their own projects
CREATE POLICY "Users can create scans for own projects"
  ON public.scans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = scans.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Delete: user can delete scans of their own projects
CREATE POLICY "Users can delete scans of own projects"
  ON public.scans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = scans.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- === FINDINGS ===

-- Select: user can see findings for their own projects
CREATE POLICY "Users can view findings of own projects"
  ON public.findings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = findings.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Insert: user can create findings for their own projects
CREATE POLICY "Users can create findings for own projects"
  ON public.findings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = findings.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Delete: user can delete findings of their own projects
CREATE POLICY "Users can delete findings of own projects"
  ON public.findings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = findings.project_id
        AND projects.user_id = auth.uid()
    )
  );
