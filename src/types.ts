export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ComplianceCategory =
  | 'phi-exposure'
  | 'encryption'
  | 'audit-logging'
  | 'access-control'
  | 'data-retention';

export interface ContextLine {
  lineNumber: number;
  content: string;
  isMatch: boolean;
}

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
  context?: ContextLine[];
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
  config?: VlayerConfig;
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

export interface VlayerConfig {
  exclude?: string[];
  ignorePaths?: string[];
  safeHttpDomains?: string[];
  contextLines?: number;
  categories?: ComplianceCategory[];
}
