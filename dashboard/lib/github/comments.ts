interface ScanFinding {
  severity: string;
  title: string;
  file?: string;
  filePath?: string;
  line?: number;
  lineNumber?: number;
  hipaaReference?: string;
  hipaa_reference?: string;
  category?: string;
}

interface GroupedScanFinding {
  id: string;
  severity: string;
  title: string;
  occurrenceCount: number;
  fileCount: number;
  hipaaReference?: string;
  examples?: { file: string; line?: number }[];
  occurrences?: { file: string; line?: number }[];
}

interface ScanResults {
  score?: number;
  grade?: string;
  findings?: ScanFinding[];
  groupedFindings?: GroupedScanFinding[];
  rawFindingsCount?: number;
  totalFindings?: number;
  summary?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    total?: number;
    uniqueFindings?: number;
  };
}

/**
 * Strip GitHub Actions runner prefixes from file paths.
 * e.g. /home/runner/work/my-repo/my-repo/src/foo.ts → src/foo.ts
 */
function cleanRunnerPath(p: string): string {
  return p
    // /home/runner/work/{repo}/{repo}/... → relative path
    .replace(/^\/home\/runner\/work\/[^/]+\/[^/]+\//, '')
    // /tmp/vlayer-scan-*/*/ prefix (from dashboard scans)
    .replace(/^\/tmp\/vlayer-scan-[^/]+\/[^/]+\//, '')
    // Any remaining absolute /home/runner/work/... up to a known project dir
    .replace(/^\/home\/runner\/work\/.*?\/(src|lib|app|components|pages|public|test|tests|spec|__tests__|config|scripts|packages)\//,
      '$1/')
    // Strip leading ./ or /
    .replace(/^\.\//, '');
}

const SEVERITY_ICONS: Record<string, string> = {
  critical: '\u{1F534}',
  high: '\u{1F7E0}',
  medium: '\u{1F7E1}',
  low: '\u{1F535}',
  info: '\u{26AA}',
};

/**
 * Format scan results into a GitHub PR comment in Markdown.
 * Uses grouped findings for a concise, executive-level report.
 */
export function formatPRComment(scanResults: ScanResults, mode: string): string {
  const score = scanResults.score ?? 0;
  const grade = scanResults.grade ?? 'N/A';
  const grouped = scanResults.groupedFindings ?? [];
  const rawFindings = scanResults.findings ?? [];
  const summary = scanResults.summary ?? {};
  const rawTotal = scanResults.rawFindingsCount ?? scanResults.totalFindings ?? rawFindings.length;
  const uniqueCount = grouped.length || summary.uniqueFindings || rawTotal;
  const totalFiles = new Set([
    ...rawFindings.map(f => f.filePath ?? f.file ?? ''),
    ...grouped.flatMap(g => (g.examples ?? g.occurrences ?? []).map(o => o.file)),
  ].filter(Boolean)).size;

  // Headline — the first thing the CTO sees
  let md = `## \u{1F6E1}\u{FE0F} VLayer HIPAA Compliance Scan\n\n`;
  md += `**Found ${uniqueCount} types** of HIPAA violations across **${rawTotal.toLocaleString()} locations** in **${totalFiles} files**\n\n`;

  // Score badge
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| **Compliance Score** | **${score}/100** (Grade ${grade}) |\n`;
  if (summary.critical) md += `| \u{1F534} Critical | ${summary.critical} |\n`;
  if (summary.high) md += `| \u{1F7E0} High | ${summary.high} |\n`;
  if (summary.medium) md += `| \u{1F7E1} Medium | ${summary.medium} |\n`;
  if (summary.low) md += `| \u{1F535} Low | ${summary.low} |\n`;
  md += `\n`;

  // Mode notice
  if (mode === 'shadow') {
    md += `> \u{1F4AC} **Shadow Mode** \u{2014} This scan is informational only and will not block merging.\n\n`;
  } else if (mode === 'enforce' && (summary.critical ?? 0) > 0) {
    md += `> \u{1F6A8} **Enforce Mode** \u{2014} This PR has critical findings that must be resolved before merging.\n\n`;
  }

  // Grouped findings table
  if (grouped.length > 0) {
    md += `### Findings\n\n`;
    md += `| Severity | Violation Type | Count | Locations | HIPAA \u00A7 |\n`;
    md += `|----------|----------------|-------|-----------|--------|\n`;

    const shown = grouped.slice(0, 50);
    for (const g of shown) {
      const icon = SEVERITY_ICONS[g.severity] ?? '\u{26AA}';
      const ref = g.hipaaReference ?? '';
      const fileLabel = g.fileCount === 1 ? '1 file' : `${g.fileCount} files`;
      md += `| ${icon} ${g.severity.toUpperCase()} | ${g.title} | ${g.occurrenceCount} | ${fileLabel} | ${ref} |\n`;
    }

    if (grouped.length > 50) {
      md += `\n*\u{2026}and ${grouped.length - 50} more violation types.*\n`;
    }
    md += `\n`;

    // Drill-down link
    md += `\u{1F50D} [View full drill-down of all ${rawTotal.toLocaleString()} locations in VLayer Dashboard](https://app.vlayer.app)\n\n`;
  } else if (rawFindings.length > 0) {
    // Fallback for older scanner versions without grouped data
    md += `### Findings\n\n`;
    md += `| Severity | File | Line | Issue | HIPAA \u00A7 |\n`;
    md += `|----------|------|------|-------|--------|\n`;

    const shown = rawFindings.slice(0, 15);
    for (const f of shown) {
      const icon = SEVERITY_ICONS[f.severity] ?? '\u{26AA}';
      const file = cleanRunnerPath(f.filePath ?? f.file ?? '');
      const line = f.lineNumber ?? f.line ?? '';
      const ref = f.hipaaReference ?? f.hipaa_reference ?? '';
      md += `| ${icon} ${f.severity.toUpperCase()} | \`${file}\` | ${line} | ${f.title} | ${ref} |\n`;
    }

    if (rawFindings.length > 15) {
      md += `\n*\u{2026}and ${rawFindings.length - 15} more findings. [View full report](https://app.vlayer.app)*\n`;
    }
    md += `\n`;
  }

  // Footer
  md += `---\n`;
  md += `*Scanned by [VLayer HIPAA Compliance](https://app.vlayer.app) \u{00B7} `;
  md += `[Dashboard](https://app.vlayer.app) \u{00B7} `;
  md += `[Docs](https://app.vlayer.app/docs)*\n`;

  return md;
}

/**
 * Post a comment on a GitHub PR with scan results.
 * Updates existing VLayer comment if one already exists.
 */
export async function postPRComment(
  token: string,
  repoFullName: string,
  prNumber: number,
  scanResults: ScanResults,
  mode: string
): Promise<number> {
  const body = formatPRComment(scanResults, mode);
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  // Check for existing VLayer comment to update
  const listRes = await fetch(
    `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments?per_page=100`,
    { headers }
  );

  if (listRes.ok) {
    const comments = await listRes.json();
    const existing = comments.find((c: any) =>
      c.body?.includes('VLayer HIPAA Compliance Scan')
    );

    if (existing) {
      const updateRes = await fetch(
        `https://api.github.com/repos/${repoFullName}/issues/comments/${existing.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ body }),
        }
      );
      if (updateRes.ok) {
        const updated = await updateRes.json();
        return updated.id;
      }
    }
  }

  // Create new comment
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/issues/${prNumber}/comments`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to post PR comment (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.id;
}
