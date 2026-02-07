/**
 * Marketplace Registry Client
 * Connects to vlayer community rules registry
 */

import type {
  MarketplaceRule,
  RulePackage,
  SearchFilters,
  SearchResult,
  MarketplaceMetadata,
} from './types.js';

// Registry endpoints (future: api.vlayer.app/registry)
const REGISTRY_BASE_URL =
  process.env.VLAYER_REGISTRY_URL ||
  'https://raw.githubusercontent.com/vlayer-registry/rules/main';

const BUILTIN_RULES_URL = `${REGISTRY_BASE_URL}/registry.json`;
const PACKAGES_URL = `${REGISTRY_BASE_URL}/packages.json`;

export class MarketplaceRegistry {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Search rules in the marketplace
   */
  async search(
    query: string,
    filters?: SearchFilters,
    page = 1,
    pageSize = 20
  ): Promise<SearchResult> {
    const rules = await this.getAllRules();

    let filtered = rules.filter((rule) => {
      // Text search
      const matchesQuery =
        !query ||
        rule.name.toLowerCase().includes(query.toLowerCase()) ||
        rule.description.toLowerCase().includes(query.toLowerCase()) ||
        rule.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()));

      if (!matchesQuery) return false;

      // Apply filters
      if (filters?.framework && rule.framework !== filters.framework)
        return false;
      if (filters?.jurisdiction && rule.jurisdiction !== filters.jurisdiction)
        return false;
      if (filters?.payer && rule.payer !== filters.payer) return false;
      if (
        filters?.techStack &&
        (!rule.techStack || !rule.techStack.includes(filters.techStack))
      )
        return false;
      if (filters?.verified !== undefined && rule.verified !== filters.verified)
        return false;
      if (filters?.minRating && rule.rating < filters.minRating) return false;
      if (
        filters?.tags &&
        !filters.tags.every((tag) => rule.tags.includes(tag))
      )
        return false;

      return true;
    });

    // Sort by relevance (downloads + rating)
    filtered.sort((a, b) => {
      const scoreA = a.downloads * 0.7 + a.rating * a.reviews * 0.3;
      const scoreB = b.downloads * 0.7 + b.rating * b.reviews * 0.3;
      return scoreB - scoreA;
    });

    // Pagination
    const start = (page - 1) * pageSize;
    const paginatedRules = filtered.slice(start, start + pageSize);

    return {
      rules: paginatedRules,
      packages: [], // TODO: Add package search
      total: filtered.length,
      page,
      pageSize,
    };
  }

  /**
   * Get rule by ID
   */
  async getRule(ruleId: string): Promise<MarketplaceRule | null> {
    const rules = await this.getAllRules();
    return rules.find((r) => r.id === ruleId) || null;
  }

  /**
   * Get package by ID
   */
  async getPackage(packageId: string): Promise<RulePackage | null> {
    const packages = await this.getAllPackages();
    return packages.find((p) => p.id === packageId) || null;
  }

  /**
   * Get marketplace metadata/stats
   */
  async getMetadata(): Promise<MarketplaceMetadata> {
    const cacheKey = 'metadata';
    const cached = this.getFromCache<MarketplaceMetadata>(cacheKey);
    if (cached) return cached;

    const rules = await this.getAllRules();
    const packages = await this.getAllPackages();

    // Calculate stats
    const categories: { [key: string]: number } = {};
    const frameworks: { [key: string]: number } = {};

    for (const rule of rules) {
      categories[rule.category] = (categories[rule.category] || 0) + 1;
      frameworks[rule.framework] = (frameworks[rule.framework] || 0) + 1;
    }

    // Top contributors
    const contributorMap = new Map<
      string,
      { rulesPublished: number; downloads: number }
    >();

    for (const rule of rules) {
      const name = rule.author.name;
      const existing = contributorMap.get(name) || {
        rulesPublished: 0,
        downloads: 0,
      };
      existing.rulesPublished++;
      existing.downloads += rule.downloads;
      contributorMap.set(name, existing);
    }

    const topContributors = Array.from(contributorMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10);

    const metadata: MarketplaceMetadata = {
      totalRules: rules.length,
      totalPackages: packages.length,
      categories,
      frameworks,
      topContributors,
    };

    this.setCache(cacheKey, metadata);
    return metadata;
  }

  /**
   * Get featured rules
   */
  async getFeatured(limit = 10): Promise<MarketplaceRule[]> {
    const rules = await this.getAllRules();

    // Featured = high rating + verified + recent
    return rules
      .filter((r) => r.verified && r.rating >= 4.0)
      .sort((a, b) => {
        const scoreA = new Date(a.updatedAt).getTime() + a.rating * 1000;
        const scoreB = new Date(b.updatedAt).getTime() + b.rating * 1000;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Get all rules from registry
   */
  private async getAllRules(): Promise<MarketplaceRule[]> {
    const cacheKey = 'all-rules';
    const cached = this.getFromCache<MarketplaceRule[]>(cacheKey);
    if (cached) return cached;

    try {
      // For now, return builtin example rules
      // In production, fetch from BUILTIN_RULES_URL
      const rules = this.getBuiltinRules();
      this.setCache(cacheKey, rules);
      return rules;
    } catch (error) {
      console.error('Failed to fetch rules from registry:', error);
      return this.getBuiltinRules(); // Fallback to builtin
    }
  }

  /**
   * Get all packages from registry
   */
  private async getAllPackages(): Promise<RulePackage[]> {
    const cacheKey = 'all-packages';
    const cached = this.getFromCache<RulePackage[]>(cacheKey);
    if (cached) return cached;

    try {
      // For now, return builtin example packages
      const packages = this.getBuiltinPackages();
      this.setCache(cacheKey, packages);
      return packages;
    } catch (error) {
      console.error('Failed to fetch packages from registry:', error);
      return [];
    }
  }

  /**
   * Cache helpers
   */
  private getFromCache<T>(key: string): T | null {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key) as T;
  }

  private setCache<T>(key: string, value: T): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  /**
   * Builtin example rules (will be moved to registry API)
   */
  private getBuiltinRules(): MarketplaceRule[] {
    return [
      {
        id: 'ca-cipa-minors-consent',
        name: 'California CIPA - Minors Data Consent',
        description:
          'Ensures parental consent before collecting data from minors under 13 (California CIPA compliance)',
        author: {
          name: 'Healthcare Compliance Team',
          organization: 'CA Department of Health',
          verified: true,
        },
        version: '1.2.0',
        framework: 'state-law',
        jurisdiction: 'california',
        tags: ['california', 'minors', 'consent', 'cipa'],
        category: 'access-control',
        severity: 'critical',
        pattern: '(?:age|birthdate|dob).*?<\\s*13(?!.*?(?:consent|parental|guardian))',
        recommendation:
          'Implement parental consent flow for users under 13 before data collection',
        references: [
          'California CIPA §22575-22579',
          'https://oag.ca.gov/privacy/ccpa',
        ],
        downloads: 1234,
        rating: 4.8,
        reviews: 42,
        verified: true,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2026-01-20T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:age|birthdate|dob).*?<\\s*13(?!.*?(?:consent|parental|guardian))',
          flags: 'i',
          contexts: ['code'],
        },
        examples: {
          bad: [
            'if (user.age < 13) { collectData(user); }',
            'const isMinor = birthdate.getAge() < 13; saveToDatabase(userData);',
          ],
          good: [
            'if (user.age < 13 && !hasParentalConsent()) { return; }',
            'if (isMinor && verifyGuardianConsent()) { collectData(user); }',
          ],
        },
      },
      {
        id: 'bcbs-prior-auth',
        name: 'BCBS Prior Authorization Check',
        description:
          'Validates that prior authorization is obtained before high-cost procedures (BCBS requirement)',
        author: {
          name: 'John Smith',
          organization: 'Blue Cross Blue Shield',
          verified: true,
        },
        version: '2.0.1',
        framework: 'payer-specific',
        payer: 'bcbs',
        tags: ['prior-auth', 'authorization', 'bcbs', 'procedures'],
        category: 'access-control',
        severity: 'high',
        pattern: '(?:schedule|book).*?(?:surgery|mri|ct.scan)(?!.*?prior.?auth)',
        recommendation:
          'Add prior authorization check before scheduling high-cost procedures',
        references: [
          'BCBS Prior Authorization Guidelines',
          'https://www.bcbs.com/prior-authorization',
        ],
        downloads: 856,
        rating: 4.5,
        reviews: 28,
        verified: true,
        createdAt: '2025-11-10T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:schedule|book).*?(?:surgery|mri|ct.scan)(?!.*?prior.?auth)',
          flags: 'i',
          contexts: ['code'],
        },
        examples: {
          bad: [
            'scheduleSurgery(patient, "knee-replacement");',
            'bookMRI(patient, appointmentDate);',
          ],
          good: [
            'if (hasPriorAuth(patient, "knee-replacement")) { scheduleSurgery(patient); }',
            'await checkPriorAuthorization(); bookMRI(patient);',
          ],
        },
      },
      {
        id: 'fhir-r4-validation',
        name: 'FHIR R4 Resource Validation',
        description:
          'Validates FHIR R4 resources have required fields before transmission',
        author: {
          name: 'HL7 Community',
          organization: 'HL7 International',
          verified: true,
        },
        version: '1.0.5',
        framework: 'framework-specific',
        techStack: ['fhir'],
        tags: ['fhir', 'hl7', 'validation', 'interoperability'],
        category: 'data-retention',
        severity: 'medium',
        pattern: 'new\\s+(?:Patient|Observation|Medication)(?!.*?\\.validate\\(\\))',
        recommendation:
          'Call .validate() on FHIR resources before sending to server',
        references: [
          'FHIR R4 Specification',
          'https://www.hl7.org/fhir/validation.html',
        ],
        downloads: 2341,
        rating: 4.9,
        reviews: 67,
        verified: true,
        createdAt: '2024-08-20T00:00:00Z',
        updatedAt: '2025-12-15T00:00:00Z',
        ruleDefinition: {
          pattern: 'new\\s+(?:Patient|Observation|Medication)(?!.*?\\.validate\\(\\))',
          contexts: ['code'],
        },
        examples: {
          bad: [
            'const patient = new Patient({ name: "John" }); api.send(patient);',
          ],
          good: [
            'const patient = new Patient({ name: "John" }); patient.validate(); api.send(patient);',
          ],
        },
      },
      {
        id: 'ny-encryption-mandate',
        name: 'New York Encryption Mandate',
        description:
          'Ensures PHI is encrypted at rest per NY SHIELD Act requirements',
        author: {
          name: 'NY State Health Dept',
          organization: 'New York Department of Health',
          verified: true,
        },
        version: '1.1.0',
        framework: 'state-law',
        jurisdiction: 'new-york',
        tags: ['encryption', 'new-york', 'shield-act', 'at-rest'],
        category: 'encryption',
        severity: 'critical',
        pattern: '(?:fs\\.writeFile|writeFileSync).*?patient(?!.*?encrypt)',
        recommendation:
          'Encrypt PHI before writing to disk (AES-256 minimum per NY SHIELD Act)',
        references: [
          'NY SHIELD Act §899-aa',
          'https://ag.ny.gov/shield-act',
        ],
        downloads: 678,
        rating: 4.7,
        reviews: 19,
        verified: true,
        createdAt: '2025-03-01T00:00:00Z',
        updatedAt: '2026-01-10T00:00:00Z',
        ruleDefinition: {
          pattern: '(?:fs\\.writeFile|writeFileSync).*?patient(?!.*?encrypt)',
          flags: 'i',
          contexts: ['code'],
        },
      },
      {
        id: 'medicare-audit-trail',
        name: 'Medicare Audit Trail Requirement',
        description:
          'Ensures all Medicare claims modifications are logged per CMS requirements',
        author: {
          name: 'CMS Compliance',
          organization: 'Centers for Medicare & Medicaid Services',
          verified: true,
        },
        version: '1.3.2',
        framework: 'payer-specific',
        payer: 'medicare',
        tags: ['medicare', 'cms', 'audit', 'claims'],
        category: 'audit-logging',
        severity: 'high',
        pattern: '(?:UPDATE|DELETE).*?claims.*?WHERE.*?medicare(?!.*?(?:audit|log))',
        recommendation:
          'Add audit logging for all Medicare claims modifications',
        references: [
          'CMS Medicare Audit Requirements',
          'https://www.cms.gov/regulations-and-guidance',
        ],
        downloads: 1567,
        rating: 4.6,
        reviews: 53,
        verified: true,
        createdAt: '2024-06-15T00:00:00Z',
        updatedAt: '2025-11-22T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:UPDATE|DELETE).*?claims.*?WHERE.*?medicare(?!.*?(?:audit|log))',
          flags: 'i',
          contexts: ['code'],
        },
      },
      // HIPAA 2026 Security Rule (all requirements now "required" instead of "addressable")
      {
        id: 'hipaa-mfa-001',
        name: 'HIPAA 2026 - Multi-Factor Authentication Required',
        description:
          'Endpoints accessing PHI must enforce MFA per new HIPAA 2026 Security Rule',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'mfa', '2fa', 'authentication', 'access-control'],
        category: 'access-control',
        severity: 'critical',
        pattern:
          '(?:login|authenticate|signin|auth).*?(?:patient|phi|medical|health)(?!.*?(?:mfa|multi.?factor|2fa|totp|authenticator))',
        recommendation:
          'Add MFA enforcement: requireMFA: true, verify TOTP/authenticator before granting access',
        references: [
          '45 CFR §164.312(a)(2)(i) - Access Control (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:login|authenticate|signin|auth).*?(?:patient|phi|medical|health)(?!.*?(?:mfa|multi.?factor|2fa|totp|authenticator))',
          flags: 'i',
          contexts: ['code'],
        },
        examples: {
          bad: [
            'app.post("/login", async (req) => { const user = await User.findByCredentials(req.body); if (user.role === "doctor") accessPatientRecords(); });',
          ],
          good: [
            'app.post("/login", async (req) => { const user = await User.findByCredentials(req.body); if (!user.mfaVerified) return res.status(401); accessPatientRecords(); });',
          ],
        },
      },
      {
        id: 'hipaa-enc-rest-001',
        name: 'HIPAA 2026 - Encryption at Rest Required',
        description:
          'All ePHI must be encrypted at rest using AES-256 or stronger per HIPAA 2026',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'encryption', 'at-rest', 'aes-256', 'security'],
        category: 'encryption',
        severity: 'critical',
        pattern:
          '(?:mongoose|sequelize|typeorm|prisma)\\.(?:connect|createConnection).*?(?!.*?(?:encrypt|ssl|tls))',
        recommendation:
          'Enable encryption at rest: Set encrypt: true in DB config, use crypto.cipher for file storage',
        references: [
          '45 CFR §164.312(a)(2)(iv) - Encryption (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:mongoose|sequelize|typeorm|prisma)\\.(?:connect|createConnection).*?(?!.*?(?:encrypt|ssl|tls))',
          flags: 'i',
          contexts: ['code'],
        },
      },
      {
        id: 'hipaa-session-001',
        name: 'HIPAA 2026 - Session Timeout Required',
        description:
          'PHI access sessions must auto-expire within 15 minutes of inactivity',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'session', 'timeout', 'inactivity', 'security'],
        category: 'access-control',
        severity: 'high',
        pattern:
          '(?:express-session|session)\\.(?:configure|use)(?!.*?(?:maxAge|expires|timeout))',
        recommendation:
          'Set session timeout: maxAge: 900000 (15 min), implement idle timeout detector',
        references: [
          '45 CFR §164.312(a)(2)(iii) - Session Control (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:express-session|session)\\.(?:configure|use)(?!.*?(?:maxAge|expires|timeout))',
          flags: 'i',
          contexts: ['code'],
        },
      },
      {
        id: 'hipaa-revoke-001',
        name: 'HIPAA 2026 - Immediate Access Revocation Required',
        description:
          'User deactivation must immediately invalidate all sessions and tokens',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'revocation', 'termination', 'access', 'security'],
        category: 'access-control',
        severity: 'critical',
        pattern:
          '(?:deactivate|disable|remove)User(?!.*?(?:revoke|invalidate|blacklist).*?(?:token|session))',
        recommendation:
          'Add token revocation: Call revokeAllTokens() and invalidateAllSessions() on user deactivation',
        references: [
          '45 CFR §164.308(a)(3)(ii)(C) - Termination Procedures (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:deactivate|disable|remove)User(?!.*?(?:revoke|invalidate|blacklist).*?(?:token|session))',
          flags: 'i',
          contexts: ['code'],
        },
      },
      {
        id: 'hipaa-breach-001',
        name: 'HIPAA 2026 - Breach Notification Required',
        description:
          'Must have automated breach detection and notification within 24 hours',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'breach', 'notification', 'incident', 'security'],
        category: 'audit-logging',
        severity: 'critical',
        pattern:
          'catch\\s*\\(.*?error.*?\\).*?(?:security|unauthorized|breach)(?!.*?(?:notifyBreach|incidentResponse|alertSecurity))',
        recommendation:
          'Implement breach notification: Create incident response handler, set up 24h alert system',
        references: [
          '45 CFR §164.308(a)(6)(ii) - Security Incident Procedures (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern:
            'catch\\s*\\(.*?error.*?\\).*?(?:security|unauthorized|breach)(?!.*?(?:notifyBreach|incidentResponse|alertSecurity))',
          flags: 'i',
          contexts: ['code'],
        },
      },
      {
        id: 'hipaa-segment-001',
        name: 'HIPAA 2026 - Network Segmentation Required',
        description:
          'PHI services must be network-segmented with restricted CORS and firewall rules',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'network', 'segmentation', 'cors', 'firewall'],
        category: 'access-control',
        severity: 'critical',
        pattern:
          'cors\\(\\{?\\s*origin:\\s*[\'"]?\\*[\'"]?.*?(?:patient|phi|medical)',
        recommendation:
          'Implement network segmentation: Use VPC/subnet isolation, restrict CORS to whitelisted origins',
        references: [
          '45 CFR §164.312(e)(1) - Transmission Security (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern:
            'cors\\(\\{?\\s*origin:\\s*[\'"]?\\*[\'"]?.*?(?:patient|phi|medical)',
          flags: 'i',
          contexts: ['code'],
        },
      },
      {
        id: 'hipaa-asset-001',
        name: 'HIPAA 2026 - Technology Asset Inventory',
        description:
          'Automatic inventory of all systems processing, storing, or transmitting ePHI',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'asset', 'inventory', 'risk-analysis', 'compliance'],
        category: 'data-retention',
        severity: 'high',
        pattern:
          '(?:mongoose|sequelize|prisma|typeorm|knex)\\.(?:connect|model)',
        recommendation:
          'Asset inventory will be generated automatically in scan report',
        references: [
          '45 CFR §164.308(a)(1)(ii)(A) - Risk Analysis (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:mongoose|sequelize|prisma|typeorm|knex)\\.(?:connect|model)',
          flags: 'i',
          contexts: ['code'],
        },
      },
      {
        id: 'hipaa-flow-001',
        name: 'HIPAA 2026 - ePHI Flow Mapping',
        description:
          'Automatic mapping of PHI data flow through system (input → processing → storage → output)',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'data-flow', 'phi', 'mapping', 'risk-analysis'],
        category: 'data-retention',
        severity: 'high',
        pattern: '(?:req\\.body|req\\.params|req\\.query).*?(?:patient|phi|medical)',
        recommendation:
          'PHI flow map will be generated automatically in scan report',
        references: [
          '45 CFR §164.308(a)(1)(ii)(A) - Risk Analysis (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern:
            '(?:req\\.body|req\\.params|req\\.query).*?(?:patient|phi|medical)',
          flags: 'i',
          contexts: ['code'],
        },
      },
      {
        id: 'hipaa-pentest-001',
        name: 'HIPAA 2026 - Vulnerability Scanning Required',
        description:
          'Must have automated vulnerability scanning (Dependabot, Snyk, Trivy) in CI/CD',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
          verified: true,
        },
        version: '1.0.0',
        framework: 'hipaa',
        tags: ['hipaa-2026', 'vulnerability', 'scanning', 'pentest', 'security'],
        category: 'audit-logging',
        severity: 'high',
        pattern: 'package\\.json(?!.*?(?:snyk|audit|vulnerability))',
        recommendation:
          'Add vulnerability scanning: Enable Dependabot, add Snyk/Trivy to CI/CD pipeline',
        references: [
          '45 CFR §164.308(a)(8) - Evaluation (Required)',
          'https://www.hhs.gov/hipaa/for-professionals/security/index.html',
        ],
        downloads: 0,
        rating: 5.0,
        reviews: 0,
        verified: true,
        createdAt: '2026-02-06T00:00:00Z',
        updatedAt: '2026-02-06T00:00:00Z',
        ruleDefinition: {
          pattern: 'package\\.json(?!.*?(?:snyk|audit|vulnerability))',
          flags: 'i',
          contexts: ['code'],
        },
      },
    ];
  }

  /**
   * Builtin example packages
   */
  private getBuiltinPackages(): RulePackage[] {
    return [
      {
        id: 'california-compliance-pack',
        name: 'California Healthcare Compliance Pack',
        description:
          'Complete set of California-specific healthcare compliance rules (CIPA, CMIA, CCPA)',
        author: {
          name: 'CA Health Dept',
          organization: 'California Department of Public Health',
        },
        version: '2.1.0',
        rules: ['ca-cipa-minors-consent', 'ca-cmia-disclosure', 'ca-ccpa-deletion'],
        category: 'state-law',
        downloads: 892,
        verified: true,
      },
      {
        id: 'bcbs-complete',
        name: 'BCBS Complete Compliance',
        description: 'All Blue Cross Blue Shield payer-specific requirements',
        author: {
          name: 'BCBS Network',
        },
        version: '1.5.0',
        rules: ['bcbs-prior-auth', 'bcbs-network-verification', 'bcbs-timely-filing'],
        category: 'payer-specific',
        downloads: 456,
        verified: true,
      },
      {
        id: 'fhir-starter-pack',
        name: 'FHIR Implementation Starter Pack',
        description: 'Essential FHIR R4 validation and compliance rules',
        author: {
          name: 'HL7 Community',
          organization: 'HL7 International',
        },
        version: '3.0.0',
        rules: ['fhir-r4-validation', 'fhir-resource-references', 'fhir-security-labels'],
        category: 'framework-specific',
        downloads: 3421,
        verified: true,
      },
      {
        id: 'hipaa-2026-security-rule',
        name: 'HIPAA 2026 Complete Security Rule Pack',
        description:
          'Complete set of HIPAA 2026 Security Rule requirements (15/15 technical safeguards now required)',
        author: {
          name: 'HHS Office for Civil Rights',
          organization: 'U.S. Department of Health & Human Services',
        },
        version: '1.0.0',
        rules: [
          'hipaa-mfa-001',
          'hipaa-enc-rest-001',
          'hipaa-session-001',
          'hipaa-revoke-001',
          'hipaa-breach-001',
          'hipaa-segment-001',
          'hipaa-asset-001',
          'hipaa-flow-001',
          'hipaa-pentest-001',
        ],
        category: 'hipaa',
        downloads: 0,
        verified: true,
      },
    ];
  }
}
