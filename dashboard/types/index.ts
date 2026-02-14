export interface ComplianceScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  breakdown: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    acknowledged: number;
  };
  penalties: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  recommendations: string[];
}

export interface Finding {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  recommendation: string;
  hipaaReference?: string;
  acknowledged?: boolean;
  suppressed?: boolean;
  isBaseline?: boolean;
}

export interface ScanReport {
  id: string;
  projectId: string;
  timestamp: string;
  targetPath: string;
  scannedFiles: number;
  scanDuration: number;
  findings: Finding[];
  complianceScore: ComplianceScore;
  summary: {
    total: number;
    acknowledged: number;
    suppressed: number;
    baseline: number;
    unacknowledged: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastScanAt?: string;
  scans: ScanReport[];
  isSample?: boolean;
}

export interface DashboardData {
  projects: Project[];
  version: string;
}
