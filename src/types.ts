export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ComplianceCategory =
  | 'phi-exposure'
  | 'encryption'
  | 'audit-logging'
  | 'access-control'
  | 'data-retention';

export interface Finding {
  id: string;
  category: ComplianceCategory;
  severity: Severity;
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  recommendation: string;
  hipaaReference?: string;
}

export interface ScanResult {
  findings: Finding[];
  scannedFiles: number;
  scanDuration: number;
}

export interface ScanOptions {
  path: string;
  categories?: ComplianceCategory[];
  exclude?: string[];
  configFile?: string;
}

export interface Scanner {
  name: string;
  category: ComplianceCategory;
  scan(files: string[], options: ScanOptions): Promise<Finding[]>;
}

export interface Report {
  timestamp: string;
  targetPath: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: Finding[];
  scannedFiles: number;
  scanDuration: number;
}

export interface ReportOptions {
  format: 'json' | 'html' | 'markdown';
  outputPath?: string;
}
