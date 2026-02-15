/**
 * HIPAA 2026 Security Rule Scanner
 * Implements detection for 15 technical requirements (all now "required")
 * Expected enforcement: May 2026
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Scanner, Finding, ScanOptions } from '../../types.js';
import {
  ALL_HIPAA_2026_PATTERNS,
  type HIPAA2026Pattern,
} from './patterns.js';

interface AssetInventoryItem {
  type: 'database' | 'storage' | 'api' | 'third-party';
  name: string;
  file: string;
  line: number;
  processesPHI: boolean;
}

interface PHIFlowNode {
  stage: 'input' | 'processing' | 'storage' | 'output';
  file: string;
  line: number;
  context: string;
}

/**
 * Generate asset inventory for ePHI systems
 */
async function generateAssetInventory(
  file: string,
  content: string,
  lines: string[]
): Promise<AssetInventoryItem[]> {
  const assets: AssetInventoryItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Database assets
    if (/(?:mongoose|sequelize|prisma|typeorm)\.(?:connect|model)/i.test(line)) {
      assets.push({
        type: 'database',
        name: extractAssetName(line, 'database'),
        file,
        line: i + 1,
        processesPHI: /(?:patient|phi|medical|health)/i.test(content),
      });
    }

    // Storage assets
    if (/(?:s3|azure\.storage|gcs)\./i.test(line)) {
      assets.push({
        type: 'storage',
        name: extractAssetName(line, 'storage'),
        file,
        line: i + 1,
        processesPHI: /(?:patient|phi|medical)/i.test(content),
      });
    }

    // Third-party integrations
    if (/(?:stripe|twilio|sendgrid|mailgun)\.(?:api|client)/i.test(line)) {
      assets.push({
        type: 'third-party',
        name: extractAssetName(line, 'third-party'),
        file,
        line: i + 1,
        processesPHI: /(?:patient|phi|medical)/i.test(content),
      });
    }

    // API endpoints
    if (/(?:axios|fetch|got|request)\./i.test(line)) {
      assets.push({
        type: 'api',
        name: extractAssetName(line, 'api'),
        file,
        line: i + 1,
        processesPHI: /(?:patient|phi|medical)/i.test(content),
      });
    }
  }

  return assets;
}

/**
 * Map PHI data flow through system
 */
async function mapPHIFlow(
  file: string,
  content: string,
  lines: string[]
): Promise<PHIFlowNode[]> {
  const flows: PHIFlowNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Input points
    if (/(?:req\.body|req\.params|req\.query).*?(?:patient|phi|medical)/i.test(line)) {
      flows.push({
        stage: 'input',
        file,
        line: i + 1,
        context: line.trim(),
      });
    }

    // Processing
    if (/(?:process|transform|validate).*?(?:patient|phi)/i.test(line)) {
      flows.push({
        stage: 'processing',
        file,
        line: i + 1,
        context: line.trim(),
      });
    }

    // Storage
    if (/(?:save|insert|update|create).*?(?:patient|phi)/i.test(line)) {
      flows.push({
        stage: 'storage',
        file,
        line: i + 1,
        context: line.trim(),
      });
    }

    // Output
    if (/(?:res\.(?:send|json)|return).*?(?:patient|phi)/i.test(line)) {
      flows.push({
        stage: 'output',
        file,
        line: i + 1,
        context: line.trim(),
      });
    }
  }

  return flows;
}

/**
 * Check for vulnerability scanning configuration (project-level check)
 */
async function checkVulnerabilityScanning(projectRoot: string): Promise<boolean> {
  const configFiles = [
    '.github/dependabot.yml',
    '.github/dependabot.yaml',
    '.github/workflows/security.yml',
    '.github/workflows/security.yaml',
    '.snyk',
    '.semgrep.yml',
    '.semgrep.yaml',
    'snyk.json',
    '.trivyignore',
    'trivy.yaml',
  ];

  for (const configFile of configFiles) {
    try {
      await fs.access(path.join(projectRoot, configFile));
      return true;
    } catch {
      // File doesn't exist
    }
  }

  // Check all workflow files for security-related scanning
  try {
    const workflowDir = path.join(projectRoot, '.github', 'workflows');
    const entries = await fs.readdir(workflowDir);
    for (const entry of entries) {
      if (/security|codeql|snyk|trivy|semgrep|dependabot|vulnerability|sast|dast/i.test(entry)) {
        return true;
      }
      // Also check workflow content for scanning steps
      try {
        const content = await fs.readFile(path.join(workflowDir, entry), 'utf-8');
        if (/(?:snyk|trivy|semgrep|codeql|npm audit|security.scan|vulnerability)/i.test(content)) {
          return true;
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // No .github/workflows directory
  }

  // Check package.json for security scripts
  try {
    const packageJson = await fs.readFile(
      path.join(projectRoot, 'package.json'),
      'utf-8'
    );
    if (/(?:snyk|audit|security)/.test(packageJson)) {
      return true;
    }
  } catch {
    // No package.json
  }

  return false;
}

/**
 * Extract asset name from code line
 */
function extractAssetName(line: string, type: string): string {
  // Try to extract connection string or identifier
  const match = line.match(/['"`]([^'"`]+)['"`]/);
  if (match) return match[1];

  // Fallback to generic name
  return `${type}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Format asset inventory for report
 */
function formatAssetInventory(assets: AssetInventoryItem[]): string {
  const byType = assets.reduce(
    (acc, asset) => {
      if (!acc[asset.type]) acc[asset.type] = [];
      acc[asset.type].push(asset);
      return acc;
    },
    {} as Record<string, AssetInventoryItem[]>
  );

  let report = '## ePHI Technology Asset Inventory\n\n';

  for (const [type, items] of Object.entries(byType)) {
    report += `### ${type.toUpperCase()}\n`;
    for (const item of items) {
      const phi = item.processesPHI ? '⚠️ Processes PHI' : '';
      report += `- ${item.name} (${item.file}:${item.line}) ${phi}\n`;
    }
    report += '\n';
  }

  return report;
}

/**
 * Format PHI flow map for report
 */
function formatPHIFlowMap(flows: PHIFlowNode[]): string {
  const byStage = flows.reduce(
    (acc, flow) => {
      if (!acc[flow.stage]) acc[flow.stage] = [];
      acc[flow.stage].push(flow);
      return acc;
    },
    {} as Record<string, PHIFlowNode[]>
  );

  let report = '## ePHI Data Flow Map\n\n';
  const stages = ['input', 'processing', 'storage', 'output'] as const;

  for (const stage of stages) {
    const items = byStage[stage] || [];
    if (items.length === 0) continue;

    report += `### ${stage.toUpperCase()} (${items.length} points)\n`;
    for (const item of items.slice(0, 5)) {
      // Limit to 5 per stage
      report += `- ${item.file}:${item.line} - ${item.context.substring(0, 60)}...\n`;
    }
    if (items.length > 5) {
      report += `- ... and ${items.length - 5} more\n`;
    }
    report += '\n';
  }

  return report;
}

export const hipaa2026Scanner: Scanner = {
  name: 'HIPAA 2026 Security Rule Scanner',
  category: 'access-control',

  async scan(files: string[], options: ScanOptions): Promise<Finding[]> {
    const findings: Finding[] = [];
    const assetInventory: AssetInventoryItem[] = [];
    const phiFlowMap: PHIFlowNode[] = [];

    // Filter to code files only
    const codeFiles = files.filter((f) =>
      /\.(js|ts|jsx|tsx|py|java|go|rb|php|cs)$/i.test(f)
    );

    for (const file of codeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Scan each HIPAA 2026 pattern
        for (const pattern of ALL_HIPAA_2026_PATTERNS) {
          // Special handling for asset inventory
          if (pattern.id === 'HIPAA-ASSET-001') {
            const assets = await generateAssetInventory(file, content, lines);
            assetInventory.push(...assets);
            continue;
          }

          // Special handling for PHI flow mapping
          if (pattern.id === 'HIPAA-FLOW-001') {
            const flows = await mapPHIFlow(file, content, lines);
            phiFlowMap.push(...flows);
            continue;
          }

          // Skip project-level checks in per-file loop (handled after)
          if (pattern.id === 'HIPAA-PENTEST-001') {
            continue;
          }

          // Standard pattern matching
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            // Check if line matches violation pattern
            const matched = pattern.patterns.some((p) => p.test(line));
            if (!matched) continue;

            // Check if negative patterns indicate compliance
            const isCompliant =
              pattern.negativePatterns?.some((p) => {
                // Check current line and next 3 lines for compliance indicators
                const context = lines.slice(i, i + 4).join('\n');
                return p.test(context);
              }) || false;

            if (isCompliant) continue;

            // Create finding
            findings.push({
              id: pattern.id,
              category: pattern.category as any,
              severity: pattern.severity,
              title: pattern.name,
              description: `${pattern.description}\n\nCode: ${line.trim()}`,
              file: file,
              line: lineNumber,
              recommendation:
                pattern.autoFix ||
                `Address ${pattern.name} per ${pattern.hipaaReference}`,
              hipaaReference: pattern.hipaaReference,
              confidence: pattern.confidence,
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Project-level check: vulnerability scanning (once, not per-file)
    const pentestPattern = ALL_HIPAA_2026_PATTERNS.find(p => p.id === 'HIPAA-PENTEST-001');
    if (pentestPattern) {
      const hasVulnScanning = await checkVulnerabilityScanning(options.path);
      if (!hasVulnScanning) {
        findings.push({
          id: pentestPattern.id,
          category: pentestPattern.category as any,
          severity: pentestPattern.severity,
          title: pentestPattern.name,
          description: pentestPattern.description,
          file: 'project-level',
          line: 1,
          recommendation: pentestPattern.autoFix || '',
          hipaaReference: pentestPattern.hipaaReference,
          confidence: pentestPattern.confidence,
        });
      }
    }

    // Generate asset inventory finding
    if (assetInventory.length > 0) {
      findings.push({
        id: 'HIPAA-ASSET-001',
        category: 'data-retention',
        severity: 'high',
        title: 'ePHI Technology Asset Inventory Generated',
        description: `Found ${assetInventory.length} assets processing ePHI`,
        file: 'ASSET-INVENTORY',
        line: 1,
        recommendation: formatAssetInventory(assetInventory),
        hipaaReference:
          '45 CFR §164.308(a)(1)(ii)(A) - Risk Analysis (Required)',
        confidence: 'high',
      });
    }

    // Generate PHI flow map finding
    if (phiFlowMap.length > 0) {
      findings.push({
        id: 'HIPAA-FLOW-001',
        category: 'data-retention',
        severity: 'high',
        title: 'ePHI Flow Map Generated',
        description: `Identified ${phiFlowMap.length} PHI data flow points`,
        file: 'PHI-FLOW-MAP',
        line: 1,
        recommendation: formatPHIFlowMap(phiFlowMap),
        hipaaReference:
          '45 CFR §164.308(a)(1)(ii)(A) - Risk Analysis (Required)',
        confidence: 'high',
      });
    }

    return findings;
  },
};
