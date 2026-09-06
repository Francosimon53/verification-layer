/**
 * Multi-Factor Authentication (MFA) Scanner
 * Detects missing or bypassed MFA in authentication flows
 */

import * as fs from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_MFA_PATTERNS, type MFAPattern } from './patterns.js';
import { isImportLine, findWindowedViolations } from '../utils.js';

export const authenticationScanner: Scanner = {
  name: 'Multi-Factor Authentication Scanner',
  category: 'access-control', // Map to existing category for now

  async scan(files: string[], _options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Filter to code and config files
    const relevantFiles = files.filter((f) =>
      /\.(js|ts|jsx|tsx|json|yaml|yml|env)$/i.test(f)
    );

    for (const file of relevantFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (const pattern of ALL_MFA_PATTERNS) {
          // Special handling for MFA-001 (auth config files)
          if (pattern.id === 'MFA-001') {
            await scanAuthConfig(file, content, lines, pattern, findings);
            continue;
          }

          // Test/spec files legitimately use MFA-bypass helpers in their setup;
          // don't flag bypass code that only exists in tests.
          if (pattern.id === 'MFA-003' && /\.(?:test|spec)\.[jt]sx?$/i.test(file)) {
            continue;
          }

          // Multi-line aware matching with a bidirectional compliance window.
          // `console.*` is removed from the windowed negatives: it only means
          // "this is a log message, not real code" when the violation keyword is
          // ON the console line itself (judged per-anchor below) — not merely
          // present somewhere nearby, which wrongly hid real env-var bypasses.
          const windowedNegatives = (pattern.negativePatterns ?? []).filter(
            (p) => !/console/i.test(p.source),
          );
          const violations = findWindowedViolations(
            lines,
            pattern.patterns,
            windowedNegatives,
            { skipCommentLines: true, skipImportLines: true },
          );

          for (const v of violations) {
            // The matched keyword sits inside a console.* call → a log/message
            // string, not an actual MFA bypass.
            if (
              pattern.id === 'MFA-003' &&
              /console\.(?:log|warn|error)/i.test(lines[v.lineIndex])
            ) {
              continue;
            }
            findings.push({
              id: pattern.id,
              category: 'access-control',
              severity: pattern.severity,
              title: pattern.name,
              description: `${pattern.description}\n\nCode: ${v.code}`,
              file: file,
              line: v.lineIndex + 1,
              recommendation: pattern.recommendation,
              hipaaReference: pattern.hipaaReference,
              confidence: 'high',
            });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return findings;
  },
};

/**
 * Scan auth configuration files for missing MFA
 */
async function scanAuthConfig(
  file: string,
  content: string,
  lines: string[],
  pattern: MFAPattern,
  findings: Finding[]
): Promise<void> {
  // A Supabase SDK client is used for database/storage/admin operations as well
  // as authentication, so createClient() alone is not auth configuration evidence.
  // Preserve the existing auth-config heuristic only when the file itself is
  // auth-oriented or actually invokes a Supabase auth API. This prevents service-
  // role clients in webhooks/background jobs from being mislabeled as missing MFA.
  const hasDirectSupabaseSdkImport =
    /(?:from\s+['"]@supabase\/supabase-js['"]|require\(\s*['"]@supabase\/supabase-js['"]\s*\))/i.test(content);
  const hasDirectClientConstruction = lines.some(
    (line) => !isImportLine(line) && /createClient\s*\(/i.test(line),
  );
  const hasSupabaseAuthUsage = /\bsupabase\w*\.auth\./i.test(content);
  const hasAuthOrSupabaseConfigFilename =
    /(?:^|[\\/])(?:auth|supabase(?:-config)?)(?:[.\\/_-]|$)/i.test(file);
  const supabaseClientConfig =
    hasDirectSupabaseSdkImport &&
    hasDirectClientConstruction &&
    (hasSupabaseAuthUsage || hasAuthOrSupabaseConfigFilename);

  // Check if this is an auth-related file
  const isAuthFile =
    /(?:auth|clerk|supabase|next-auth)/i.test(file) ||
    pattern.patterns.some((p) => p.test(content)) ||
    supabaseClientConfig;

  if (!isAuthFile) return;

  // Check if file has any auth provider configuration
  const hasAuthConfig =
    pattern.patterns.some((p) => p.test(content)) || supabaseClientConfig;
  if (!hasAuthConfig) return;

  // Check if MFA is configured
  const hasMfaConfig = pattern.negativePatterns?.some((p) => p.test(content));
  if (hasMfaConfig) return;

  // Find the line with auth configuration. Skip import/require lines — anchoring
  // an "auth config without MFA" finding to an import line is misleading.
  let configLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isImportLine(lines[i])) continue;
    if (pattern.patterns.some((p) => p.test(lines[i]))) {
      configLine = i + 1;
      break;
    }
  }

  // For direct Supabase auth config, anchor the finding to the client constructor.
  if (configLine === 0 && supabaseClientConfig) {
    for (let i = 0; i < lines.length; i++) {
      if (/createClient\s*\(/i.test(lines[i]) && !isImportLine(lines[i])) {
        configLine = i + 1;
        break;
      }
    }
  }

  if (configLine === 0) return;

  // Create finding for auth config without MFA
  findings.push({
    id: pattern.id,
    category: 'access-control',
    severity: pattern.severity,
    title: pattern.name,
    description: `${pattern.description}\n\nFile contains auth configuration but no MFA setup detected.`,
    file: file,
    line: configLine,
    recommendation: pattern.recommendation,
    hipaaReference: pattern.hipaaReference,
    confidence: 'high',
  });
}
