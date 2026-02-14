import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { Project, ScanReport } from '@/types';

// Row shape from Supabase (snake_case)
interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  path: string;
  description: string | null;
  compliance_score: number;
  status: string;
  scans: ScanReport[];
  is_sample: boolean;
  last_scan_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastScanAt: row.last_scan_at ?? undefined,
    scans: row.scans ?? [],
    isSample: row.is_sample,
  };
}

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as ProjectRow[]).map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToProject(data as ProjectRow);
}

export async function createProject(
  project: Pick<Project, 'name' | 'path' | 'description'> & { isSample?: boolean }
): Promise<Project> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: project.name,
      path: project.path,
      description: project.description || null,
      is_sample: project.isSample ?? false,
      scans: [],
    })
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data as ProjectRow);
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const supabase = await createClient();

  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.path !== undefined) row.path = updates.path;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.lastScanAt !== undefined) row.last_scan_at = updates.lastScanAt;
  if (updates.scans !== undefined) row.scans = updates.scans;
  if (updates.isSample !== undefined) row.is_sample = updates.isSample;

  const { data, error } = await supabase
    .from('projects')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data as ProjectRow);
}

export async function deleteProject(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from('projects')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function addScanToProject(projectId: string, scan: ScanReport): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const scans = [scan, ...project.scans].slice(0, 50);
  const latestScore = scan.complianceScore.score;
  const status = latestScore >= 80 ? 'compliant' : latestScore >= 60 ? 'at_risk' : 'critical';

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .update({
      scans,
      last_scan_at: scan.timestamp,
      compliance_score: latestScore,
      status,
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data as ProjectRow);
}

export async function getScan(projectId: string, scanId: string): Promise<ScanReport | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  return project.scans.find((s) => s.id === scanId) || null;
}

// --- Admin functions (bypass RLS, for sample data) ---

export async function getProjectsAdmin(userId: string): Promise<Project[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as ProjectRow[]).map(rowToProject);
}

export async function createProjectAdmin(
  userId: string,
  project: Pick<Project, 'name' | 'path' | 'description'> & { isSample?: boolean; scans?: ScanReport[]; lastScanAt?: string }
): Promise<Project> {
  const supabase = createAdminClient();

  const latestScan = project.scans?.[0];
  const score = latestScan?.complianceScore.score ?? 0;
  const status = score >= 80 ? 'compliant' : score >= 60 ? 'at_risk' : score > 0 ? 'critical' : 'pending';

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: project.name,
      path: project.path,
      description: project.description || null,
      is_sample: project.isSample ?? false,
      scans: project.scans ?? [],
      last_scan_at: project.lastScanAt || null,
      compliance_score: score,
      status,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data as ProjectRow);
}

export async function deleteProjectsAdmin(userId: string, filter: { isSample: boolean }): Promise<number> {
  const supabase = createAdminClient();
  const { error, count } = await supabase
    .from('projects')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .eq('is_sample', filter.isSample);

  if (error) throw error;
  return count ?? 0;
}
