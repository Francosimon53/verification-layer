/**
 * Community Rules Marketplace Types
 * Healthcare-focused compliance rules registry
 */

export type ComplianceFramework =
  | 'hipaa'
  | 'hitech'
  | 'gdpr'
  | 'state-law'
  | 'payer-specific'
  | 'framework-specific';

export type StateJurisdiction =
  | 'federal'
  | 'california'
  | 'new-york'
  | 'texas'
  | 'florida'
  | 'massachusetts'
  | 'illinois'
  | 'washington'
  | 'all-states';

export type PayerType =
  | 'medicare'
  | 'medicaid'
  | 'bcbs'
  | 'united-healthcare'
  | 'aetna'
  | 'cigna'
  | 'humana'
  | 'kaiser'
  | 'all-payers';

export type TechStack =
  | 'fhir'
  | 'hl7'
  | 'nextjs'
  | 'react'
  | 'node'
  | 'python'
  | 'java'
  | 'epic'
  | 'cerner'
  | 'allscripts'
  | 'athenahealth';

export interface MarketplaceRule {
  id: string;
  name: string;
  description: string;
  author: {
    name: string;
    email?: string;
    organization?: string;
    verified: boolean;
  };
  version: string;
  framework: ComplianceFramework;
  jurisdiction?: StateJurisdiction;
  payer?: PayerType;
  techStack?: TechStack[];
  tags: string[];
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  recommendation: string;
  references: string[];

  // Metadata
  downloads: number;
  rating: number;
  reviews: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;

  // Content
  ruleDefinition: RuleDefinition;
  examples?: {
    bad: string[];
    good: string[];
  };
  testCases?: TestCase[];
}

export interface RuleDefinition {
  pattern: string;
  flags?: string;
  mustNotContain?: string;
  contexts?: Array<'code' | 'string' | 'comment' | 'template'>;
  include?: string[];
  exclude?: string[];
  fix?: {
    type: 'replace' | 'remove' | 'wrap';
    replacement?: string;
  };
}

export interface TestCase {
  name: string;
  code: string;
  shouldMatch: boolean;
  expectedLine?: number;
}

export interface RulePackage {
  id: string;
  name: string;
  description: string;
  author: {
    name: string;
    organization?: string;
  };
  version: string;
  rules: string[]; // Rule IDs
  category: string;
  downloads: number;
  verified: boolean;
}

export interface SearchFilters {
  framework?: ComplianceFramework;
  jurisdiction?: StateJurisdiction;
  payer?: PayerType;
  techStack?: TechStack;
  verified?: boolean;
  minRating?: number;
  tags?: string[];
}

export interface SearchResult {
  rules: MarketplaceRule[];
  packages: RulePackage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InstallationConfig {
  ruleId: string;
  version?: string;
  enabled?: boolean;
  overrides?: {
    severity?: 'critical' | 'high' | 'medium' | 'low';
    recommendation?: string;
  };
}

export interface InstalledRule {
  id: string;
  source: 'marketplace' | 'local' | 'builtin';
  version: string;
  installedAt: string;
  enabled: boolean;
  config: InstallationConfig;
}

export interface MarketplaceMetadata {
  totalRules: number;
  totalPackages: number;
  categories: { [key: string]: number };
  frameworks: { [key: string]: number };
  topContributors: Array<{
    name: string;
    rulesPublished: number;
    downloads: number;
  }>;
}
