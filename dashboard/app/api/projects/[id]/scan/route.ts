import { NextResponse } from 'next/server';
import { mkdtempSync, rmSync, createWriteStream, readdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import path from 'path';
import os from 'os';
import { x as tarExtract } from 'tar';
import { scan as vlayerScan, calculateComplianceScore } from 'verification-layer';
import {
  getProject,
  setProjectStatus,
  updateProjectAfterScan,
  createScan,
  createFindings,
} from '@/lib/storage';

export const maxDuration = 60;

/** Parse owner/repo from a GitHub URL */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/.\s]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/** Download and extract a GitHub repo tarball to destDir. Tries main, then master. */
async function downloadRepo(owner: string, repo: string, destDir: string): Promise<string> {
  const branches = ['main', 'master'];

  for (const branch of branches) {
    const url = `https://api.github.com/repos/${owner}/${repo}/tarball/${branch}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'vlayer-dashboard' },
      redirect: 'follow',
    });

    if (res.status === 404) continue;
    if (!res.ok) continue;

    // Stream the tarball to a temp file, then extract
    const tarPath = path.join(destDir, 'repo.tar.gz');
    const body = res.body;
    if (!body) throw new Error('Empty response body');

    const writeStream = createWriteStream(tarPath);
    await pipeline(Readable.fromWeb(body as any), writeStream);

    // Extract tarball — GitHub tarballs have a top-level directory like owner-repo-sha/
    await tarExtract({ file: tarPath, cwd: destDir });

    // Find the extracted directory (first dir entry)
    const entries = readdirSync(destDir).filter(e => e !== 'repo.tar.gz');
    if (entries.length === 0) throw new Error('Tarball extraction produced no files');

    return path.join(destDir, entries[0]);
  }

  throw new Error(`Could not download repository: ${owner}/${repo} (tried main and master branches)`);
}

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

    const ghRepo = parseGitHubUrl(project.repoUrl);
    if (!ghRepo) {
      return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
    }

    // 2. Set status to scanning
    await setProjectStatus(id, 'scanning');

    // 3. Download repo tarball to temp dir
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'vlayer-scan-'));
    const repoPath = await downloadRepo(ghRepo.owner, ghRepo.repo, tmpDir);

    // 4. Run vlayer scan (programmatic API — no CLI binary needed)
    const scanResult = await vlayerScan({ path: repoPath });

    // 5. Calculate compliance score
    const complianceScore = calculateComplianceScore(scanResult);

    // 6. Parse results
    const score = complianceScore.score;
    const grade = complianceScore.grade;
    const status = score >= 90 ? 'compliant' : score >= 70 ? 'at_risk' : 'critical';
    const breakdown = complianceScore.breakdown;
    const findings = scanResult.findings ?? [];
    const timestamp = new Date().toISOString();

    // 7. Save scan record
    const dbScan = await createScan({
      projectId: id,
      score,
      grade,
      totalFindings: breakdown.total,
      criticalCount: breakdown.critical,
      highCount: breakdown.high,
      mediumCount: breakdown.medium,
      lowCount: breakdown.low,
      filesScanned: scanResult.scannedFiles ?? 0,
      scanDurationMs: scanResult.scanDuration ?? 0,
      reportJson: { ...scanResult, complianceScore },
    });

    // 8. Save findings
    if (findings.length > 0) {
      await createFindings(
        findings.map((f) => ({
          projectId: id,
          scanId: dbScan.id,
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
        total: breakdown.total,
        critical: breakdown.critical,
        high: breakdown.high,
        medium: breakdown.medium,
        low: breakdown.low,
        info: 0,
      },
      stackInfo: scanResult.stack ?? {},
      lastScanAt: timestamp,
    });

    return NextResponse.json({
      scan: { id: dbScan.id, score, grade, status },
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
