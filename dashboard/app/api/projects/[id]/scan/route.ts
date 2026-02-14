import { NextResponse } from 'next/server';
import { mkdtempSync, rmSync, createWriteStream, readdirSync, statSync } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import path from 'path';
import os from 'os';
import { x as tarExtract } from 'tar';
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
    console.log(`[scan] Trying tarball: ${url}`);

    const res = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'vlayer-dashboard' },
      redirect: 'follow',
    });

    console.log(`[scan] GitHub response: ${res.status} ${res.statusText}`);
    if (res.status === 404) continue;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.log(`[scan] GitHub error body: ${text.slice(0, 500)}`);
      continue;
    }

    // Stream the tarball to a temp file, then extract
    const tarPath = path.join(destDir, 'repo.tar.gz');
    const body = res.body;
    if (!body) throw new Error('Empty response body from GitHub');

    console.log(`[scan] Downloading tarball to ${tarPath}...`);
    const writeStream = createWriteStream(tarPath);
    await pipeline(Readable.fromWeb(body as any), writeStream);

    const tarSize = statSync(tarPath).size;
    console.log(`[scan] Downloaded ${tarSize} bytes. Extracting...`);

    // Extract tarball
    await tarExtract({ file: tarPath, cwd: destDir });

    // Find the extracted directory
    const entries = readdirSync(destDir).filter(e => e !== 'repo.tar.gz');
    console.log(`[scan] Extracted entries: ${JSON.stringify(entries)}`);
    if (entries.length === 0) throw new Error('Tarball extraction produced no files');

    const repoPath = path.join(destDir, entries[0]);
    const repoContents = readdirSync(repoPath);
    console.log(`[scan] Repo contents (first 20): ${JSON.stringify(repoContents.slice(0, 20))}`);

    return repoPath;
  }

  throw new Error(`Could not download repository: ${owner}/${repo} (tried main and master branches)`);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let currentStep = 'init';
  let tmpDir = '';

  try {
    // 0. Check that verification-layer is importable
    currentStep = 'import-check';
    console.log('[scan] Step 0: Checking verification-layer import...');
    let vlayerScan: any;
    let calculateComplianceScore: any;
    try {
      const vl = await import('verification-layer');
      vlayerScan = vl.scan;
      calculateComplianceScore = vl.calculateComplianceScore;
      console.log(`[scan] verification-layer loaded. scan=${typeof vlayerScan}, score=${typeof calculateComplianceScore}`);
    } catch (importErr: any) {
      console.error('[scan] Failed to import verification-layer:', importErr);
      return NextResponse.json({
        error: 'verification-layer not installed or not importable',
        details: importErr.message,
        stack: importErr.stack?.split('\n').slice(0, 5),
        step: currentStep,
      }, { status: 500 });
    }

    // 1. Get project
    currentStep = 'get-project';
    console.log(`[scan] Step 1: Getting project ${id}...`);
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found', step: currentStep }, { status: 404 });
    }
    if (!project.repoUrl) {
      return NextResponse.json({ error: 'No repository URL configured', step: currentStep }, { status: 400 });
    }
    console.log(`[scan] Project: ${project.name}, repo: ${project.repoUrl}`);

    const ghRepo = parseGitHubUrl(project.repoUrl);
    if (!ghRepo) {
      return NextResponse.json({ error: 'Invalid GitHub URL: ' + project.repoUrl, step: currentStep }, { status: 400 });
    }

    // 2. Set status to scanning
    currentStep = 'set-status';
    console.log('[scan] Step 2: Setting status to scanning...');
    await setProjectStatus(id, 'scanning');

    // 3. Download repo
    currentStep = 'download';
    console.log(`[scan] Step 3: Downloading ${ghRepo.owner}/${ghRepo.repo}...`);
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'vlayer-scan-'));
    console.log(`[scan] Temp dir: ${tmpDir}`);
    const repoPath = await downloadRepo(ghRepo.owner, ghRepo.repo, tmpDir);
    console.log(`[scan] Repo downloaded to: ${repoPath}`);

    // 4. Run vlayer scan
    currentStep = 'vlayer-scan';
    console.log(`[scan] Step 4: Running vlayerScan({ path: "${repoPath}" })...`);
    const scanResult = await vlayerScan({ path: repoPath });
    console.log(`[scan] Scan complete: ${scanResult.findings?.length ?? 0} findings, ${scanResult.scannedFiles ?? 0} files`);

    // 5. Calculate compliance score
    currentStep = 'score';
    console.log('[scan] Step 5: Calculating compliance score...');
    const complianceScore = calculateComplianceScore(scanResult);
    console.log(`[scan] Score: ${complianceScore.score}, grade: ${complianceScore.grade}`);

    // 6. Parse results
    currentStep = 'parse';
    const score = complianceScore.score;
    const grade = complianceScore.grade;
    const status = score >= 90 ? 'compliant' : score >= 70 ? 'at_risk' : 'critical';
    const breakdown = complianceScore.breakdown;
    const findings = scanResult.findings ?? [];
    const timestamp = new Date().toISOString();

    // 7. Save scan record
    currentStep = 'save-scan';
    console.log('[scan] Step 6: Saving scan record to Supabase...');
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
    console.log(`[scan] Scan saved: ${dbScan.id}`);

    // 8. Save findings
    currentStep = 'save-findings';
    console.log(`[scan] Step 7: Saving ${findings.length} findings...`);
    if (findings.length > 0) {
      await createFindings(
        findings.map((f: any) => ({
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
    console.log('[scan] Findings saved');

    // 9. Update project
    currentStep = 'update-project';
    console.log('[scan] Step 8: Updating project...');
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
    console.log('[scan] Project updated. Done!');

    return NextResponse.json({
      scan: { id: dbScan.id, score, grade, status },
      findingsCount: findings.length,
    });
  } catch (error: any) {
    console.error(`[scan] FAILED at step "${currentStep}":`, error);
    // Reset status on failure
    try { await setProjectStatus(id, 'pending'); } catch {}
    return NextResponse.json(
      {
        error: error.message || 'Scan failed',
        step: currentStep,
        stack: error.stack?.split('\n').slice(0, 8),
        code: error.code,
      },
      { status: 500 }
    );
  } finally {
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }
}
