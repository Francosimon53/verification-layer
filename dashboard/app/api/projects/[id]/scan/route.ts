import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import {
  getProject,
  setProjectStatus,
  updateProjectAfterScan,
  createScan,
  createFindings,
} from '@/lib/storage';

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let tmpDir = '';
  try {
    // 1. Get project
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!project.repoUrl) {
      return NextResponse.json({ error: 'No repository URL configured' }, { status: 400 });
    }

    // 2. Set status to scanning
    await setProjectStatus(id, 'scanning');

    // 3. Clone repo to temp dir
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'vlayer-scan-'));
    const clonePath = path.join(tmpDir, 'repo');

    execSync(`git clone --depth 1 ${project.repoUrl} ${clonePath}`, {
      timeout: 30000,
      stdio: 'pipe',
    });

    // 4. Run vlayer scan
    const vlayerBin = path.join(process.cwd(), 'node_modules', '.bin', 'vlayer');

    let scanJson: any;
    try {
      const scanOutput = execSync(`${vlayerBin} scan ${clonePath} --format json`, {
        timeout: 30000,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      scanJson = JSON.parse(scanOutput);
    } catch (e: any) {
      // vlayer may write to stderr but still produce valid JSON on stdout
      if (e.stdout) {
        scanJson = JSON.parse(e.stdout);
      } else {
        throw new Error('vlayer scan failed: ' + (e.message || 'unknown error'));
      }
    }

    // 5. Run vlayer score
    let scoreJson: any;
    try {
      const scoreOutput = execSync(`${vlayerBin} score ${clonePath} --format json`, {
        timeout: 15000,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      scoreJson = JSON.parse(scoreOutput);
    } catch (e: any) {
      if (e.stdout) {
        scoreJson = JSON.parse(e.stdout);
      } else {
        scoreJson = { score: 0, grade: 'F', status: 'CRITICAL' };
      }
    }

    // 6. Parse results
    const score = scoreJson.score ?? 0;
    const grade = scoreJson.grade ?? 'F';
    const status = score >= 90 ? 'compliant' : score >= 70 ? 'at_risk' : 'critical';
    const summary = scanJson.summary ?? {};
    const findings = scanJson.findings ?? [];
    const timestamp = scanJson.timestamp ?? new Date().toISOString();

    // 7. Save scan record
    const scan = await createScan({
      projectId: id,
      score,
      grade,
      totalFindings: summary.total ?? findings.length,
      criticalCount: summary.critical ?? 0,
      highCount: summary.high ?? 0,
      mediumCount: summary.medium ?? 0,
      lowCount: summary.low ?? 0,
      filesScanned: scanJson.scannedFiles ?? 0,
      scanDurationMs: scanJson.scanDuration ?? 0,
      reportJson: scanJson,
    });

    // 8. Save findings
    if (findings.length > 0) {
      await createFindings(
        findings.map((f: any) => ({
          projectId: id,
          scanId: scan.id,
          findingId: f.id || crypto.randomUUID(),
          category: f.category || 'unknown',
          severity: f.severity || 'info',
          title: f.title || 'Untitled finding',
          description: f.description,
          filePath: f.file,
          lineNumber: f.line,
          recommendation: f.recommendation,
          hipaaReference: f.hipaaReference,
          confidence: f.confidence,
          context: f.context,
        }))
      );
    }

    // 9. Update project
    await updateProjectAfterScan(id, {
      complianceScore: score,
      grade,
      status,
      findingsSummary: {
        total: summary.total ?? findings.length,
        critical: summary.critical ?? 0,
        high: summary.high ?? 0,
        medium: summary.medium ?? 0,
        low: summary.low ?? 0,
        info: summary.info ?? 0,
      },
      stackInfo: scanJson.stack ?? {},
      lastScanAt: timestamp,
    });

    return NextResponse.json({
      scan: { id: scan.id, score, grade, status },
      findingsCount: findings.length,
    });
  } catch (error: any) {
    console.error('Scan failed:', error);
    // Reset status on failure
    try { await setProjectStatus(id, 'pending'); } catch {}
    return NextResponse.json(
      { error: error.message || 'Scan failed' },
      { status: 500 }
    );
  } finally {
    // Cleanup temp directory
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }
}
