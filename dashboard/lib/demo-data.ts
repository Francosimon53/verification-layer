import type { Project, ScanReport } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { createProjectAdmin, deleteProjectsAdmin } from '@/lib/storage';

/**
 * Sample project definitions.
 * Not loaded by default — users can opt in via "Load Sample Data".
 */
const SAMPLE_PROJECTS: Array<{
  name: string;
  path: string;
  description: string;
  lastScanAt: string;
  scans: ScanReport[];
}> = [
  {
    name: 'HealthCare Portal',
    path: '/projects/healthcare-portal',
    description: 'Patient management system with EHR integration',
    lastScanAt: '2024-02-06T14:30:00Z',
    scans: [
      {
        id: 'scan-1',
        projectId: '',
        timestamp: '2024-02-06T14:30:00Z',
        targetPath: '/projects/healthcare-portal',
        scannedFiles: 342,
        scanDuration: 1850,
        findings: [],
        complianceScore: {
          score: 92,
          grade: 'A',
          status: 'excellent',
          breakdown: { total: 8, critical: 0, high: 2, medium: 4, low: 2, acknowledged: 2 },
          penalties: { critical: 0, high: 10, medium: 8, low: 2, total: 20 },
          recommendations: ['Review 2 high severity findings for improvement'],
        },
        summary: { total: 8, acknowledged: 2, suppressed: 0, baseline: 0, unacknowledged: 6, critical: 0, high: 2, medium: 4, low: 2, info: 0 },
      },
      {
        id: 'scan-2',
        projectId: '',
        timestamp: '2024-02-05T09:15:00Z',
        targetPath: '/projects/healthcare-portal',
        scannedFiles: 340,
        scanDuration: 1920,
        findings: [],
        complianceScore: {
          score: 88,
          grade: 'B',
          status: 'good',
          breakdown: { total: 12, critical: 0, high: 3, medium: 6, low: 3, acknowledged: 0 },
          penalties: { critical: 0, high: 15, medium: 12, low: 3, total: 30 },
          recommendations: [],
        },
        summary: { total: 12, acknowledged: 0, suppressed: 0, baseline: 0, unacknowledged: 12, critical: 0, high: 3, medium: 6, low: 3, info: 0 },
      },
      {
        id: 'scan-3',
        projectId: '',
        timestamp: '2024-02-04T16:45:00Z',
        targetPath: '/projects/healthcare-portal',
        scannedFiles: 338,
        scanDuration: 1780,
        findings: [],
        complianceScore: {
          score: 85,
          grade: 'B',
          status: 'good',
          breakdown: { total: 15, critical: 0, high: 4, medium: 7, low: 4, acknowledged: 0 },
          penalties: { critical: 0, high: 20, medium: 14, low: 4, total: 38 },
          recommendations: [],
        },
        summary: { total: 15, acknowledged: 0, suppressed: 0, baseline: 0, unacknowledged: 15, critical: 0, high: 4, medium: 7, low: 4, info: 0 },
      },
    ],
  },
  {
    name: 'Telemedicine API',
    path: '/projects/telemedicine-api',
    description: 'RESTful API for virtual consultations and prescriptions',
    lastScanAt: '2024-02-06T11:20:00Z',
    scans: [
      {
        id: 'scan-4',
        projectId: '',
        timestamp: '2024-02-06T11:20:00Z',
        targetPath: '/projects/telemedicine-api',
        scannedFiles: 156,
        scanDuration: 980,
        findings: [],
        complianceScore: {
          score: 78,
          grade: 'C',
          status: 'fair',
          breakdown: { total: 22, critical: 1, high: 5, medium: 10, low: 6, acknowledged: 5 },
          penalties: { critical: 10, high: 25, medium: 20, low: 6, total: 61 },
          recommendations: ['Address 1 critical issue immediately', 'Resolve 5 high severity issues'],
        },
        summary: { total: 22, acknowledged: 5, suppressed: 0, baseline: 0, unacknowledged: 17, critical: 1, high: 5, medium: 10, low: 6, info: 0 },
      },
      {
        id: 'scan-5',
        projectId: '',
        timestamp: '2024-02-05T10:30:00Z',
        targetPath: '/projects/telemedicine-api',
        scannedFiles: 154,
        scanDuration: 1020,
        findings: [],
        complianceScore: {
          score: 72,
          grade: 'C',
          status: 'fair',
          breakdown: { total: 28, critical: 2, high: 6, medium: 12, low: 8, acknowledged: 0 },
          penalties: { critical: 20, high: 30, medium: 24, low: 8, total: 82 },
          recommendations: [],
        },
        summary: { total: 28, acknowledged: 0, suppressed: 0, baseline: 0, unacknowledged: 28, critical: 2, high: 6, medium: 12, low: 8, info: 0 },
      },
    ],
  },
  {
    name: 'Insurance Claims System',
    path: '/projects/claims-system',
    description: 'Claims processing and adjudication platform',
    lastScanAt: '2024-02-06T15:45:00Z',
    scans: [
      {
        id: 'scan-6',
        projectId: '',
        timestamp: '2024-02-06T15:45:00Z',
        targetPath: '/projects/claims-system',
        scannedFiles: 523,
        scanDuration: 2340,
        findings: [],
        complianceScore: {
          score: 56,
          grade: 'F',
          status: 'critical',
          breakdown: { total: 44, critical: 3, high: 12, medium: 18, low: 11, acknowledged: 8 },
          penalties: { critical: 30, high: 60, medium: 36, low: 11, total: 137 },
          recommendations: [
            'Address 3 critical issues immediately - severe HIPAA compliance risks',
            'Resolve 12 high severity issues as soon as possible',
            'Your compliance score is below acceptable levels. Consider a comprehensive security audit',
          ],
        },
        summary: { total: 44, acknowledged: 8, suppressed: 0, baseline: 0, unacknowledged: 36, critical: 3, high: 12, medium: 18, low: 11, info: 0 },
      },
    ],
  },
  {
    name: 'Mobile Health App',
    path: '/projects/mobile-health',
    description: 'iOS/Android app for patient health tracking',
    lastScanAt: '2024-02-06T13:10:00Z',
    scans: [
      {
        id: 'scan-7',
        projectId: '',
        timestamp: '2024-02-06T13:10:00Z',
        targetPath: '/projects/mobile-health',
        scannedFiles: 287,
        scanDuration: 1560,
        findings: [],
        complianceScore: {
          score: 95,
          grade: 'A',
          status: 'excellent',
          breakdown: { total: 5, critical: 0, high: 1, medium: 2, low: 2, acknowledged: 1 },
          penalties: { critical: 0, high: 5, medium: 4, low: 2, total: 11 },
          recommendations: ['Great compliance posture! Continue monitoring and maintaining best practices.'],
        },
        summary: { total: 5, acknowledged: 1, suppressed: 0, baseline: 0, unacknowledged: 4, critical: 0, high: 1, medium: 2, low: 2, info: 0 },
      },
    ],
  },
];

/** Load sample projects into the current user's account. */
export async function loadSampleData(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let count = 0;
  for (const sp of SAMPLE_PROJECTS) {
    await createProjectAdmin(user.id, {
      name: sp.name,
      path: sp.path,
      description: sp.description,
      isSample: true,
      scans: sp.scans,
      lastScanAt: sp.lastScanAt,
    });
    count++;
  }
  return count;
}

/** Remove all sample projects for the current user. */
export async function clearSampleData(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  return deleteProjectsAdmin(user.id, { isSample: true });
}

/** Check if any sample projects are loaded for the current user. */
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
