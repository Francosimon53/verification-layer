import * as vscode from 'vscode';
import type { ScanResult, ScanOptions, ComplianceCategory, Finding } from 'verification-layer';

interface CacheEntry {
  result: ScanResult;
  timestamp: number;
}

const CACHE_TTL_MS = 30000; // 30 seconds

let scanCache: Map<string, CacheEntry> = new Map();
let debounceTimers: Map<string, NodeJS.Timeout> = new Map();

export async function scanWorkspace(workspacePath: string): Promise<ScanResult> {
  const config = vscode.workspace.getConfiguration('vlayer');
  const categories = config.get<ComplianceCategory[]>('categories');
  const exclude = config.get<string[]>('exclude');

  const options: ScanOptions = {
    path: workspacePath,
    categories,
    exclude,
  };

  // Check cache
  const cached = scanCache.get(workspacePath);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const { scan } = await import('verification-layer');
    const result = await scan(options);

    // Update cache
    scanCache.set(workspacePath, {
      result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error('vlayer scan error:', error);
    throw error;
  }
}

export async function scanFile(filePath: string, workspacePath: string): Promise<Finding[]> {
  // Scan workspace and filter findings for this file
  const result = await scanWorkspace(workspacePath);
  return result.findings.filter(f => f.file === filePath || f.file.endsWith(filePath));
}

export function scanWithDebounce(
  workspacePath: string,
  callback: (result: ScanResult) => void,
  delay?: number
): void {
  const config = vscode.workspace.getConfiguration('vlayer');
  const debounceDelay = delay ?? config.get<number>('debounceDelay') ?? 1000;

  // Clear existing timer
  const existingTimer = debounceTimers.get(workspacePath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer
  const timer = setTimeout(async () => {
    debounceTimers.delete(workspacePath);
    try {
      // Invalidate cache on debounced scan
      scanCache.delete(workspacePath);
      const result = await scanWorkspace(workspacePath);
      callback(result);
    } catch (error) {
      console.error('Debounced scan error:', error);
    }
  }, debounceDelay);

  debounceTimers.set(workspacePath, timer);
}

export function clearCache(): void {
  scanCache.clear();
}

export function invalidateCacheForFile(filePath: string): void {
  // Since we cache by workspace, invalidate all caches that might contain this file
  for (const [workspacePath] of scanCache) {
    if (filePath.startsWith(workspacePath)) {
      scanCache.delete(workspacePath);
    }
  }
}
