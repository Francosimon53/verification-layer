// --- Database row types (match Supabase schema) ---

export interface Project {
  id: string;
  userId: string;
  name: string;
  repoUrl: string | null;
  description: string | null;
  complianceScore: number;
  grade: string;
  status: 'pending' | 'scanning' | 'compliant' | 'at_risk' | 'critical';
  lastScanAt: string | null;
  findingsSummary: FindingsSummary;
  stackInfo: StackInfo;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FindingsSummary {
  total?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
}

export interface StackInfo {
  framework?: string;
  database?: string;
  auth?: string;
  recommendations?: string[];
}

export interface Finding {
  id: string;
  projectId: string;
  scanId: string;
  findingId: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string | null;
  filePath: string | null;
  lineNumber: number | null;
  recommendation: string | null;
  hipaaReference: string | null;
  confidence: string | null;
  status: 'open' | 'acknowledged' | 'suppressed' | 'fixed';
  context: ContextLine[] | null;
  createdAt: string;
}

export interface ContextLine {
  lineNumber: number;
  content: string;
  isMatch: boolean;
}

export interface Scan {
  id: string;
  projectId: string;
  score: number | null;
  grade: string | null;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  filesScanned: number;
  scanDurationMs: number;
  reportJson: unknown;
  createdAt: string;
}
