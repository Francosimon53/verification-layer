import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { Project, Finding, Scan, FindingsSummary, StackInfo } from '@/types';

// --- Row mappers (snake_case DB → camelCase TS) ---

function rowToProject(row: any): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    repoUrl: row.repo_url,
    description: row.description,
    complianceScore: row.compliance_score ?? 0,
    grade: row.grade ?? 'N/A',
    status: row.status ?? 'pending',
    lastScanAt: row.last_scan_at,
    findingsSummary: row.findings_summary ?? {},
    stackInfo: row.stack_info ?? {},
    isSample: row.is_sample ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFinding(row: any): Finding {
  return {
    id: row.id,
    projectId: row.project_id,
    scanId: row.scan_id,
    findingId: row.finding_id,
    category: row.category,
    severity: row.severity,
    title: row.title,
    description: row.description,
    filePath: row.file_path,
    lineNumber: row.line_number,
    recommendation: row.recommendation,
    hipaaReference: row.hipaa_reference,
    confidence: row.confidence,
    status: row.status,
    context: row.context,
    createdAt: row.created_at,
  };
}

function rowToScan(row: any): Scan {
  return {
    id: row.id,
    projectId: row.project_id,
    score: row.score,
    grade: row.grade,
    totalFindings: row.total_findings ?? 0,
    criticalCount: row.critical_count ?? 0,
    highCount: row.high_count ?? 0,
    mediumCount: row.medium_count ?? 0,
    lowCount: row.low_count ?? 0,
    filesScanned: row.files_scanned ?? 0,
    scanDurationMs: row.scan_duration_ms ?? 0,
    reportJson: row.report_json,
    createdAt: row.created_at,
  };
}

// --- Projects ---

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToProject);
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
  return rowToProject(data);
}

export async function createProject(input: {
  name: string;
  repoUrl?: string;
  description?: string;
  isSample?: boolean;
}): Promise<Project> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: input.name,
      repo_url: input.repoUrl || null,
      description: input.description || null,
      is_sample: input.isSample ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToProject(data);
}

export async function updateProjectAfterScan(
  projectId: string,
  update: {
    complianceScore: number;
    grade: string;
    status: string;
    findingsSummary: FindingsSummary;
    stackInfo: StackInfo;
    lastScanAt: string;
  }
): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .update({
      compliance_score: update.complianceScore,
      grade: update.grade,
      status: update.status,
      findings_summary: update.findingsSummary,
      stack_info: update.stackInfo,
      last_scan_at: update.lastScanAt,
    })
    .eq('id', projectId)
    .select()
    .single();
  if (error) throw error;
  return rowToProject(data);
}

export async function setProjectStatus(projectId: string, status: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('projects').update({ status }).eq('id', projectId);
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

// --- Scans ---

export async function createScan(input: {
  projectId: string;
  score: number;
  grade: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  filesScanned: number;
  scanDurationMs: number;
  reportJson: unknown;
}): Promise<Scan> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scans')
    .insert({
      project_id: input.projectId,
      score: input.score,
      grade: input.grade,
      total_findings: input.totalFindings,
      critical_count: input.criticalCount,
      high_count: input.highCount,
      medium_count: input.mediumCount,
      low_count: input.lowCount,
      files_scanned: input.filesScanned,
      scan_duration_ms: input.scanDurationMs,
      report_json: input.reportJson,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToScan(data);
}

export async function getScans(projectId: string): Promise<Scan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToScan);
}

// --- Findings ---

export async function createFindings(
  findings: Array<{
    projectId: string;
    scanId: string;
    findingId: string;
    category: string;
    severity: string;
    title: string;
    description?: string;
    filePath?: string;
    lineNumber?: number;
    recommendation?: string;
    hipaaReference?: string;
    confidence?: string;
    context?: unknown;
  }>
): Promise<void> {
  if (findings.length === 0) return;
  const supabase = await createClient();
  const rows = findings.map((f) => ({
    project_id: f.projectId,
    scan_id: f.scanId,
    finding_id: f.findingId,
    category: f.category,
    severity: f.severity,
    title: f.title,
    description: f.description || null,
    file_path: f.filePath || null,
    line_number: f.lineNumber || null,
    recommendation: f.recommendation || null,
    hipaa_reference: f.hipaaReference || null,
    confidence: f.confidence || null,
    context: f.context || null,
  }));
  const { error } = await supabase.from('findings').insert(rows);
  if (error) throw error;
}

export async function getFindings(projectId: string, scanId?: string): Promise<Finding[]> {
  const supabase = await createClient();
  let query = supabase
    .from('findings')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (scanId) query = query.eq('scan_id', scanId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToFinding);
}

// --- Admin helpers for scan route (bypasses RLS) ---

export async function getProjectAdmin(id: string): Promise<Project | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToProject(data);
}

export async function setProjectStatusAdmin(projectId: string, status: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
  if (error) throw error;
}

export async function updateProjectAfterScanAdmin(
  projectId: string,
  update: {
    complianceScore: number;
    grade: string;
    status: string;
    findingsSummary: FindingsSummary;
    stackInfo: StackInfo;
    lastScanAt: string;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('projects')
    .update({
      compliance_score: update.complianceScore,
      grade: update.grade,
      status: update.status,
      findings_summary: update.findingsSummary,
      stack_info: update.stackInfo,
      last_scan_at: update.lastScanAt,
    })
    .eq('id', projectId);
  if (error) throw error;
}

export async function createScanAdmin(input: {
  projectId: string;
  score: number;
  grade: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  filesScanned: number;
  scanDurationMs: number;
  reportJson: unknown;
}): Promise<Scan> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('scans')
    .insert({
      project_id: input.projectId,
      score: input.score,
      grade: input.grade,
      total_findings: input.totalFindings,
      critical_count: input.criticalCount,
      high_count: input.highCount,
      medium_count: input.mediumCount,
      low_count: input.lowCount,
      files_scanned: input.filesScanned,
      scan_duration_ms: input.scanDurationMs,
      report_json: input.reportJson,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToScan(data);
}

export async function createFindingsAdmin(
  findings: Array<{
    projectId: string;
    scanId: string;
    findingId: string;
    category: string;
    severity: string;
    title: string;
    description?: string;
    filePath?: string;
    lineNumber?: number;
    recommendation?: string;
    hipaaReference?: string;
    confidence?: string;
    context?: unknown;
  }>
): Promise<void> {
  if (findings.length === 0) return;
  const supabase = createAdminClient();
  const rows = findings.map((f) => ({
    project_id: f.projectId,
    scan_id: f.scanId,
    finding_id: f.findingId,
    category: f.category,
    severity: f.severity,
    title: f.title,
    description: f.description || null,
    file_path: f.filePath || null,
    line_number: f.lineNumber || null,
    recommendation: f.recommendation || null,
    hipaa_reference: f.hipaaReference || null,
    confidence: f.confidence || null,
    context: f.context || null,
  }));
  const { error } = await supabase.from('findings').insert(rows);
  if (error) throw error;
}

// --- Admin (for sample data) ---

export async function createProjectAdmin(
  userId: string,
  input: { name: string; repoUrl?: string; description?: string; isSample?: boolean; complianceScore?: number; grade?: string; status?: string; findingsSummary?: FindingsSummary; lastScanAt?: string }
): Promise<Project> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: input.name,
      repo_url: input.repoUrl || null,
      description: input.description || null,
      is_sample: input.isSample ?? false,
      compliance_score: input.complianceScore ?? 0,
      grade: input.grade ?? 'N/A',
      status: input.status ?? 'pending',
      findings_summary: input.findingsSummary ?? {},
      last_scan_at: input.lastScanAt || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToProject(data);
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
