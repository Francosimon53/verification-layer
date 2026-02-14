interface ScanFinding {
  severity: string;
  title: string;
  description?: string;
  file?: string;
  filePath?: string;
  line?: number;
  lineNumber?: number;
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

type CheckConclusion = 'success' | 'failure' | 'neutral';

const ANNOTATION_LEVELS: Record<string, 'failure' | 'warning' | 'notice'> = {
  critical: 'failure',
  high: 'warning',
  medium: 'warning',
  low: 'notice',
  info: 'notice',
};

/**
 * Create a GitHub Check Run with inline annotations for scan findings.
 */
export async function createCheckRun(
  token: string,
  repoFullName: string,
  sha: string,
  scanResults: ScanResults,
  conclusion: CheckConclusion
): Promise<number> {
  const score = scanResults.score ?? 0;
  const grade = scanResults.grade ?? 'N/A';
  const findings = scanResults.findings ?? [];
  const summary = scanResults.summary ?? {};
  const total = scanResults.totalFindings ?? findings.length;

  // Build summary text
  const summaryText = [
    `**Compliance Score:** ${score}/100 (Grade ${grade})`,
    `**Total Findings:** ${total}`,
    summary.critical ? `- \u{1F534} Critical: ${summary.critical}` : null,
    summary.high ? `- \u{1F7E0} High: ${summary.high}` : null,
    summary.medium ? `- \u{1F7E1} Medium: ${summary.medium}` : null,
    summary.low ? `- \u{1F535} Low: ${summary.low}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Build annotations (max 50 per API call)
  const annotations = findings
    .filter((f) => (f.filePath ?? f.file) && (f.lineNumber ?? f.line))
    .slice(0, 50)
    .map((f) => ({
      path: (f.filePath ?? f.file)!,
      start_line: f.lineNumber ?? f.line ?? 1,
      end_line: f.lineNumber ?? f.line ?? 1,
      annotation_level: ANNOTATION_LEVELS[f.severity] ?? 'notice',
      title: `[${f.severity.toUpperCase()}] ${f.title}`,
      message: f.description ?? f.title,
    }));

  const titleText =
    conclusion === 'success'
      ? `\u{2705} Score: ${score}/100 \u{00B7} ${total} findings`
      : `\u{274C} Score: ${score}/100 \u{00B7} ${summary.critical ?? 0} critical findings`;

  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/check-runs`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'VLayer HIPAA Compliance',
        head_sha: sha,
        status: 'completed',
        conclusion,
        output: {
          title: titleText,
          summary: summaryText,
          annotations,
        },
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to create check run (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.id;
}
