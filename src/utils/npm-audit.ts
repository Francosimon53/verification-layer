import { exec } from 'child_process';
import { promisify } from 'util';
import type { DependencyVulnerability } from '../types.js';

const execAsync = promisify(exec);

interface NpmAuditVulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  via: string | Array<{ title: string; url: string }>;
  range: string;
  fixAvailable: boolean | { name: string; version: string };
}

interface NpmAuditOutput {
  vulnerabilities: Record<string, NpmAuditVulnerability>;
  metadata: {
    vulnerabilities: {
      total: number;
      critical: number;
      high: number;
      moderate: number;
      low: number;
      info: number;
    };
  };
}

export async function runNpmAudit(
  projectPath: string
): Promise<{ vulnerabilities: DependencyVulnerability[]; error?: string }> {
  try {
    // Execute npm audit --json in the project directory
    const { stdout } = await execAsync('npm audit --json', {
      cwd: projectPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 30000, // 30 second timeout
    });

    // Parse the JSON output
    const auditResult: NpmAuditOutput = JSON.parse(stdout);

    // Extract and transform vulnerabilities
    const vulnerabilities: DependencyVulnerability[] = [];

    for (const [packageName, vuln] of Object.entries(auditResult.vulnerabilities || {})) {
      // Extract URL from via if it's an array
      let url: string | undefined;
      let via = '';

      if (Array.isArray(vuln.via)) {
        // via is an array of vulnerability details
        const firstVia = vuln.via[0];
        if (typeof firstVia === 'object' && 'url' in firstVia) {
          url = firstVia.url;
          via = firstVia.title || packageName;
        } else {
          via = String(firstVia);
        }
      } else {
        via = String(vuln.via);
      }

      vulnerabilities.push({
        name: packageName,
        severity: vuln.severity,
        via,
        range: vuln.range,
        fixAvailable: vuln.fixAvailable,
        url,
      });
    }

    return { vulnerabilities };
  } catch (error: any) {
    // npm audit exits with non-zero if vulnerabilities are found
    // Check if error contains JSON output
    if (error.stdout) {
      try {
        const auditResult: NpmAuditOutput = JSON.parse(error.stdout);
        const vulnerabilities: DependencyVulnerability[] = [];

        for (const [packageName, vuln] of Object.entries(auditResult.vulnerabilities || {})) {
          let url: string | undefined;
          let via = '';

          if (Array.isArray(vuln.via)) {
            const firstVia = vuln.via[0];
            if (typeof firstVia === 'object' && 'url' in firstVia) {
              url = firstVia.url;
              via = firstVia.title || packageName;
            } else {
              via = String(firstVia);
            }
          } else {
            via = String(vuln.via);
          }

          vulnerabilities.push({
            name: packageName,
            severity: vuln.severity,
            via,
            range: vuln.range,
            fixAvailable: vuln.fixAvailable,
            url,
          });
        }

        return { vulnerabilities };
      } catch {
        // Failed to parse JSON from error output
      }
    }

    // Real error - npm audit failed or not available
    const errorMessage = error.message || 'Unknown error';

    // Common error scenarios
    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      return { vulnerabilities: [], error: 'npm command not found. Is Node.js/npm installed?' };
    }

    if (errorMessage.includes('package.json')) {
      return { vulnerabilities: [], error: 'No package.json found in project directory' };
    }

    return { vulnerabilities: [], error: `npm audit failed: ${errorMessage}` };
  }
}
