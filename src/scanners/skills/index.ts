/**
 * AI Agent Skills Security Scanner
 * Scans SKILL.md files for HIPAA violations and security issues
 */

import { readFile } from 'fs/promises';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import { ALL_SKILL_PATTERNS } from './patterns.js';

export const skillsScanner: Scanner = {
  name: 'AI Agent Skills Scanner',
  category: 'access-control',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Filter to only SKILL.md files
    const skillFiles = files.filter(
      (f) =>
        f.endsWith('SKILL.md') ||
        f.endsWith('skill.md') ||
        f.endsWith('.skill.md') ||
        f.includes('/skills/') ||
        f.includes('/.clawrc/')
    );

    if (skillFiles.length === 0) {
      return findings;
    }

    console.log(`🔍 Scanning ${skillFiles.length} AI Agent Skill file(s)...`);

    for (const file of skillFiles) {
      try {
        const content = await readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Scan each pattern
        for (const pattern of ALL_SKILL_PATTERNS) {
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(pattern.pattern);

            if (match) {
              // Extract context (±3 lines)
              const contextStart = Math.max(0, i - 3);
              const contextEnd = Math.min(lines.length, i + 4);
              const context = lines
                .slice(contextStart, contextEnd)
                .map((l, idx) => ({
                  lineNumber: contextStart + idx + 1,
                  content: l,
                  isMatch: contextStart + idx === i,
                }));

              findings.push({
                id: pattern.id,
                category: mapCategoryToCompliance(pattern.category),
                severity: pattern.severity,
                title: pattern.name,
                description: pattern.description,
                file,
                line: i + 1,
                recommendation: pattern.recommendation,
                hipaaReference: pattern.hipaaReference,
                context,
                confidence: 'high',
              });
            }
          }
        }

        // Additional analysis: check for skill metadata
        const metadata = extractSkillMetadata(content);

        // Warn if skill requests broad permissions
        if (metadata.permissions?.includes('*') || metadata.permissions?.includes('all')) {
          findings.push({
            id: 'skill-excessive-permissions',
            category: 'access-control',
            severity: 'high',
            title: 'Skill requests excessive permissions',
            description: `Skill requests wildcard permissions (*). This violates principle of least privilege.`,
            file,
            line: metadata.permissionsLine || 1,
            recommendation: 'Limit skill permissions to specific actions needed. Use whitelist approach.',
            hipaaReference: '§164.308(a)(4) - Access Controls',
            confidence: 'high',
          });
        }

        // Warn if skill has no author/source
        if (!metadata.author && !metadata.source) {
          findings.push({
            id: 'skill-unknown-author',
            category: 'access-control',
            severity: 'medium',
            title: 'Skill from unknown/unverified source',
            description: 'Skill has no author or source attribution. Cannot verify authenticity.',
            file,
            line: 1,
            recommendation: 'Only install skills from trusted sources (e.g., verified ClawHub publishers).',
            confidence: 'medium',
          });
        }

        // Check if skill modifies system files
        if (/(?:rm|mv|chmod|chown)\s+-rf?\s+\//.test(content)) {
          findings.push({
            id: 'skill-system-modification',
            category: 'access-control',
            severity: 'critical',
            title: 'Skill attempts to modify system files',
            description: 'Skill contains commands that modify critical system files',
            file,
            line: content.split('\n').findIndex((l) => /(?:rm|mv|chmod|chown)\s+-rf?\s+\//.test(l)) + 1,
            recommendation: 'REJECT THIS SKILL. System file modifications are extremely dangerous.',
            confidence: 'high',
          });
        }
      } catch (error) {
        console.error(`Error scanning skill file ${file}:`, error);
      }
    }

    return findings;
  },
};

function mapCategoryToCompliance(
  skillCategory: string
): 'phi-exposure' | 'encryption' | 'access-control' | 'audit-logging' | 'data-retention' {
  switch (skillCategory) {
    case 'phi-exposure':
      return 'phi-exposure';
    case 'credential-leak':
      return 'access-control';
    case 'malicious':
      return 'access-control';
    case 'hipaa-violation':
      return 'encryption'; // Map to encryption as many are about secure transmission
    default:
      return 'access-control';
  }
}

interface SkillMetadata {
  author?: string;
  source?: string;
  permissions?: string[];
  permissionsLine?: number;
  version?: string;
  name?: string;
}

function extractSkillMetadata(content: string): SkillMetadata {
  const metadata: SkillMetadata = {};
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract author
    const authorMatch = line.match(/(?:author|by|created.by):\s*(.+)/i);
    if (authorMatch) {
      metadata.author = authorMatch[1].trim();
    }

    // Extract source
    const sourceMatch = line.match(/(?:source|repository|url):\s*(.+)/i);
    if (sourceMatch) {
      metadata.source = sourceMatch[1].trim();
    }

    // Extract permissions
    const permMatch = line.match(/(?:permissions?|requires?):\s*(.+)/i);
    if (permMatch) {
      metadata.permissions = permMatch[1].split(',').map((p) => p.trim());
      metadata.permissionsLine = i + 1;
    }

    // Extract version
    const versionMatch = line.match(/(?:version):\s*(.+)/i);
    if (versionMatch) {
      metadata.version = versionMatch[1].trim();
    }

    // Extract name
    const nameMatch = line.match(/^#\s+(.+)/);
    if (nameMatch && !metadata.name) {
      metadata.name = nameMatch[1].trim();
    }
  }

  return metadata;
}
