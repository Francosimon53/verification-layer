/**
 * Marketplace Rules Installer
 * Downloads and installs community rules
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MarketplaceRegistry } from './registry.js';
import type { MarketplaceRule, InstalledRule, InstallationConfig } from './types.js';

const MARKETPLACE_DIR = '.vlayer/marketplace';
const INSTALLED_RULES_FILE = `${MARKETPLACE_DIR}/installed.json`;

export class RulesInstaller {
  private registry: MarketplaceRegistry;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.registry = new MarketplaceRegistry();
    this.projectRoot = projectRoot;
  }

  /**
   * Install a rule from the marketplace
   */
  async install(ruleId: string, version?: string): Promise<InstalledRule> {
    // Fetch rule from registry
    const rule = await this.registry.getRule(ruleId);
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    // Check version match
    if (version && rule.version !== version) {
      throw new Error(
        `Rule version mismatch. Requested: ${version}, Available: ${rule.version}`
      );
    }

    // Ensure marketplace directory exists
    await this.ensureMarketplaceDir();

    // Convert to vlayer custom rule format
    const customRule = this.convertToCustomRule(rule);

    // Save rule file
    const ruleFilePath = path.join(
      this.projectRoot,
      MARKETPLACE_DIR,
      `${ruleId}.yaml`
    );

    const yaml = this.generateYAML(customRule);
    await fs.writeFile(ruleFilePath, yaml, 'utf-8');

    // Track installation
    const installed: InstalledRule = {
      id: ruleId,
      source: 'marketplace',
      version: rule.version,
      installedAt: new Date().toISOString(),
      enabled: true,
      config: {
        ruleId,
        version: rule.version,
        enabled: true,
      },
    };

    await this.trackInstallation(installed);

    return installed;
  }

  /**
   * Install a package (collection of rules)
   */
  async installPackage(packageId: string): Promise<InstalledRule[]> {
    const pkg = await this.registry.getPackage(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    const installed: InstalledRule[] = [];

    for (const ruleId of pkg.rules) {
      try {
        const rule = await this.install(ruleId);
        installed.push(rule);
      } catch (error) {
        console.error(`Failed to install rule ${ruleId}:`, error);
      }
    }

    return installed;
  }

  /**
   * Uninstall a rule
   */
  async uninstall(ruleId: string): Promise<void> {
    const ruleFilePath = path.join(
      this.projectRoot,
      MARKETPLACE_DIR,
      `${ruleId}.yaml`
    );

    try {
      await fs.unlink(ruleFilePath);
    } catch (error) {
      // File might not exist
    }

    await this.removeFromInstalled(ruleId);
  }

  /**
   * List installed rules
   */
  async listInstalled(): Promise<InstalledRule[]> {
    try {
      const installedPath = path.join(this.projectRoot, INSTALLED_RULES_FILE);
      const content = await fs.readFile(installedPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * Update installed rules to latest versions
   */
  async updateAll(): Promise<{ updated: string[]; failed: string[] }> {
    const installed = await this.listInstalled();
    const updated: string[] = [];
    const failed: string[] = [];

    for (const rule of installed) {
      try {
        const latest = await this.registry.getRule(rule.id);
        if (!latest) {
          failed.push(rule.id);
          continue;
        }

        if (latest.version !== rule.version) {
          await this.uninstall(rule.id);
          await this.install(rule.id, latest.version);
          updated.push(rule.id);
        }
      } catch (error) {
        failed.push(rule.id);
      }
    }

    return { updated, failed };
  }

  /**
   * Enable/disable a rule
   */
  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    const installed = await this.listInstalled();
    const rule = installed.find((r) => r.id === ruleId);

    if (!rule) {
      throw new Error(`Rule not installed: ${ruleId}`);
    }

    rule.enabled = enabled;
    rule.config.enabled = enabled;

    await this.saveInstalled(installed);
  }

  /**
   * Convert marketplace rule to vlayer custom rule format
   */
  private convertToCustomRule(rule: MarketplaceRule): any {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      category: rule.category,
      severity: rule.severity,
      pattern: rule.ruleDefinition.pattern,
      flags: rule.ruleDefinition.flags,
      include: rule.ruleDefinition.include,
      exclude: rule.ruleDefinition.exclude,
      recommendation: rule.recommendation,
      hipaaReference: rule.references[0] || '',
      mustNotContain: rule.ruleDefinition.mustNotContain,
      contexts: rule.ruleDefinition.contexts,
      metadata: {
        author: rule.author.name,
        organization: rule.author.organization,
        version: rule.version,
        framework: rule.framework,
        jurisdiction: rule.jurisdiction,
        payer: rule.payer,
        verified: rule.verified,
        source: 'vlayer-marketplace',
      },
    };
  }

  /**
   * Generate YAML from rule object
   */
  private generateYAML(rule: any): string {
    const lines: string[] = [];

    lines.push(`# ${rule.name}`);
    lines.push(`# Source: vlayer-marketplace`);
    lines.push(`# Author: ${rule.metadata.author || 'Unknown'}`);
    if (rule.metadata.organization) {
      lines.push(`# Organization: ${rule.metadata.organization}`);
    }
    lines.push(`# Version: ${rule.metadata.version}`);
    if (rule.metadata.verified) {
      lines.push(`# Verified: true ✓`);
    }
    lines.push('');

    lines.push('rules:');
    lines.push(`  - id: ${rule.id}`);
    lines.push(`    name: "${rule.name}"`);
    lines.push(`    description: "${rule.description}"`);
    lines.push(`    category: ${rule.category}`);
    lines.push(`    severity: ${rule.severity}`);
    lines.push(`    pattern: "${rule.pattern}"`);

    if (rule.flags) {
      lines.push(`    flags: "${rule.flags}"`);
    }

    if (rule.include && rule.include.length > 0) {
      lines.push(`    include:`);
      rule.include.forEach((p: string) => lines.push(`      - "${p}"`));
    }

    if (rule.exclude && rule.exclude.length > 0) {
      lines.push(`    exclude:`);
      rule.exclude.forEach((p: string) => lines.push(`      - "${p}"`));
    }

    lines.push(`    recommendation: "${rule.recommendation}"`);

    if (rule.hipaaReference) {
      lines.push(`    hipaaReference: "${rule.hipaaReference}"`);
    }

    if (rule.mustNotContain) {
      lines.push(`    mustNotContain: "${rule.mustNotContain}"`);
    }

    if (rule.contexts && rule.contexts.length > 0) {
      lines.push(`    contexts:`);
      rule.contexts.forEach((c: string) => lines.push(`      - ${c}`));
    }

    return lines.join('\n');
  }

  /**
   * Ensure marketplace directory exists
   */
  private async ensureMarketplaceDir(): Promise<void> {
    const dir = path.join(this.projectRoot, MARKETPLACE_DIR);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Track installation in installed.json
   */
  private async trackInstallation(rule: InstalledRule): Promise<void> {
    const installed = await this.listInstalled();
    const existing = installed.findIndex((r) => r.id === rule.id);

    if (existing >= 0) {
      installed[existing] = rule; // Update
    } else {
      installed.push(rule); // Add new
    }

    await this.saveInstalled(installed);
  }

  /**
   * Remove from installed tracking
   */
  private async removeFromInstalled(ruleId: string): Promise<void> {
    const installed = await this.listInstalled();
    const filtered = installed.filter((r) => r.id !== ruleId);
    await this.saveInstalled(filtered);
  }

  /**
   * Save installed rules list
   */
  private async saveInstalled(rules: InstalledRule[]): Promise<void> {
    await this.ensureMarketplaceDir();
    const installedPath = path.join(this.projectRoot, INSTALLED_RULES_FILE);
    await fs.writeFile(installedPath, JSON.stringify(rules, null, 2), 'utf-8');
  }
}
