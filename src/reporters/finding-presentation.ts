/**
 * Presentation-layer helpers for the HTML/PDF reports.
 *
 * IMPORTANT: this module is purely cosmetic. It never mutates findings, never
 * changes detection, and is NOT used to build the JSON output. It only decides
 * how rows are *grouped and labelled* in the rendered reports. The underlying
 * findings (and the JSON downstream tools depend on) are unchanged — every
 * finding still exists, it is just shown once per file:line when several rules
 * fire on the same location.
 */
import type { Finding, Severity } from '../types.js';

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/**
 * A finding is "proposed" when its HIPAA reference cites the NPRM (the proposed
 * 2026 Security Rule), not a current obligation. Such findings are still shown,
 * but they must not inflate a group's headline severity.
 */
export function isProposedFinding(f: Finding): boolean {
  return /\bNPRM\b/i.test(f.hipaaReference ?? '');
}

/** One screen entry: findings that share a (file, line, rule category). */
export interface LocationGroup {
  key: string;
  file: string;
  line: number | undefined;
  /** Rule category shared by all members (the "family"). */
  category: string;
  /** Headline severity — highest among CURRENT (non-proposed) members. */
  severity: Severity;
  /** Members, sorted highest-severity first then by title. */
  members: Finding[];
}

/** Highest severity among the given findings; null if the list is empty. */
function highestSeverity(findings: Finding[]): Severity | null {
  let best: Severity | null = null;
  for (const f of findings) {
    if (best === null || SEVERITY_RANK[f.severity] < SEVERITY_RANK[best]) best = f.severity;
  }
  return best;
}

/**
 * Group findings by (file + line + rule category). Several rules that flag the
 * same line for the SAME reason (e.g. all PHI-in-logs on route.ts:36) collapse
 * into one entry; unrelated rules on the same line (e.g. MFA + backup) stay as
 * separate rows. A single-member group renders as a normal row.
 *
 * The headline severity reflects only CURRENT requirements — proposed (NPRM)
 * findings never raise it (they stay listed inside with their own badge). When
 * every member is proposed, the highest proposed severity is used.
 *
 * Groups are ordered by group severity (critical first), then file, line, and
 * category. The total member count always equals the input length — nothing is
 * dropped.
 */
export function groupFindingsByLocation(findings: Finding[]): LocationGroup[] {
  const byKey = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = `${f.file}::${f.line ?? ''}::${f.category}`;
    const existing = byKey.get(key);
    if (existing) existing.push(f);
    else byKey.set(key, [f]);
  }

  const groups: LocationGroup[] = [];
  for (const [key, members] of byKey) {
    const sorted = [...members].sort(
      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.title.localeCompare(b.title),
    );
    const current = sorted.filter(f => !isProposedFinding(f));
    // Headline severity: highest among current findings; if the group is
    // entirely proposed, fall back to the highest proposed severity.
    const severity = highestSeverity(current.length > 0 ? current : sorted)!;
    groups.push({
      key,
      file: sorted[0].file,
      line: sorted[0].line,
      category: sorted[0].category,
      severity,
      members: sorted,
    });
  }

  groups.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.category.localeCompare(b.category),
  );
  return groups;
}

/** Count location-groups by their group severity (for summary/filter labels). */
export function countGroupsBySeverity(groups: LocationGroup[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const g of groups) counts[g.severity]++;
  return counts;
}

/**
 * Official 45 CFR Part 164 control names, keyed by section. Used only to fill in
 * the control name for findings whose hipaaReference is a bare citation
 * (e.g. "§164.502"). Findings that already carry a name keep their own wording.
 */
const SECTION_NAMES: Record<string, string> = {
  '164.308(a)(1)(ii)(A)': 'Risk Analysis',
  '164.308(a)(7)(ii)(A)': 'Data Backup Plan',
  '164.308(a)(8)': 'Evaluation',
  '164.312(a)(1)': 'Access Control',
  '164.312(a)(2)(i)': 'Unique User Identification',
  '164.312(a)(2)(iii)': 'Automatic Logoff',
  '164.312(a)(2)(iv)': 'Encryption and Decryption',
  '164.312(b)': 'Audit Controls',
  '164.312(c)': 'Integrity',
  '164.312(d)': 'Person or Entity Authentication',
  '164.312(e)(1)': 'Transmission Security',
  '164.502': 'Uses and Disclosures of PHI: General Rules',
  '164.502(b)': 'Minimum Necessary',
  '164.514': 'De-identification and Minimum Necessary',
  '164.530(j)': 'Documentation',
};

/** Progressively strip trailing "(...)" groups to find a fallback name. */
function nameForSection(section: string): string | undefined {
  let candidate = section;
  while (candidate) {
    if (SECTION_NAMES[candidate]) return SECTION_NAMES[candidate];
    const stripped = candidate.replace(/\([^)]*\)$/, '');
    if (stripped === candidate) break;
    candidate = stripped;
  }
  return undefined;
}

function normalizeOneRef(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '—') return null;

  const sectionMatch = trimmed.match(/(\d{3}\.\d+(?:\s*\([^)]*\))*)/);
  if (!sectionMatch) return trimmed; // unrecognised shape — leave untouched

  const section = sectionMatch[1].replace(/\s+/g, '');
  // NPRM refs cite a PROPOSED rule, not a current obligation — keep that
  // distinction explicit so the report never presents a proposed requirement
  // as enforceable.
  const isNprm = /\bNPRM\b/i.test(trimmed);
  // Inline control name = text after a dash delimiter, if present.
  const dashMatch = trimmed.match(/[-–—]\s*(.+)$/);
  const name = (dashMatch ? dashMatch[1].trim() : undefined) ?? nameForSection(section);

  const base = name ? `45 CFR §${section} — ${name}` : `45 CFR §${section}`;
  return isNprm ? `${base} (NPRM — proposed rule)` : base;
}

/**
 * Normalize any hipaaReference string to one canonical style:
 * "45 CFR §164.312(c) — Integrity Controls".
 *
 * Handles the three styles currently emitted by the scanners:
 *   - already-full  "45 CFR §164.312(c) - Integrity Controls"
 *   - bare section  "§164.502, §164.514"
 *   - NPRM-prefixed "NPRM §164.312(d) - Person or Entity Authentication"
 *     → kept distinct as a proposed rule:
 *       "45 CFR §164.312(d) — Person or Entity Authentication (NPRM — proposed rule)"
 *
 * Multi-section refs (comma-separated) are expanded into each canonical ref,
 * joined with "; ". The original string is never mutated on the finding object.
 */
export function formatHipaaRef(raw: string | undefined | null): string {
  if (!raw) return '—';
  // Split only at commas that begin a new citation, so control names that
  // happen to contain a comma are not broken apart.
  const parts = raw.split(/,\s*(?=(?:45 CFR|NPRM|§|\d{3}\.))/);
  const normalized = parts.map(normalizeOneRef).filter((p): p is string => Boolean(p));
  return normalized.length > 0 ? normalized.join('; ') : '—';
}
