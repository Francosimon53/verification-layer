import { createClient } from '@/lib/supabase/server';
import { createProjectAdmin, deleteProjectsAdmin } from '@/lib/storage';

const SAMPLE_PROJECTS = [
  { name: 'HealthCare Portal', repoUrl: 'https://github.com/example/healthcare-portal', description: 'Patient management system with EHR integration', complianceScore: 92, grade: 'A', status: 'compliant', findingsSummary: { total: 8, critical: 0, high: 2, medium: 4, low: 2 } },
  { name: 'Telemedicine API', repoUrl: 'https://github.com/example/telemedicine-api', description: 'RESTful API for virtual consultations', complianceScore: 78, grade: 'C', status: 'at_risk', findingsSummary: { total: 22, critical: 1, high: 5, medium: 10, low: 6 } },
  { name: 'Insurance Claims System', repoUrl: 'https://github.com/example/claims-system', description: 'Claims processing and adjudication platform', complianceScore: 56, grade: 'F', status: 'critical', findingsSummary: { total: 44, critical: 3, high: 12, medium: 18, low: 11 } },
  { name: 'Mobile Health App', repoUrl: 'https://github.com/example/mobile-health', description: 'iOS/Android app for patient health tracking', complianceScore: 95, grade: 'A', status: 'compliant', findingsSummary: { total: 5, critical: 0, high: 1, medium: 2, low: 2 } },
];

export async function loadSampleData(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let count = 0;
  for (const sp of SAMPLE_PROJECTS) {
    await createProjectAdmin(user.id, {
      name: sp.name,
      repoUrl: sp.repoUrl,
      description: sp.description,
      isSample: true,
      complianceScore: sp.complianceScore,
      grade: sp.grade,
      status: sp.status,
      findingsSummary: sp.findingsSummary,
      lastScanAt: new Date().toISOString(),
    });
    count++;
  }
  return count;
}

export async function clearSampleData(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return deleteProjectsAdmin(user.id, { isSample: true });
}

export async function hasSampleData(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('is_sample', true)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
