import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import type { Finding } from '../types.js';

export interface ScanHistoryEntry {
  timestamp: string;
  date: string; // YYYY-MM-DD-HHmmss format
  complianceScore: number;
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  failedRuleIds: string[];
  totalFilesScanned: number;
}

export interface ScanComparison {
  previousScan?: ScanHistoryEntry;
  scoreChange: number;
  severityChanges: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  newIssues: string[]; // Rule IDs that appeared
  resolvedIssues: string[]; // Rule IDs that disappeared
}

/**
 * Get the history directory path for a project
 */
export function getHistoryDir(projectPath: string): string {
  return join(projectPath, '.vlayer', 'history');
}

/**
 * Ensure the history directory exists
 */
export async function ensureHistoryDir(projectPath: string): Promise<void> {
  const historyDir = getHistoryDir(projectPath);
  if (!existsSync(historyDir)) {
    await mkdir(historyDir, { recursive: true });
  }
}

/**
 * Generate filename for a scan history entry
 */
export function generateHistoryFilename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `scan-${yyyy}-${mm}-${dd}-${hh}${min}${ss}.json`;
}

/**
 * Save scan results to history
 */
export async function saveScanHistory(
  projectPath: string,
  score: number,
  findings: Finding[],
  scannedFiles: number
): Promise<void> {
  await ensureHistoryDir(projectPath);

  // Filter to active findings (not baseline, not suppressed, not acknowledged)
  const activeFindings = findings.filter(
    f => !f.isBaseline && !f.suppressed && !f.acknowledged
  );

  const entry: ScanHistoryEntry = {
    timestamp: new Date().toISOString(),
    date: generateHistoryFilename().replace('scan-', '').replace('.json', ''),
    complianceScore: score,
    severity: {
      critical: activeFindings.filter(f => f.severity === 'critical').length,
      high: activeFindings.filter(f => f.severity === 'high').length,
      medium: activeFindings.filter(f => f.severity === 'medium').length,
      low: activeFindings.filter(f => f.severity === 'low').length,
    },
    failedRuleIds: [...new Set(activeFindings.map(f => f.id))],
    totalFilesScanned: scannedFiles,
  };

  const historyDir = getHistoryDir(projectPath);
  const filename = generateHistoryFilename();
  const filePath = join(historyDir, filename);

  await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * Get the most recent scan history entry
 */
export async function getMostRecentScan(projectPath: string): Promise<ScanHistoryEntry | null> {
  const historyDir = getHistoryDir(projectPath);

  if (!existsSync(historyDir)) {
    return null;
  }

  try {
    const files = await readdir(historyDir);
    const scanFiles = files
      .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    if (scanFiles.length === 0) {
      return null;
    }

    const mostRecentFile = scanFiles[0];
    const content = await readFile(join(historyDir, mostRecentFile), 'utf-8');
    return JSON.parse(content) as ScanHistoryEntry;
  } catch (error) {
    return null;
  }
}

/**
 * Get all scan history entries
 */
export async function getAllScans(projectPath: string): Promise<ScanHistoryEntry[]> {
  const historyDir = getHistoryDir(projectPath);

  if (!existsSync(historyDir)) {
    return [];
  }

  try {
    const files = await readdir(historyDir);
    const scanFiles = files
      .filter(f => f.startsWith('scan-') && f.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    const scans: ScanHistoryEntry[] = [];
    for (const file of scanFiles) {
      try {
        const content = await readFile(join(historyDir, file), 'utf-8');
        scans.push(JSON.parse(content) as ScanHistoryEntry);
      } catch {
        // Skip corrupted files
      }
    }

    return scans;
  } catch (error) {
    return [];
  }
}

/**
 * Compare current scan with previous scan
 */
export function compareScan(
  currentScore: number,
  currentFindings: Finding[],
  previousScan: ScanHistoryEntry | null
): ScanComparison {
  if (!previousScan) {
    return {
      previousScan: undefined,
      scoreChange: 0,
      severityChanges: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      newIssues: [],
      resolvedIssues: [],
    };
  }

  // Filter to active findings
  const activeFindings = currentFindings.filter(
    f => !f.isBaseline && !f.suppressed && !f.acknowledged
  );

  const currentRuleIds = new Set(activeFindings.map(f => f.id));
  const previousRuleIds = new Set(previousScan.failedRuleIds);

  // Find new and resolved issues
  const newIssues = [...currentRuleIds].filter(id => !previousRuleIds.has(id));
  const resolvedIssues = [...previousRuleIds].filter(id => !currentRuleIds.has(id));

  // Calculate severity changes
  const currentSeverity = {
    critical: activeFindings.filter(f => f.severity === 'critical').length,
    high: activeFindings.filter(f => f.severity === 'high').length,
    medium: activeFindings.filter(f => f.severity === 'medium').length,
    low: activeFindings.filter(f => f.severity === 'low').length,
  };

  return {
    previousScan,
    scoreChange: currentScore - previousScan.complianceScore,
    severityChanges: {
      critical: currentSeverity.critical - previousScan.severity.critical,
      high: currentSeverity.high - previousScan.severity.high,
      medium: currentSeverity.medium - previousScan.severity.medium,
      low: currentSeverity.low - previousScan.severity.low,
    },
    newIssues,
    resolvedIssues,
  };
}

/**
 * Format a date string from history filename format
 */
export function formatHistoryDate(dateStr: string): string {
  // dateStr format: YYYY-MM-DD-HHmmss
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(5, 7);
  const day = dateStr.substring(8, 10);
  const hour = dateStr.substring(11, 13);
  const minute = dateStr.substring(13, 15);
  const second = dateStr.substring(15, 17);

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
