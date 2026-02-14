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

interface ScanResults {
  score?: number;
  grade?: string;
  findings?: ScanFinding[];
  totalFindings?: number;
  summary?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    total?: number;
  };
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
 */
export function formatPRComment(scanResults: ScanResults, mode: string): string {
  const score = scanResults.score ?? 0;
  const grade = scanResults.grade ?? 'N/A';
  const findings = scanResults.findings ?? [];
  const summary = scanResults.summary ?? {};
  const total = scanResults.totalFindings ?? findings.length;

  let md = `## \u{1F6E1}\u{FE0F} VLayer HIPAA Compliance Scan\n\n`;

  // Score section
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| **Compliance Score** | **${score}/100** (Grade ${grade}) |\n`;
  md += `| **Total Findings** | ${total} |\n`;
  if (summary.critical) md += `| \u{1F534} Critical | ${summary.critical} |\n`;
  if (summary.high) md += `| \u{1F7E0} High | ${summary.high} |\n`;
  if (summary.medium) md += `| \u{1F7E1} Medium | ${summary.medium} |\n`;
  if (summary.low) md += `| \u{1F535} Low | ${summary.low} |\n`;
  md += `\n`;

  // Shadow mode notice
  if (mode === 'shadow') {
    md += `> \u{1F4AC} **Shadow Mode** — This scan is informational only and will not block merging.\n\n`;
  } else if (mode === 'enforce' && (summary.critical ?? 0) > 0) {
    md += `> \u{1F6A8} **Enforce Mode** — This PR has critical findings that must be resolved before merging.\n\n`;
  }

  // Findings table (top 15)
  if (findings.length > 0) {
    md += `### Findings\n\n`;
    md += `| Severity | File | Line | Issue | HIPAA \u00A7 |\n`;
    md += `|----------|------|------|-------|--------|\n`;

    const shown = findings.slice(0, 15);
    for (const f of shown) {
      const icon = SEVERITY_ICONS[f.severity] ?? '\u{26AA}';
      const file = f.filePath ?? f.file ?? '';
      const line = f.lineNumber ?? f.line ?? '';
      const ref = f.hipaaReference ?? f.hipaa_reference ?? '';
      md += `| ${icon} ${f.severity} | \`${file}\` | ${line} | ${f.title} | ${ref} |\n`;
    }

    if (findings.length > 15) {
      md += `\n*...and ${findings.length - 15} more findings. [View full report on VLayer](https://app.vlayer.app)*\n`;
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
