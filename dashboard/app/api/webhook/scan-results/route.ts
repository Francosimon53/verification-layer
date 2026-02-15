import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/github/api-keys';
import { getInstallationToken } from '@/lib/github/auth';
import { postPRComment } from '@/lib/github/comments';
import { createCheckRun } from '@/lib/github/checks';
import { createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // 1. Validate API key
    const authHeader = req.headers.get('authorization') ?? '';
    const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim();

    const { valid, installationId } = await validateApiKey(apiKey);
    if (!valid || !installationId) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }

    // 2. Extract metadata from headers
    const repoFullName = req.headers.get('x-github-repository') ?? '';
    const prNumberStr = req.headers.get('x-github-pr') ?? '';
    const sha = req.headers.get('x-github-sha') ?? '';
    const prNumber = parseInt(prNumberStr, 10);

    if (!repoFullName || !prNumber || !sha) {
      return NextResponse.json(
        { error: 'Missing required headers: X-GitHub-Repository, X-GitHub-PR, X-GitHub-SHA' },
        { status: 400 }
      );
    }

    // 3. Parse scan results from body
    const scanResults = await req.json();

    const score = scanResults.score ?? 0;
    const grade = scanResults.grade ?? 'N/A';
    const findings = scanResults.findings ?? [];
    const summary = scanResults.summary ?? {};
    const totalFindings = scanResults.totalFindings ?? findings.length;

    // 4. Save to Supabase
    const supabase = createAdminClient();

    const { data: scanRecord, error: insertError } = await supabase
      .from('pr_scans')
      .insert({
        installation_id: installationId,
        repo_full_name: repoFullName,
        pr_number: prNumber,
        commit_sha: sha,
        score,
        grade,
        total_findings: totalFindings,
        critical_count: summary.critical ?? 0,
        high_count: summary.high ?? 0,
        medium_count: summary.medium ?? 0,
        low_count: summary.low ?? 0,
        report_json: scanResults,
        files_scanned: scanResults.filesScanned ?? 0,
        scan_duration_ms: scanResults.scanDurationMs ?? 0,
        status: 'complete',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[scan-results] Failed to save scan:', insertError.message);
    }

    // 5. Get installation token for GitHub API calls
    const token = await getInstallationToken(installationId);

    // 6. Read .vlayer.yml to determine mode
    const mode = await getRepoMode(token, repoFullName);

    // 7. Post PR comment
    let commentId: number | null = null;
    try {
      commentId = await postPRComment(token, repoFullName, prNumber, scanResults, mode);
    } catch (err: any) {
      console.error('[scan-results] Failed to post comment:', err.message);
    }

    // 8. Create Check Run
    let checkRunId: number | null = null;
    try {
      // Shadow mode: always success. Enforce mode: failure if critical findings
      const conclusion =
        mode === 'enforce' && (summary.critical ?? 0) > 0 ? 'failure' : 'success';

      checkRunId = await createCheckRun(token, repoFullName, sha, scanResults, conclusion);
    } catch (err: any) {
      console.error('[scan-results] Failed to create check run:', err.message);
    }

    // 9. Update scan record with comment/check IDs
    if (scanRecord?.id && (commentId || checkRunId)) {
      await supabase
        .from('pr_scans')
        .update({
          comment_id: commentId,
          check_run_id: checkRunId,
        })
        .eq('id', scanRecord.id);
    }

    return NextResponse.json({
      ok: true,
      scan_id: scanRecord?.id ?? null,
      score,
      grade,
      findings: totalFindings,
      comment_id: commentId,
      check_run_id: checkRunId,
    });
  } catch (err: any) {
    console.error('[scan-results] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * Read .vlayer.yml from the repo to determine scan mode.
 * Defaults to 'shadow' if the file doesn't exist or can't be read.
 */
async function getRepoMode(token: string, repoFullName: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/contents/.vlayer.yml`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.raw+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!res.ok) return 'shadow';

    const content = await res.text();
    // Simple YAML parsing — look for mode: enforce
    const modeMatch = content.match(/^mode:\s*(\w+)/m);
    return modeMatch?.[1] === 'enforce' ? 'enforce' : 'shadow';
  } catch {
    return 'shadow';
  }
}
