import { writeFile, readFile, readdir } from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import type { ScanResult, Report, ReportOptions, Finding, ContextLine, StackInfo, DependencyVulnerability, ScanComparison } from '../types.js';
import { getRemediationGuide, type RemediationGuide } from './remediation-guides.js';
import { getStackSpecificGuides, type StackGuide } from '../stack-detector/stack-guides.js';

interface ComplianceScore {
  overall: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  color: string;
  byCategory: Record<string, { score: number; findings: number }>;
}

interface ScoreTrending {
  direction: 'up' | 'down' | 'same';
  previousScore: number;
  change: number;
}

interface TechnologyAsset {
  id: string;
  name: string;
  version: string;
  type: 'software';
  category: 'framework' | 'database' | 'auth' | 'cloud' | 'payment' | 'communication' | 'utility' | 'other';
  provider: string;
  responsiblePerson: string;
  location: string;
}

interface AssetInventory {
  assets: TechnologyAsset[];
  detectedAt: string;
  totalAssets: number;
}

interface DataFlowComponent {
  id: string;
  name: string;
  type: 'entry-point' | 'data-store' | 'external-service' | 'auth-provider';
  hasIssues: boolean;
  details?: string;
}

interface DataFlowMap {
  entryPoints: DataFlowComponent[];
  dataStores: DataFlowComponent[];
  externalServices: DataFlowComponent[];
  authProviders: DataFlowComponent[];
}

const PACKAGE_CATEGORIES: Record<string, { category: string; provider: string }> = {
  // Frameworks
  'next': { category: 'framework', provider: 'Next.js Framework' },
  'react': { category: 'framework', provider: 'React Library' },
  'vue': { category: 'framework', provider: 'Vue.js Framework' },
  'nuxt': { category: 'framework', provider: 'Nuxt Framework' },
  'svelte': { category: 'framework', provider: 'Svelte Framework' },
  'express': { category: 'framework', provider: 'Express.js Framework' },
  'fastify': { category: 'framework', provider: 'Fastify Framework' },
  'hono': { category: 'framework', provider: 'Hono Framework' },
  'elysia': { category: 'framework', provider: 'Elysia Framework' },
  'nestjs': { category: 'framework', provider: 'NestJS Framework' },

  // Databases & ORMs
  '@prisma/client': { category: 'database', provider: 'Prisma ORM' },
  'prisma': { category: 'database', provider: 'Prisma ORM' },
  'mongoose': { category: 'database', provider: 'Mongoose ODM (MongoDB)' },
  'drizzle-orm': { category: 'database', provider: 'Drizzle ORM' },
  'typeorm': { category: 'database', provider: 'TypeORM' },
  'sequelize': { category: 'database', provider: 'Sequelize ORM' },
  'knex': { category: 'database', provider: 'Knex.js Query Builder' },
  'pg': { category: 'database', provider: 'PostgreSQL Driver' },
  'mysql2': { category: 'database', provider: 'MySQL Driver' },
  'mongodb': { category: 'database', provider: 'MongoDB Driver' },
  'redis': { category: 'database', provider: 'Redis Client' },

  // Authentication
  'next-auth': { category: 'auth', provider: 'NextAuth.js' },
  '@auth/core': { category: 'auth', provider: 'Auth.js' },
  'passport': { category: 'auth', provider: 'Passport.js' },
  'jsonwebtoken': { category: 'auth', provider: 'JWT (JSON Web Tokens)' },
  'bcrypt': { category: 'auth', provider: 'bcrypt Password Hashing' },
  'argon2': { category: 'auth', provider: 'Argon2 Password Hashing' },
  '@clerk/nextjs': { category: 'auth', provider: 'Clerk Authentication' },
  '@supabase/auth-helpers': { category: 'auth', provider: 'Supabase Auth' },
  'lucia': { category: 'auth', provider: 'Lucia Auth' },

  // Cloud / BaaS
  '@supabase/supabase-js': { category: 'cloud', provider: 'Supabase BaaS' },
  '@aws-sdk': { category: 'cloud', provider: 'AWS SDK' },
  'aws-sdk': { category: 'cloud', provider: 'AWS SDK' },
  '@google-cloud': { category: 'cloud', provider: 'Google Cloud SDK' },
  '@azure': { category: 'cloud', provider: 'Azure SDK' },
  'firebase': { category: 'cloud', provider: 'Firebase' },
  'firebase-admin': { category: 'cloud', provider: 'Firebase Admin' },
  '@vercel/analytics': { category: 'cloud', provider: 'Vercel Analytics' },
  '@vercel/edge': { category: 'cloud', provider: 'Vercel Edge Functions' },

  // Payment
  'stripe': { category: 'payment', provider: 'Stripe Payments' },
  '@stripe/stripe-js': { category: 'payment', provider: 'Stripe.js' },
  'paypal': { category: 'payment', provider: 'PayPal SDK' },

  // Communication
  '@sendgrid/mail': { category: 'communication', provider: 'SendGrid Email' },
  'nodemailer': { category: 'communication', provider: 'Nodemailer Email' },
  'twilio': { category: 'communication', provider: 'Twilio SMS/Voice' },
  '@twilio/conversations': { category: 'communication', provider: 'Twilio Conversations' },
  'resend': { category: 'communication', provider: 'Resend Email' },

  // Utility (commonly used)
  'axios': { category: 'utility', provider: 'Axios HTTP Client' },
  'lodash': { category: 'utility', provider: 'Lodash Utility Library' },
  'date-fns': { category: 'utility', provider: 'date-fns Date Utility' },
  'dayjs': { category: 'utility', provider: 'Day.js Date Library' },
  'zod': { category: 'utility', provider: 'Zod Validation' },
  'joi': { category: 'utility', provider: 'Joi Validation' },
  'yup': { category: 'utility', provider: 'Yup Validation' },
};

function categorizePackage(packageName: string): { category: string; provider: string } {
  // Check exact match
  if (PACKAGE_CATEGORIES[packageName]) {
    return PACKAGE_CATEGORIES[packageName];
  }

  // Check prefix match (for scoped packages)
  for (const [key, value] of Object.entries(PACKAGE_CATEGORIES)) {
    if (packageName.startsWith(key)) {
      return value;
    }
  }

  // Default to utility/other
  return { category: 'other', provider: packageName };
}

async function generateAssetInventory(targetPath: string): Promise<AssetInventory> {
  const assets: TechnologyAsset[] = [];

  try {
    // Read package.json
    const packageJsonPath = path.join(targetPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    let assetId = 1;

    for (const [name, version] of Object.entries(dependencies)) {
      const { category, provider } = categorizePackage(name);

      // Skip dev-only packages that aren't relevant for asset inventory
      if (name.startsWith('@types/') ||
          name === 'typescript' ||
          name === 'eslint' ||
          name.startsWith('eslint-') ||
          name === 'prettier' ||
          name.startsWith('@testing-library/') ||
          name === 'vitest' ||
          name === 'jest') {
        continue;
      }

      assets.push({
        id: `TECH-${String(assetId).padStart(3, '0')}`,
        name,
        version: String(version).replace(/[\^~]/g, ''),
        type: 'software',
        category: category as any,
        provider,
        responsiblePerson: '', // To be filled by client
        location: '', // To be filled by client
      });

      assetId++;
    }
  } catch (error) {
    // If package.json doesn't exist or can't be read, return empty inventory
    console.warn('Could not read package.json for asset inventory:', error);
  }

  // Sort by category, then by name
  assets.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return {
    assets,
    detectedAt: new Date().toISOString(),
    totalAssets: assets.length,
  };
}

function generateAssetInventoryCsv(inventory: AssetInventory): string {
  const header = 'ID,Name,Version,Type,Category,Provider,Responsible Person,Location\n';

  const rows = inventory.assets.map(asset => {
    return [
      asset.id,
      `"${asset.name}"`,
      `"${asset.version}"`,
      asset.type,
      asset.category,
      `"${asset.provider}"`,
      `"${asset.responsiblePerson}"`,
      `"${asset.location}"`,
    ].join(',');
  }).join('\n');

  return header + rows;
}

async function analyzeDataFlow(targetPath: string, findings: Finding[]): Promise<DataFlowMap> {
  const entryPoints: DataFlowComponent[] = [];
  const dataStores: DataFlowComponent[] = [];
  const externalServices: DataFlowComponent[] = [];
  const authProviders: DataFlowComponent[] = [];

  try {
    // Read package.json to detect dependencies
    const packageJsonPath = path.join(targetPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Detect data stores
    const dbPackages = [
      { pattern: '@prisma/client', name: 'Prisma ORM', id: 'prisma' },
      { pattern: 'prisma', name: 'Prisma', id: 'prisma' },
      { pattern: '@supabase/supabase-js', name: 'Supabase', id: 'supabase' },
      { pattern: 'mongoose', name: 'MongoDB (Mongoose)', id: 'mongodb' },
      { pattern: 'mongodb', name: 'MongoDB', id: 'mongodb' },
      { pattern: 'pg', name: 'PostgreSQL', id: 'postgresql' },
      { pattern: 'mysql2', name: 'MySQL', id: 'mysql' },
      { pattern: 'redis', name: 'Redis', id: 'redis' },
      { pattern: 'drizzle-orm', name: 'Drizzle ORM', id: 'drizzle' },
    ];

    for (const pkg of dbPackages) {
      if (dependencies[pkg.pattern]) {
        const hasIssues = findings.some(f =>
          f.file.toLowerCase().includes(pkg.id) ||
          f.category === 'encryption' ||
          f.category === 'data-retention'
        );
        dataStores.push({
          id: pkg.id,
          name: pkg.name,
          type: 'data-store',
          hasIssues,
        });
      }
    }

    // Detect auth providers
    const authPackages = [
      { pattern: 'next-auth', name: 'NextAuth.js', id: 'nextauth' },
      { pattern: '@clerk/nextjs', name: 'Clerk', id: 'clerk' },
      { pattern: '@auth0/nextjs-auth0', name: 'Auth0', id: 'auth0' },
      { pattern: 'passport', name: 'Passport.js', id: 'passport' },
      { pattern: '@supabase/auth-helpers', name: 'Supabase Auth', id: 'supabase-auth' },
      { pattern: 'lucia', name: 'Lucia Auth', id: 'lucia' },
    ];

    for (const pkg of authPackages) {
      if (dependencies[pkg.pattern]) {
        const hasIssues = findings.some(f =>
          f.category === 'access-control' ||
          f.category === 'audit-logging'
        );
        authProviders.push({
          id: pkg.id,
          name: pkg.name,
          type: 'auth-provider',
          hasIssues,
        });
      }
    }

    // Detect external services
    const externalPackages = [
      { pattern: 'stripe', name: 'Stripe (Payments)', id: 'stripe' },
      { pattern: '@sendgrid/mail', name: 'SendGrid (Email)', id: 'sendgrid' },
      { pattern: 'nodemailer', name: 'Nodemailer (Email)', id: 'nodemailer' },
      { pattern: 'twilio', name: 'Twilio (SMS)', id: 'twilio' },
      { pattern: 'resend', name: 'Resend (Email)', id: 'resend' },
      { pattern: '@aws-sdk', name: 'AWS Services', id: 'aws' },
      { pattern: 'aws-sdk', name: 'AWS Services', id: 'aws' },
      { pattern: '@google-cloud', name: 'Google Cloud', id: 'gcp' },
      { pattern: 'firebase', name: 'Firebase', id: 'firebase' },
    ];

    for (const pkg of externalPackages) {
      if (Object.keys(dependencies).some(dep => dep.includes(pkg.pattern))) {
        const hasIssues = findings.some(f =>
          f.category === 'encryption' ||
          f.title.toLowerCase().includes('api') ||
          f.title.toLowerCase().includes('external')
        );
        externalServices.push({
          id: pkg.id,
          name: pkg.name,
          type: 'external-service',
          hasIssues,
        });
      }
    }

    // Detect entry points (API routes)
    // Look for common API route patterns
    const apiPatterns = [
      'pages/api',
      'app/api',
      'src/pages/api',
      'src/app/api',
    ];

    let apiRouteCount = 0;
    for (const pattern of apiPatterns) {
      try {
        const apiPath = path.join(targetPath, pattern);
        const files = await readdir(apiPath, { recursive: true });
        apiRouteCount += files.filter(f =>
          typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.js'))
        ).length;
      } catch {
        // Directory doesn't exist, continue
      }
    }

    if (apiRouteCount > 0) {
      const hasIssues = findings.some(f =>
        f.file.includes('/api/') ||
        f.category === 'access-control' ||
        f.category === 'phi-exposure'
      );
      entryPoints.push({
        id: 'api-routes',
        name: `API Routes (${apiRouteCount} detected)`,
        type: 'entry-point',
        hasIssues,
        details: `${apiRouteCount} API route files found`,
      });
    } else {
      // Generic API endpoint if framework detected
      if (dependencies['express'] || dependencies['fastify'] || dependencies['next']) {
        const hasIssues = findings.some(f =>
          f.category === 'access-control' || f.category === 'phi-exposure'
        );
        entryPoints.push({
          id: 'api-endpoints',
          name: 'API Endpoints',
          type: 'entry-point',
          hasIssues,
        });
      }
    }

  } catch (error) {
    console.warn('Could not analyze data flow:', error);
  }

  return {
    entryPoints,
    dataStores,
    externalServices,
    authProviders,
  };
}

function generateMermaidDiagram(dataFlow: DataFlowMap): string {
  const lines: string[] = [];

  lines.push('flowchart TD');

  // Define nodes
  lines.push('  User[👤 User/Patient]');
  lines.push('  Frontend[🖥️ Frontend Application]');

  // Entry points
  if (dataFlow.entryPoints.length > 0) {
    dataFlow.entryPoints.forEach(ep => {
      const icon = '🔌';
      lines.push(`  ${ep.id}[${icon} ${ep.name}]`);
    });
  } else {
    lines.push('  api[🔌 API Layer]');
  }

  // Auth providers
  if (dataFlow.authProviders.length > 0) {
    dataFlow.authProviders.forEach(auth => {
      const icon = '🔐';
      lines.push(`  ${auth.id}[${icon} ${auth.name}]`);
    });
  }

  // Data stores
  if (dataFlow.dataStores.length > 0) {
    dataFlow.dataStores.forEach(ds => {
      const icon = '🗄️';
      lines.push(`  ${ds.id}[(${icon} ${ds.name})]`);
    });
  } else {
    lines.push('  db[(🗄️ Database)]');
  }

  // External services
  dataFlow.externalServices.forEach(svc => {
    const icon = svc.name.includes('Payment') || svc.name.includes('Stripe') ? '💳' :
                 svc.name.includes('Email') || svc.name.includes('Mail') ? '📧' :
                 svc.name.includes('SMS') || svc.name.includes('Twilio') ? '📱' :
                 '☁️';
    lines.push(`  ${svc.id}[${icon} ${svc.name}]`);
  });

  // Define connections
  lines.push('');
  lines.push('  %% Main data flow');
  lines.push('  User --> Frontend');

  if (dataFlow.entryPoints.length > 0) {
    lines.push('  Frontend --> ' + dataFlow.entryPoints[0].id);

    // Auth flow
    if (dataFlow.authProviders.length > 0) {
      lines.push('  ' + dataFlow.entryPoints[0].id + ' --> ' + dataFlow.authProviders[0].id);
    }

    // Database flow
    if (dataFlow.dataStores.length > 0) {
      lines.push('  ' + dataFlow.entryPoints[0].id + ' --> ' + dataFlow.dataStores[0].id);
    } else {
      lines.push('  ' + dataFlow.entryPoints[0].id + ' --> db');
    }
  } else {
    lines.push('  Frontend --> api');
    lines.push('  api --> db');
  }

  // External services connections
  dataFlow.externalServices.forEach(svc => {
    const source = dataFlow.entryPoints.length > 0 ? dataFlow.entryPoints[0].id : 'api';
    lines.push('  ' + source + ' --> ' + svc.id);
  });

  // Apply styling for components with issues
  lines.push('');
  lines.push('  %% Styling');
  lines.push('  classDef issueNode fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#991b1b');
  lines.push('  classDef normalNode fill:#dbeafe,stroke:#3b82f6,stroke-width:2px');
  lines.push('  classDef externalNode fill:#fef3c7,stroke:#f59e0b,stroke-width:2px');

  // Apply classes
  const issueNodes: string[] = [];
  const normalNodes: string[] = [];
  const externalNodes: string[] = [];

  [...dataFlow.entryPoints, ...dataFlow.authProviders, ...dataFlow.dataStores].forEach(component => {
    if (component.hasIssues) {
      issueNodes.push(component.id);
    } else {
      normalNodes.push(component.id);
    }
  });

  dataFlow.externalServices.forEach(svc => {
    if (svc.hasIssues) {
      issueNodes.push(svc.id);
    } else {
      externalNodes.push(svc.id);
    }
  });

  if (issueNodes.length > 0) {
    lines.push('  class ' + issueNodes.join(',') + ' issueNode');
  }
  if (normalNodes.length > 0) {
    lines.push('  class ' + normalNodes.join(',') + ' normalNode');
  }
  if (externalNodes.length > 0) {
    lines.push('  class ' + externalNodes.join(',') + ' externalNode');
  }

  return lines.join('\n');
}

async function renderDataFlowMapHtml(targetPath: string, findings: Finding[]): Promise<string> {
  const dataFlow = await analyzeDataFlow(targetPath, findings);
  const mermaidCode = generateMermaidDiagram(dataFlow);

  const totalComponents = dataFlow.entryPoints.length + dataFlow.dataStores.length +
                         dataFlow.externalServices.length + dataFlow.authProviders.length;

  const componentsWithIssues = [
    ...dataFlow.entryPoints,
    ...dataFlow.dataStores,
    ...dataFlow.externalServices,
    ...dataFlow.authProviders,
  ].filter(c => c.hasIssues).length;

  return `
    <div class="data-flow-map-section">
      <div class="flow-header">
        <h2>🔄 ePHI Data Flow Map</h2>
        <p class="flow-subtitle">
          Visual representation of Protected Health Information (ePHI) data flow through your application
        </p>
      </div>

      <div class="flow-stats">
        <div class="flow-stat-box">
          <div class="flow-stat-value">${totalComponents}</div>
          <div class="flow-stat-label">Components</div>
        </div>
        <div class="flow-stat-box">
          <div class="flow-stat-value">${dataFlow.entryPoints.length}</div>
          <div class="flow-stat-label">Entry Points</div>
        </div>
        <div class="flow-stat-box">
          <div class="flow-stat-value">${dataFlow.dataStores.length}</div>
          <div class="flow-stat-label">Data Stores</div>
        </div>
        <div class="flow-stat-box ${componentsWithIssues > 0 ? 'flow-stat-warning' : ''}">
          <div class="flow-stat-value">${componentsWithIssues}</div>
          <div class="flow-stat-label">With Issues</div>
        </div>
      </div>

      <div class="mermaid-container">
        <pre class="mermaid">
${mermaidCode}
        </pre>
      </div>

      <div class="flow-legend">
        <h3>Legend</h3>
        <div class="legend-items">
          <div class="legend-item">
            <span class="legend-box legend-normal"></span>
            <span>Secure Component</span>
          </div>
          <div class="legend-item">
            <span class="legend-box legend-issue"></span>
            <span>Component with Security Issues</span>
          </div>
          <div class="legend-item">
            <span class="legend-box legend-external"></span>
            <span>External Service (requires BAA)</span>
          </div>
        </div>
      </div>

      <div class="flow-notice">
        <strong>⚠️ Important:</strong> Este diagrama muestra el flujo de datos detectado en el código fuente.
        Debe complementarse con documentación de infraestructura de red, VPNs, firewalls, segmentación de red,
        y otros controles de seguridad no visibles en el análisis de código estático.
      </div>

      <div class="flow-components">
        <h3>Detected Components</h3>

        ${dataFlow.entryPoints.length > 0 ? `
        <div class="component-group">
          <h4>🔌 Entry Points</h4>
          <ul>
            ${dataFlow.entryPoints.map(ep => `
              <li class="${ep.hasIssues ? 'component-with-issues' : ''}">
                ${escapeHtml(ep.name)}
                ${ep.hasIssues ? '<span class="issue-badge">⚠️ Has Issues</span>' : ''}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        ${dataFlow.authProviders.length > 0 ? `
        <div class="component-group">
          <h4>🔐 Authentication Providers</h4>
          <ul>
            ${dataFlow.authProviders.map(auth => `
              <li class="${auth.hasIssues ? 'component-with-issues' : ''}">
                ${escapeHtml(auth.name)}
                ${auth.hasIssues ? '<span class="issue-badge">⚠️ Has Issues</span>' : ''}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        ${dataFlow.dataStores.length > 0 ? `
        <div class="component-group">
          <h4>🗄️ Data Stores</h4>
          <ul>
            ${dataFlow.dataStores.map(ds => `
              <li class="${ds.hasIssues ? 'component-with-issues' : ''}">
                ${escapeHtml(ds.name)}
                ${ds.hasIssues ? '<span class="issue-badge">⚠️ Has Issues</span>' : ''}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        ${dataFlow.externalServices.length > 0 ? `
        <div class="component-group">
          <h4>☁️ External Services (BAA Required)</h4>
          <ul>
            ${dataFlow.externalServices.map(svc => `
              <li class="${svc.hasIssues ? 'component-with-issues' : ''}">
                ${escapeHtml(svc.name)}
                <span class="baa-badge">BAA</span>
                ${svc.hasIssues ? '<span class="issue-badge">⚠️ Has Issues</span>' : ''}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

function calculateComplianceScore(findings: Finding[]): ComplianceScore {
  // Count by severity
  const criticals = findings.filter(f => f.severity === 'critical').length;
  const highs = findings.filter(f => f.severity === 'high').length;
  const mediums = findings.filter(f => f.severity === 'medium').length;
  const lows = findings.filter(f => f.severity === 'low').length;

  // Calculate overall score
  const deductions = (criticals * 15) + (highs * 8) + (mediums * 3) + (lows * 1);
  const overall = Math.max(0, Math.min(100, 100 - deductions));

  // Determine grade and color
  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  let color: string;

  if (overall >= 95) {
    grade = 'A+';
    color = '#10b981'; // green
  } else if (overall >= 80) {
    grade = 'A';
    color = '#10b981'; // green
  } else if (overall >= 60) {
    grade = 'B';
    color = '#eab308'; // yellow
  } else if (overall >= 40) {
    grade = 'C';
    color = '#f97316'; // orange
  } else if (overall >= 20) {
    grade = 'D';
    color = '#ef4444'; // red
  } else {
    grade = 'F';
    color = '#dc2626'; // dark red
  }

  // Calculate by category
  const categoryMap: Record<string, string> = {
    'phi-exposure': 'PHI Protection',
    'encryption': 'Encryption',
    'audit-logging': 'Audit & Logging',
    'access-control': 'Access Control',
    'data-retention': 'Data Retention',
  };

  const byCategory: Record<string, { score: number; findings: number }> = {};

  for (const [key, label] of Object.entries(categoryMap)) {
    const categoryFindings = findings.filter(f => f.category === key);
    const catCriticals = categoryFindings.filter(f => f.severity === 'critical').length;
    const catHighs = categoryFindings.filter(f => f.severity === 'high').length;
    const catMediums = categoryFindings.filter(f => f.severity === 'medium').length;
    const catLows = categoryFindings.filter(f => f.severity === 'low').length;

    const catDeductions = (catCriticals * 15) + (catHighs * 8) + (catMediums * 3) + (catLows * 1);
    const catScore = Math.max(0, Math.min(100, 100 - catDeductions));

    byCategory[label] = {
      score: catScore,
      findings: categoryFindings.length,
    };
  }

  return { overall, grade, color, byCategory };
}

async function getScoreTrending(targetPath: string, currentScore: number): Promise<ScoreTrending | null> {
  try {
    const historyDir = path.join(targetPath, '.vlayer', 'history');
    const files = await readdir(historyDir);

    // Find the most recent history file (exclude current)
    const historyFiles = files
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (historyFiles.length === 0) {
      return null;
    }

    // Read the most recent previous scan
    const previousFile = path.join(historyDir, historyFiles[0]);
    const content = await readFile(previousFile, 'utf-8');
    const previousReport = JSON.parse(content);

    if (!previousReport.complianceScore) {
      return null;
    }

    const previousScore = previousReport.complianceScore.overall;
    const change = currentScore - previousScore;

    let direction: 'up' | 'down' | 'same';
    if (Math.abs(change) < 1) {
      direction = 'same';
    } else if (change > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }

    return { direction, previousScore, change };
  } catch (error) {
    // No history available
    return null;
  }
}

function buildReport(
  result: ScanResult,
  targetPath: string,
  vulnerabilities?: DependencyVulnerability[]
): Report {
  const acknowledged = result.findings.filter(f => f.acknowledged && !f.acknowledgment?.expired);
  const suppressed = result.findings.filter(f => f.suppressed);
  const baseline = result.findings.filter(f => f.isBaseline);

  // New findings are those that are NOT acknowledged, suppressed, or baseline
  const newFindings = result.findings.filter(f =>
    !f.acknowledged && !f.suppressed && !f.isBaseline
  );

  const summary: Report['summary'] = {
    total: result.findings.length,
    acknowledged: acknowledged.length,
    suppressed: suppressed.length,
    baseline: baseline.length,
    unacknowledged: newFindings.length,
    critical: newFindings.filter(f => f.severity === 'critical').length,
    high: newFindings.filter(f => f.severity === 'high').length,
    medium: newFindings.filter(f => f.severity === 'medium').length,
    low: newFindings.filter(f => f.severity === 'low').length,
    info: newFindings.filter(f => f.severity === 'info').length,
  };

  // Add vulnerability summary if present
  if (vulnerabilities && vulnerabilities.length > 0) {
    summary.vulnerabilities = {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    targetPath,
    summary,
    findings: result.findings,
    scannedFiles: result.scannedFiles,
    scanDuration: result.scanDuration,
    stack: result.stack,
    vulnerabilities,
  };
}

function generateJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

function renderContextMarkdown(context?: ContextLine[]): string {
  if (!context || context.length === 0) return '';

  const lines = context.map(c => {
    const prefix = c.isMatch ? '>' : ' ';
    const lineNum = String(c.lineNumber).padStart(4, ' ');
    return `${prefix} ${lineNum} | ${c.content}`;
  });

  return '\n```\n' + lines.join('\n') + '\n```\n';
}

function generateMarkdown(report: Report): string {
  const lines: string[] = [
    '# HIPAA Compliance Report',
    '',
    `**Generated:** ${report.timestamp}`,
    `**Target:** ${report.targetPath}`,
    `**Files Scanned:** ${report.scannedFiles}`,
    `**Duration:** ${report.scanDuration}ms`,
    '',
    '## Summary',
    '',
    `| Severity | Count |`,
    `|----------|-------|`,
    `| Critical | ${report.summary.critical} |`,
    `| High | ${report.summary.high} |`,
    `| Medium | ${report.summary.medium} |`,
    `| Low | ${report.summary.low} |`,
    `| Info | ${report.summary.info} |`,
    `| **Total** | **${report.summary.total}** |`,
    '',
  ];

  // Add vulnerability summary if present
  if (report.vulnerabilities && report.vulnerabilities.length > 0) {
    lines.push(
      '## Dependency Vulnerabilities',
      '',
      `> Security vulnerabilities detected in project dependencies via \`npm audit\``,
      '',
      '### Summary',
      '',
      '| Severity | Count |',
      '|----------|-------|',
      `| Critical | ${report.summary.vulnerabilities?.critical || 0} |`,
      `| High | ${report.summary.vulnerabilities?.high || 0} |`,
      `| Moderate | ${report.summary.vulnerabilities?.moderate || 0} |`,
      `| Low | ${report.summary.vulnerabilities?.low || 0} |`,
      `| **Total** | **${report.vulnerabilities.length}** |`,
      '',
      '### Affected Packages',
      ''
    );

    for (const vuln of report.vulnerabilities) {
      const fixInfo = vuln.fixAvailable
        ? typeof vuln.fixAvailable === 'object'
          ? `✅ Fix: ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}`
          : '✅ Fix Available'
        : '⚠️ No Fix Yet';

      lines.push(
        `#### ${vuln.severity.toUpperCase()}: \`${vuln.name}\``,
        '',
        `- **Vulnerability:** ${vuln.via}`,
        `- **Affected Range:** \`${vuln.range}\``,
        `- **Status:** ${fixInfo}`,
        vuln.url ? `- **Advisory:** ${vuln.url}` : '',
        ''
      );
    }

    lines.push('---', '');
  }

  if (report.findings.length > 0) {
    lines.push('## Findings', '');

    const groupedByCategory = report.findings.reduce((acc, f) => {
      acc[f.category] = acc[f.category] || [];
      acc[f.category].push(f);
      return acc;
    }, {} as Record<string, Finding[]>);

    for (const [category, findings] of Object.entries(groupedByCategory)) {
      lines.push(`### ${formatCategory(category)}`, '');

      for (const finding of findings) {
        lines.push(
          `#### ${severityBadge(finding.severity)} ${finding.title}`,
          '',
          `**File:** \`${finding.file}\`${finding.line ? `:${finding.line}` : ''}`,
          '',
          finding.description,
          ''
        );

        // Add context if available
        if (finding.context && finding.context.length > 0) {
          lines.push(renderContextMarkdown(finding.context));
        }

        lines.push(
          `**Recommendation:** ${finding.recommendation}`,
          ''
        );
        if (finding.hipaaReference) {
          lines.push(`**HIPAA Reference:** ${finding.hipaaReference}`, '');
        }
        lines.push('---', '');
      }
    }
  } else {
    lines.push('## No Issues Found', '', 'The scan did not detect any HIPAA compliance issues.');
  }

  return lines.join('\n');
}

function renderContextHtml(context?: ContextLine[]): string {
  if (!context || context.length === 0) return '';

  const lines = context.map(c => {
    const lineNum = String(c.lineNumber).padStart(4, ' ');
    const highlightClass = c.isMatch ? 'highlight' : '';
    return `<div class="context-line ${highlightClass}"><span class="line-num">${lineNum}</span><span class="line-content">${escapeHtml(c.content)}</span></div>`;
  });

  return `<div class="context">${lines.join('')}</div>`;
}

function renderRemediationGuide(guide: RemediationGuide): string {
  return `
    <div class="remediation-guide">
      <div class="hipaa-impact">
        <h5>HIPAA Impact</h5>
        <p>${escapeHtml(guide.hipaaImpact).replace(/\n/g, '<br>')}</p>
      </div>

      <div class="fix-options">
        <h5>How to Fix</h5>
        ${guide.options.map((option, index) => `
          <details class="fix-option" ${index === 0 ? 'open' : ''}>
            <summary>${escapeHtml(option.title)}</summary>
            <p class="option-desc">${escapeHtml(option.description)}</p>
            <pre class="code-block"><code class="language-${option.language}">${escapeHtml(option.code)}</code></pre>
          </details>
        `).join('')}
      </div>

      <div class="documentation-links">
        <h5>Documentation</h5>
        <ul>
          ${guide.documentation.map(doc => `
            <li><a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">${escapeHtml(doc.title)}</a></li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderStackGuide(guide: StackGuide): string {
  return `
    <div class="stack-guide">
      <details class="fix-option" open>
        <summary>${escapeHtml(guide.title)}</summary>
        <p class="option-desc">${escapeHtml(guide.description)}</p>
        <pre class="code-block"><code class="language-${guide.language}">${escapeHtml(guide.code)}</code></pre>
      </details>
    </div>
  `;
}

function renderStackSection(stack: StackInfo): string {
  // Get stack-specific guides
  const detectedStack = {
    framework: stack.framework as any,
    database: stack.database as any,
    auth: stack.auth as any,
    dependencies: [],
    confidence: { framework: 1, database: 1, auth: 1 },
    details: {},
  };
  const guides = getStackSpecificGuides(detectedStack);

  return `
    <div class="stack-section">
      <h2>Stack Detected</h2>
      <div class="stack-cards">
        <div class="stack-card">
          <div class="stack-icon">⚡</div>
          <div class="stack-label">Framework</div>
          <div class="stack-value">${escapeHtml(stack.frameworkDisplay)}</div>
        </div>
        <div class="stack-card">
          <div class="stack-icon">🗄️</div>
          <div class="stack-label">Database</div>
          <div class="stack-value">${escapeHtml(stack.databaseDisplay)}</div>
        </div>
        <div class="stack-card">
          <div class="stack-icon">🔐</div>
          <div class="stack-label">Authentication</div>
          <div class="stack-value">${escapeHtml(stack.authDisplay)}</div>
        </div>
      </div>

      ${stack.recommendations.length > 0 ? `
      <div class="stack-recommendations">
        <h3>Stack-Specific Recommendations</h3>
        <ul>
          ${stack.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      ${guides.session.length > 0 || guides.database.length > 0 || guides.auth.length > 0 ? `
      <div class="stack-guides">
        <h3>Code Examples for Your Stack</h3>

        ${guides.session.length > 0 ? `
        <div class="guide-category">
          <h4>🔒 Session Management (${stack.frameworkDisplay})</h4>
          ${guides.session.map(g => renderStackGuide(g)).join('')}
        </div>
        ` : ''}

        ${guides.database.length > 0 ? `
        <div class="guide-category">
          <h4>🗄️ Database Security (${stack.databaseDisplay})</h4>
          ${guides.database.map(g => renderStackGuide(g)).join('')}
        </div>
        ` : ''}

        ${guides.auth.length > 0 ? `
        <div class="guide-category">
          <h4>🔐 Authentication (${stack.authDisplay})</h4>
          ${guides.auth.map(g => renderStackGuide(g)).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}
    </div>
  `;
}

async function generateHtml(report: Report, targetPath: string, options: ReportOptions): Promise<string> {
  const complianceScoreHtml = await renderComplianceScoreHtml(report, targetPath);
  const assetInventoryHtml = await renderAssetInventoryHtml(targetPath);
  const dataFlowMapHtml = await renderDataFlowMapHtml(targetPath, report.findings);
  const severityColors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
    info: '#6b7280',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HIPAA Compliance Report - vlayer</title>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; padding: 2rem; }
    .container { max-width: 1400px; margin: 0 auto; }

    /* Executive Summary Styles */
    .executive-summary-section { margin: 0 0 3rem 0; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
    .exec-header h1 { color: #111827; font-size: 2.5rem; margin: 0 0 0.5rem 0; }
    .exec-subtitle { color: #6b7280; font-size: 1.1rem; margin: 0 0 1rem 0; }
    .exec-meta { color: #9ca3af; font-size: 0.9rem; }
    .exec-meta span { margin: 0 0.5rem; }
    .exec-meta span:first-child { margin-left: 0; }
    .exec-status-card { display: flex; align-items: center; gap: 1.5rem; padding: 2rem; margin: 2rem 0; background: #f9fafb; border-radius: 12px; border-left: 6px solid; }
    .exec-status-icon { font-size: 3rem; line-height: 1; }
    .exec-status-content h2 { margin: 0 0 0.5rem 0; font-size: 1.5rem; }
    .exec-status-content p { margin: 0; color: #4b5563; font-size: 1rem; }
    .exec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
    .exec-metric-card { background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.04); }
    .exec-metric-label { color: #6b7280; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem; }
    .exec-metric-value { color: #111827; font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; line-height: 1; }
    .exec-metric-desc { color: #6b7280; font-size: 0.85rem; }
    .exec-priority-section { margin: 2.5rem 0; padding: 2rem; background: #fef2f2; border-radius: 12px; border-left: 4px solid #dc2626; }
    .exec-priority-section h3 { color: #111827; margin: 0 0 0.75rem 0; font-size: 1.3rem; }
    .exec-priority-intro { color: #4b5563; margin: 0 0 1.5rem 0; }
    .exec-priority-list { display: flex; flex-direction: column; gap: 1rem; }
    .exec-priority-item { display: flex; gap: 1rem; background: white; padding: 1.5rem; border-radius: 8px; border-left: 4px solid; }
    .exec-priority-number { width: 32px; height: 32px; background: #111827; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.9rem; flex-shrink: 0; }
    .exec-priority-content { flex: 1; }
    .exec-priority-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .exec-priority-badge { padding: 0.25rem 0.6rem; border-radius: 4px; color: white; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
    .exec-priority-title { font-weight: 600; color: #111827; font-size: 1.05rem; }
    .exec-priority-desc { color: #4b5563; margin-bottom: 0.75rem; font-size: 0.95rem; }
    .exec-priority-action { background: #f0fdf4; padding: 0.75rem; border-radius: 6px; border-left: 3px solid #10b981; margin-bottom: 0.75rem; }
    .exec-priority-action strong { color: #065f46; }
    .exec-priority-ref { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .exec-file-ref { font-family: 'SF Mono', Monaco, monospace; font-size: 0.8rem; color: #6b7280; background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px; }
    .exec-hipaa-ref { font-family: 'SF Mono', Monaco, monospace; font-size: 0.8rem; color: #3730a3; background: #e0e7ff; padding: 0.25rem 0.5rem; border-radius: 4px; }
    .exec-categories-section { margin: 2.5rem 0; }
    .exec-categories-section h3 { color: #111827; margin: 0 0 1.5rem 0; font-size: 1.3rem; }
    .exec-category-bars { display: flex; flex-direction: column; gap: 1rem; }
    .exec-category-item { background: white; padding: 1.25rem; border-radius: 8px; border: 1px solid #e5e7eb; }
    .exec-category-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .exec-category-name { font-weight: 600; color: #111827; }
    .exec-category-count { color: #6b7280; font-size: 0.9rem; }
    .exec-category-bar-bg { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
    .exec-category-bar { height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%); border-radius: 4px; transition: width 0.3s ease; }
    .exec-recommendations { margin: 2.5rem 0; padding: 2rem; background: #eff6ff; border-radius: 12px; border-left: 4px solid #3b82f6; }
    .exec-recommendations h3 { color: #111827; margin: 0 0 1rem 0; font-size: 1.3rem; }
    .exec-recommendations-list { margin: 0; padding-left: 1.5rem; }
    .exec-recommendations-list li { margin: 0.75rem 0; color: #374151; line-height: 1.7; }
    .exec-recommendations-list li strong { color: #1e40af; }
    .exec-congrats { display: flex; align-items: center; gap: 1.5rem; padding: 2rem; margin: 2rem 0; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; border-left: 4px solid #10b981; }
    .exec-congrats-icon { font-size: 3rem; line-height: 1; }
    .exec-congrats-content h3 { color: #065f46; margin: 0 0 0.5rem 0; }
    .exec-congrats-content p { color: #047857; margin: 0; }
    h1 { color: #111827; margin-bottom: 0.5rem; }
    h2 { color: #374151; margin: 2rem 0 1rem; }
    .meta { color: #6b7280; margin-bottom: 2rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .summary-card .count { font-size: 2rem; font-weight: bold; }
    .findings { display: flex; flex-direction: column; gap: 1.5rem; }
    .finding { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid; }
    .finding h3 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: white; text-transform: uppercase; }
    .badge-fixable { background: #059669; margin-left: 0.5rem; }
    .file { font-family: 'SF Mono', Monaco, 'Courier New', monospace; background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; word-break: break-all; }
    .context { margin: 1rem 0; background: #1e1e1e; border-radius: 6px; padding: 0.75rem; overflow-x: auto; }
    .context-line { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 0.8rem; line-height: 1.5; white-space: pre; color: #d4d4d4; }
    .context-line.highlight { background: rgba(234, 88, 12, 0.3); color: #fff; }
    .context-line .line-num { color: #6b7280; margin-right: 1rem; user-select: none; }
    .recommendation { margin-top: 1rem; padding: 1rem; background: #eff6ff; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .hipaa-ref { color: #6b7280; font-size: 0.875rem; margin-top: 0.5rem; }

    /* Remediation Guide Styles */
    .guide-toggle { margin-top: 1rem; }
    .guide-toggle summary { cursor: pointer; padding: 0.75rem 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 6px; font-weight: 600; list-style: none; display: flex; align-items: center; gap: 0.5rem; }
    .guide-toggle summary::-webkit-details-marker { display: none; }
    .guide-toggle summary::before { content: '▶'; font-size: 0.75rem; transition: transform 0.2s; }
    .guide-toggle[open] summary::before { transform: rotate(90deg); }
    .guide-toggle summary:hover { opacity: 0.9; }

    .remediation-guide { padding: 1.5rem; background: #fefefe; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; }
    .remediation-guide h5 { color: #374151; margin: 1rem 0 0.5rem; font-size: 0.95rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
    .remediation-guide h5:first-child { margin-top: 0; }

    .hipaa-impact { background: #fef2f2; padding: 1rem; border-radius: 6px; border-left: 3px solid #dc2626; margin-bottom: 1rem; }
    .hipaa-impact p { color: #7f1d1d; font-size: 0.9rem; }

    .fix-options { margin: 1rem 0; }
    .fix-option { margin: 0.75rem 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .fix-option summary { padding: 0.75rem 1rem; background: #f9fafb; cursor: pointer; font-weight: 500; color: #1f2937; }
    .fix-option summary:hover { background: #f3f4f6; }
    .fix-option[open] summary { border-bottom: 1px solid #e5e7eb; }
    .option-desc { padding: 1rem; color: #4b5563; font-size: 0.9rem; background: #fff; }

    .code-block { margin: 0; padding: 1rem; background: #1e1e1e; border-radius: 0 0 6px 6px; overflow-x: auto; }
    .code-block code { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 0.8rem; color: #d4d4d4; white-space: pre; }

    .documentation-links { margin-top: 1rem; }
    .documentation-links ul { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .documentation-links li a { display: inline-block; padding: 0.35rem 0.75rem; background: #e0e7ff; color: #3730a3; border-radius: 4px; text-decoration: none; font-size: 0.85rem; transition: background 0.2s; }
    .documentation-links li a:hover { background: #c7d2fe; }

    /* Syntax highlighting (basic) */
    .code-block .keyword { color: #c586c0; }
    .code-block .string { color: #ce9178; }
    .code-block .comment { color: #6a9955; }
    .code-block .function { color: #dcdcaa; }

    /* Stack Section Styles */
    .stack-section { margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 12px; border: 1px solid #e5e7eb; }
    .stack-section h2 { color: #374151; margin-bottom: 1rem; }
    .stack-section h3 { color: #4b5563; margin: 1.5rem 0 1rem; font-size: 1.1rem; }
    .stack-section h4 { color: #6b7280; margin: 1rem 0 0.5rem; font-size: 1rem; }
    .stack-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stack-card { background: white; padding: 1.25rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e5e7eb; }
    .stack-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .stack-label { color: #6b7280; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .stack-value { color: #1f2937; font-size: 1.25rem; font-weight: 600; margin-top: 0.25rem; }
    .stack-recommendations { background: white; padding: 1rem 1.5rem; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 1.5rem; }
    .stack-recommendations ul { margin: 0.5rem 0 0 1.5rem; }
    .stack-recommendations li { margin: 0.5rem 0; color: #374151; }
    .stack-guides { background: white; padding: 1.5rem; border-radius: 8px; }
    .guide-category { margin-bottom: 1.5rem; }
    .guide-category:last-child { margin-bottom: 0; }
    .stack-guide { margin: 0.75rem 0; }

    /* Compliance Score Styles */
    .compliance-score-section { margin: 2rem 0; padding: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); color: white; }
    .score-header h2 { color: white; margin: 0 0 0.5rem 0; font-size: 1.75rem; }
    .score-subtitle { color: rgba(255,255,255,0.9); margin: 0; font-size: 0.95rem; }
    .score-main { display: grid; grid-template-columns: auto 1fr; gap: 2rem; margin: 2rem 0; align-items: center; }
    .score-circle { width: 180px; height: 180px; border-radius: 50%; border: 8px solid; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .score-value { font-size: 3.5rem; font-weight: bold; line-height: 1; }
    .score-max { font-size: 1rem; color: #6b7280; margin-top: -0.5rem; }
    .score-grade { position: absolute; bottom: -15px; padding: 0.35rem 1rem; border-radius: 20px; color: white; font-weight: bold; font-size: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
    .score-info { color: white; }
    .score-description { font-size: 1.1rem; margin-bottom: 1rem; line-height: 1.6; }
    .score-trending { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(255,255,255,0.2); border-radius: 8px; margin-bottom: 1rem; }
    .trending-icon { font-size: 1.5rem; font-weight: bold; }
    .trending-up { border-left: 4px solid #10b981; }
    .trending-up .trending-icon { color: #10b981; }
    .trending-down { border-left: 4px solid #ef4444; }
    .trending-down .trending-icon { color: #ef4444; }
    .trending-same { border-left: 4px solid #94a3b8; }
    .trending-same .trending-icon { color: #94a3b8; }
    .trending-text { font-size: 0.9rem; }
    .score-formula { font-size: 0.85rem; color: rgba(255,255,255,0.8); margin-top: 0.75rem; font-family: 'SF Mono', Monaco, monospace; }
    .score-categories { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.2); }
    .score-categories h3 { color: white; margin: 0 0 1.5rem 0; font-size: 1.3rem; }
    .category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
    .category-card { background: rgba(255,255,255,0.15); padding: 1.25rem; border-radius: 10px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
    .category-name { font-weight: 600; margin-bottom: 0.75rem; font-size: 0.95rem; }
    .category-score-container { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
    .category-bar-bg { flex: 1; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; }
    .category-bar { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
    .category-score { font-weight: bold; font-size: 1.25rem; min-width: 40px; text-align: right; }
    .category-findings { font-size: 0.8rem; color: rgba(255,255,255,0.7); }

    /* Risk Analysis Styles */
    .risk-analysis-section { margin: 2rem 0; padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .risk-analysis-section h2 { color: #111827; margin-bottom: 0.5rem; }
    .risk-analysis-section h3 { color: #374151; margin: 1.5rem 0 1rem; font-size: 1.1rem; }

    /* Asset Inventory Styles */
    .asset-inventory-section { margin: 2rem 0; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .inventory-header h2 { color: #111827; margin: 0 0 0.5rem 0; }
    .inventory-subtitle { color: #6b7280; margin: 0 0 1.5rem 0; font-size: 0.95rem; }
    .inventory-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-box { background: #f9fafb; padding: 1.25rem; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
    .stat-value { font-size: 1.75rem; font-weight: bold; color: #1f2937; margin-bottom: 0.25rem; }
    .stat-label { color: #6b7280; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .inventory-notice { background: #eff6ff; padding: 1rem 1.25rem; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 1.5rem; color: #1e40af; font-size: 0.9rem; }
    .inventory-notice strong { color: #1e3a8a; }
    .export-csv-link { color: #2563eb; font-weight: 600; text-decoration: none; margin-left: 0.5rem; }
    .export-csv-link:hover { text-decoration: underline; }
    .inventory-table-container { overflow-x: auto; }
    .inventory-table { width: 100%; border-collapse: collapse; }
    .inventory-table th { background: #f9fafb; padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 0.85rem; white-space: nowrap; }
    .inventory-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    .inventory-table tr:hover { background: #f9fafb; }
    .inventory-table .category-row { background: #f3f4f6; }
    .inventory-table .category-row td { padding: 0.5rem 1rem; font-weight: 600; color: #1f2937; border-bottom: 1px solid #d1d5db; }
    .asset-id { font-family: 'SF Mono', Monaco, monospace; color: #6b7280; font-size: 0.85rem; }
    .asset-name code { background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.85rem; color: #1f2937; }
    .asset-version { color: #6b7280; font-size: 0.85rem; }
    .asset-provider { color: #374151; font-size: 0.9rem; }
    .category-badge { display: inline-block; padding: 0.2rem 0.6rem; background: #e0e7ff; color: #3730a3; border-radius: 4px; font-size: 0.75rem; font-weight: 500; text-transform: capitalize; }
    .editable-field input { width: 100%; padding: 0.4rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.85rem; color: #1f2937; }
    .editable-field input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .editable-field input::placeholder { color: #9ca3af; }

    /* Data Flow Map Styles */
    .data-flow-map-section { margin: 2rem 0; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .flow-header h2 { color: #111827; margin: 0 0 0.5rem 0; }
    .flow-subtitle { color: #6b7280; margin: 0 0 1.5rem 0; font-size: 0.95rem; }
    .flow-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .flow-stat-box { background: #f9fafb; padding: 1.25rem; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
    .flow-stat-box.flow-stat-warning { background: #fef2f2; border-color: #fecaca; }
    .flow-stat-value { font-size: 1.75rem; font-weight: bold; color: #1f2937; margin-bottom: 0.25rem; }
    .flow-stat-warning .flow-stat-value { color: #dc2626; }
    .flow-stat-label { color: #6b7280; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .mermaid-container { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 2rem; margin: 2rem 0; overflow-x: auto; }
    .mermaid-container pre.mermaid { background: transparent; margin: 0; padding: 0; text-align: center; }
    .flow-legend { margin: 2rem 0; padding: 1.5rem; background: #f9fafb; border-radius: 8px; border-left: 4px solid #3b82f6; }
    .flow-legend h3 { margin: 0 0 1rem 0; color: #374151; font-size: 1rem; }
    .legend-items { display: flex; flex-wrap: wrap; gap: 1.5rem; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; }
    .legend-box { width: 40px; height: 20px; border-radius: 4px; border: 2px solid; }
    .legend-normal { background: #dbeafe; border-color: #3b82f6; }
    .legend-issue { background: #fee2e2; border-color: #dc2626; }
    .legend-external { background: #fef3c7; border-color: #f59e0b; }
    .flow-notice { background: #fef3c7; padding: 1rem 1.25rem; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 2rem 0; color: #92400e; font-size: 0.9rem; }
    .flow-notice strong { color: #78350f; }
    .flow-components { margin-top: 2rem; }
    .flow-components h3 { color: #374151; margin: 0 0 1.5rem 0; font-size: 1.1rem; }
    .component-group { margin-bottom: 1.5rem; }
    .component-group h4 { color: #4b5563; margin: 0 0 0.75rem 0; font-size: 0.95rem; }
    .component-group ul { list-style: none; margin: 0; padding: 0; }
    .component-group li { padding: 0.5rem 0.75rem; margin: 0.25rem 0; background: #f9fafb; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; }
    .component-with-issues { background: #fef2f2 !important; border-left: 3px solid #dc2626; }
    .issue-badge { background: #dc2626; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .baa-badge { background: #f59e0b; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }

    .risk-summary-table table, .risk-detail-table table { width: 100%; border-collapse: collapse; background: white; }
    .risk-summary-table { margin: 1rem 0; overflow-x: auto; }
    .risk-detail-table { margin: 1rem 0; overflow-x: auto; }

    .risk-summary-table th, .risk-detail-table th { background: #f9fafb; padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
    .risk-summary-table td, .risk-detail-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .risk-summary-table tr:hover, .risk-detail-table tr:hover { background: #f9fafb; }

    .threat-cell { font-weight: 500; color: #1f2937; max-width: 200px; }
    .vulnerability-cell { max-width: 250px; }
    .vulnerability-cell strong { display: block; margin-bottom: 0.25rem; color: #111827; }
    .file-ref { font-family: 'SF Mono', Monaco, monospace; font-size: 0.75rem; color: #6b7280; word-break: break-all; }
    .risk-level-cell { text-align: center; }
    .risk-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: white; text-transform: uppercase; }
    .status-cell { text-align: center; }
    .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
    .status-open { background: #fee2e2; color: #991b1b; }
    .status-available { background: #d1fae5; color: #065f46; }
    .remediation-cell { color: #4b5563; font-size: 0.875rem; max-width: 300px; }
    .hipaa-cell { color: #6b7280; font-size: 0.8rem; font-family: 'SF Mono', Monaco, monospace; white-space: nowrap; }

    /* Backup & Recovery Styles */
    .backup-recovery-section { margin: 2rem 0; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .backup-header h2 { color: #111827; margin: 0 0 0.5rem 0; }
    .backup-subtitle { color: #6b7280; margin: 0 0 1.5rem 0; font-size: 0.95rem; }
    .backup-hipaa-notice { background: #fef3c7; padding: 1.25rem; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 2rem; color: #92400e; font-size: 0.9rem; line-height: 1.6; }
    .backup-hipaa-notice strong { color: #78350f; }
    .backup-guide-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 2rem; margin: 2rem 0; }
    .backup-guide-card.backup-guide-warning { background: #fffbeb; border-color: #fcd34d; }
    .backup-guide-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #e5e7eb; }
    .backup-guide-icon { font-size: 2rem; line-height: 1; }
    .backup-guide-header h4 { margin: 0; color: #111827; font-size: 1.2rem; }
    .backup-guide-content { }
    .backup-step { display: flex; gap: 1rem; margin: 1.5rem 0; }
    .backup-step-number { width: 36px; height: 36px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; flex-shrink: 0; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3); }
    .backup-step-content { flex: 1; }
    .backup-step-content strong { display: block; color: #111827; margin-bottom: 0.5rem; font-size: 1.05rem; }
    .backup-step-content p { color: #4b5563; margin: 0.5rem 0; font-size: 0.95rem; }
    .backup-code-block { background: #1e1e1e; border-radius: 6px; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
    .backup-code-block pre { margin: 0; }
    .backup-code-block code { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 0.85rem; color: #d4d4d4; white-space: pre; line-height: 1.5; }
    .backup-checklist { list-style: none; margin: 0.75rem 0 0 0; padding: 0; }
    .backup-checklist li { padding: 0.5rem 0; color: #374151; font-size: 0.9rem; }
    .backup-verification-checklist { margin: 2.5rem 0; padding: 2rem; background: #f0fdf4; border-radius: 10px; border-left: 4px solid #10b981; }
    .backup-verification-checklist h3 { color: #065f46; margin: 0 0 1.5rem 0; font-size: 1.2rem; }
    .backup-checklist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
    .backup-checklist-item { background: white; padding: 1rem; border-radius: 8px; border: 1px solid #d1fae5; display: flex; align-items: start; gap: 0.75rem; }
    .backup-checklist-item input[type="checkbox"] { width: 20px; height: 20px; margin-top: 0.25rem; cursor: pointer; flex-shrink: 0; accent-color: #10b981; }
    .backup-checklist-item label { flex: 1; cursor: pointer; }
    .backup-checklist-item label strong { display: block; color: #065f46; margin-bottom: 0.25rem; font-size: 0.95rem; }
    .backup-checklist-item label span { display: block; color: #6b7280; font-size: 0.85rem; }
    .backup-recovery-timeline { margin: 2.5rem 0; padding: 2rem; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 10px; border-left: 4px solid #3b82f6; }
    .backup-recovery-timeline h3 { color: #1e40af; margin: 0 0 1.5rem 0; font-size: 1.2rem; }
    .rto-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
    .rto-item { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 4px solid; text-align: center; }
    .rto-item.rto-critical { border-left-color: #dc2626; }
    .rto-item.rto-important { border-left-color: #f59e0b; }
    .rto-item.rto-standard { border-left-color: #10b981; }
    .rto-label { color: #6b7280; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem; }
    .rto-time { color: #111827; font-size: 1.75rem; font-weight: bold; margin-bottom: 0.5rem; }
    .rto-desc { color: #4b5563; font-size: 0.85rem; }

    /* Incident Response Styles */
    .incident-response-section { margin: 2rem 0; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .incident-header h2 { color: #111827; margin: 0 0 0.5rem 0; }
    .incident-subtitle { color: #6b7280; margin: 0 0 1.5rem 0; font-size: 0.95rem; }
    .incident-alert { display: flex; align-items: start; gap: 1rem; padding: 1.5rem; margin-bottom: 2rem; background: #fef2f2; border-radius: 10px; border-left: 4px solid #dc2626; }
    .incident-alert-icon { font-size: 2rem; line-height: 1; }
    .incident-alert-content strong { display: block; color: #991b1b; margin-bottom: 0.5rem; font-size: 1.1rem; }
    .incident-alert-content p { color: #7f1d1d; margin: 0; }
    .incident-hipaa-notice { background: #eff6ff; padding: 1.25rem; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 2rem; color: #1e40af; font-size: 0.9rem; line-height: 1.6; }
    .incident-hipaa-notice strong { color: #1e3a8a; }
    .incident-team-section { margin: 2.5rem 0; }
    .incident-team-section h3 { color: #111827; margin: 0 0 1.5rem 0; font-size: 1.2rem; }
    .incident-team-table { overflow-x: auto; }
    .incident-team-table table { width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden; }
    .incident-team-table th { background: #374151; color: white; padding: 0.75rem 1rem; text-align: left; font-weight: 600; font-size: 0.85rem; }
    .incident-team-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    .incident-team-table tr:last-child td { border-bottom: none; }
    .incident-team-table tr:hover { background: white; }
    .editable-cell { background: white; }
    .contact-input { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.85rem; }
    .contact-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .severity-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin: 1.5rem 0; }
    .severity-card { background: #f9fafb; border-radius: 10px; padding: 1.5rem; border-left: 4px solid; }
    .severity-card.severity-critical { border-left-color: #dc2626; background: linear-gradient(135deg, #fef2f2 0%, #f9fafb 100%); }
    .severity-card.severity-high { border-left-color: #ea580c; background: linear-gradient(135deg, #fff7ed 0%, #f9fafb 100%); }
    .severity-card.severity-medium { border-left-color: #f59e0b; background: linear-gradient(135deg, #fffbeb 0%, #f9fafb 100%); }
    .severity-card.severity-low { border-left-color: #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #f9fafb 100%); }
    .severity-badge { display: inline-block; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem; margin-bottom: 1rem; }
    .severity-critical .severity-badge { background: #dc2626; color: white; }
    .severity-high .severity-badge { background: #ea580c; color: white; }
    .severity-medium .severity-badge { background: #f59e0b; color: white; }
    .severity-low .severity-badge { background: #3b82f6; color: white; }
    .severity-examples { margin-bottom: 1rem; }
    .severity-examples strong { display: block; color: #374151; margin-bottom: 0.5rem; }
    .severity-examples ul { margin: 0.5rem 0 0 1.5rem; padding: 0; }
    .severity-examples li { color: #4b5563; font-size: 0.9rem; margin: 0.25rem 0; }
    .severity-response { padding-top: 1rem; border-top: 1px solid #e5e7eb; }
    .severity-response strong { color: #111827; font-size: 0.9rem; }
    .phase-card { display: flex; gap: 1.5rem; margin: 1.5rem 0; padding: 1.5rem; background: #f9fafb; border-radius: 10px; border-left: 4px solid #3b82f6; }
    .phase-number { width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.5rem; flex-shrink: 0; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3); }
    .phase-content { flex: 1; }
    .phase-content h4 { margin: 0 0 1rem 0; color: #111827; font-size: 1.1rem; }
    .phase-checklist { }
    .phase-checklist ul { margin: 0.5rem 0 0 1.5rem; padding: 0; }
    .phase-checklist li { color: #374151; font-size: 0.9rem; margin: 0.5rem 0; }
    .phase-item { margin-bottom: 1rem; }
    .phase-item:last-child { margin-bottom: 0; }
    .phase-item strong { display: block; color: #1f2937; margin-bottom: 0.5rem; }
    .incident-breach-timeline { margin: 2.5rem 0; padding: 2rem; background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%); border-radius: 10px; border-left: 4px solid #f59e0b; }
    .incident-breach-timeline h3 { color: #78350f; margin: 0 0 1.5rem 0; font-size: 1.2rem; }
    .timeline-container { position: relative; padding-left: 2rem; }
    .timeline-container::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #f59e0b; }
    .timeline-item { position: relative; margin-bottom: 2rem; }
    .timeline-item:last-child { margin-bottom: 0; }
    .timeline-marker { position: absolute; left: -2.5rem; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #f59e0b; }
    .timeline-marker.timeline-discovery { background: #dc2626; }
    .timeline-marker.timeline-assessment { background: #f59e0b; }
    .timeline-marker.timeline-notification { background: #3b82f6; }
    .timeline-marker.timeline-documentation { background: #10b981; }
    .timeline-content { background: white; padding: 1rem 1.25rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .timeline-content strong { display: block; color: #111827; margin-bottom: 0.5rem; font-size: 1rem; }
    .timeline-content p { color: #4b5563; margin: 0; font-size: 0.9rem; line-height: 1.6; }
    .contacts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin: 1.5rem 0; }
    .contact-card { background: #f9fafb; padding: 1.25rem; border-radius: 8px; border: 1px solid #e5e7eb; }
    .contact-title { font-weight: 700; color: #111827; margin-bottom: 0.75rem; font-size: 0.95rem; }
    .contact-info { color: #4b5563; font-size: 0.85rem; }
    .contact-info div { margin: 0.25rem 0; }
    .contact-info a { color: #3b82f6; text-decoration: none; }
    .contact-info a:hover { text-decoration: underline; }
    .editable-contact input { width: 100%; margin: 0.25rem 0; }
    .contact-input-wide { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.85rem; margin: 0.25rem 0; }
    .contact-input-wide:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .incident-log-template { margin: 2.5rem 0; }
    .incident-log-template h3 { color: #111827; margin: 0 0 0.75rem 0; font-size: 1.2rem; }
    .template-note { color: #6b7280; margin-bottom: 1rem; font-size: 0.9rem; }
    .log-template-box { background: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; padding: 1.5rem; font-family: 'SF Mono', Monaco, monospace; font-size: 0.85rem; }
    .log-field { margin: 0.75rem 0; padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb; }
    .log-field:last-child { border-bottom: none; }
    .log-field strong { color: #374151; display: inline-block; min-width: 180px; }
    .log-placeholder { color: #6b7280; font-style: italic; }
    .incident-testing-section { margin: 2.5rem 0; padding: 2rem; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 10px; border-left: 4px solid #10b981; }
    .incident-testing-section h3 { color: #065f46; margin: 0 0 1.5rem 0; font-size: 1.2rem; }
    .testing-recommendations { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
    .testing-item { background: white; padding: 1.25rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .testing-frequency { display: inline-block; background: #10b981; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.75rem; }
    .testing-activity strong { display: block; color: #111827; margin-bottom: 0.5rem; }
    .testing-activity p { color: #4b5563; margin: 0; font-size: 0.9rem; }

    @media (max-width: 768px) {
      body { padding: 1rem; }
      .summary { grid-template-columns: repeat(2, 1fr); }
      .stack-cards { grid-template-columns: 1fr; }
      .risk-detail-table table { font-size: 0.8rem; }
      .risk-detail-table th, .risk-detail-table td { padding: 0.5rem; }
      .score-main { grid-template-columns: 1fr; justify-items: center; }
      .score-circle { width: 150px; height: 150px; }
      .score-value { font-size: 2.5rem; }
      .category-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${renderExecutiveSummaryHtml(report)}

    <h1>HIPAA Compliance Report</h1>
    <p style="color: #6b7280; margin-bottom: 1rem;">Generated by <strong>vlayer</strong> - HIPAA Compliance Scanner</p>
    <div class="meta">
      <p><strong>Generated:</strong> ${report.timestamp}</p>
      <p><strong>Target:</strong> ${report.targetPath}</p>
      <p><strong>Files Scanned:</strong> ${report.scannedFiles} | <strong>Duration:</strong> ${report.scanDuration}ms</p>
    </div>

    <div class="summary">
      <div class="summary-card" style="border-top: 4px solid ${severityColors.critical}">
        <div class="count" style="color: ${severityColors.critical}">${report.summary.critical}</div>
        <div>Critical</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.high}">
        <div class="count" style="color: ${severityColors.high}">${report.summary.high}</div>
        <div>High</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.medium}">
        <div class="count" style="color: ${severityColors.medium}">${report.summary.medium}</div>
        <div>Medium</div>
      </div>
      <div class="summary-card" style="border-top: 4px solid ${severityColors.low}">
        <div class="count" style="color: ${severityColors.low}">${report.summary.low}</div>
        <div>Low</div>
      </div>
    </div>

    ${complianceScoreHtml}

    ${renderScanComparisonHtml(options.scanComparison)}

    ${report.stack && report.stack.framework !== 'unknown' ? renderStackSection(report.stack) : ''}

    ${renderRiskAnalysisHtml(report)}

    ${assetInventoryHtml}

    ${dataFlowMapHtml}

    ${report.stack ? renderBackupRecoveryGuideHtml(report.stack) : ''}

    ${renderIncidentResponsePlanHtml(report.summary.critical, report.summary.high)}

    ${report.vulnerabilities ? renderDependencyVulnerabilitiesHtml(report.vulnerabilities) : ''}

    <h2>Findings</h2>
    <div class="findings">
      ${report.findings.map(f => {
        const guide = getRemediationGuide(f);
        return `
        <div class="finding" style="border-left-color: ${severityColors[f.severity]}">
          <h3>
            <span class="badge" style="background: ${severityColors[f.severity]}">${f.severity}</span>
            ${escapeHtml(f.title)}
            ${f.fixType ? '<span class="badge badge-fixable">Auto-fixable</span>' : ''}
          </h3>
          <p class="file">${escapeHtml(f.file)}${f.line ? `:${f.line}` : ''}</p>
          <p style="margin-top: 0.5rem;">${escapeHtml(f.description)}</p>
          ${renderContextHtml(f.context)}
          <div class="recommendation">
            <strong>Quick Recommendation:</strong> ${escapeHtml(f.recommendation)}
          </div>
          ${f.hipaaReference ? `<p class="hipaa-ref"><strong>HIPAA Reference:</strong> ${escapeHtml(f.hipaaReference)}</p>` : ''}

          ${guide ? `
          <details class="guide-toggle">
            <summary>View Detailed Remediation Guide</summary>
            ${renderRemediationGuide(guide)}
          </details>
          ` : ''}
        </div>
      `}).join('')}
    </div>

    <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.875rem;">
      <p>Generated by <strong>vlayer</strong> v0.2.0 - HIPAA Compliance Scanner for Healthcare Applications</p>
      <p>Run with <code>--fix</code> flag to automatically fix issues marked as "Auto-fixable"</p>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCategory(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getCategoryThreat(category: string): string {
  const threats: Record<string, string> = {
    'phi-exposure': 'Unauthorized PHI Disclosure',
    'encryption': 'Data Breach / Interception',
    'audit-logging': 'Lack of Accountability / Forensics',
    'access-control': 'Unauthorized Access / Privilege Escalation',
    'data-retention': 'Non-Compliance with Retention Requirements',
  };
  return threats[category] || 'Security Vulnerability';
}

function getRiskLevel(severity: string): string {
  const levels: Record<string, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    info: 'INFO',
  };
  return levels[severity] || 'MEDIUM';
}

function getMitigationStatus(finding: Finding): string {
  if (finding.fixType) {
    return 'Remediation Available (Auto-fix)';
  }
  return 'Open';
}

async function renderAssetInventoryHtml(targetPath: string): Promise<string> {
  const inventory = await generateAssetInventory(targetPath);

  if (inventory.totalAssets === 0) {
    return `
      <div class="asset-inventory-section">
        <h2>📦 Technology Asset Inventory</h2>
        <p style="color: #6b7280;">No package.json found or no dependencies detected.</p>
      </div>
    `;
  }

  const categoryIcons: Record<string, string> = {
    framework: '⚡',
    database: '🗄️',
    auth: '🔐',
    cloud: '☁️',
    payment: '💳',
    communication: '📧',
    utility: '🔧',
    other: '📦',
  };

  const categoryLabels: Record<string, string> = {
    framework: 'Frameworks',
    database: 'Databases & ORMs',
    auth: 'Authentication',
    cloud: 'Cloud & BaaS',
    payment: 'Payment Services',
    communication: 'Communication',
    utility: 'Utilities',
    other: 'Other',
  };

  // Group by category
  const byCategory = inventory.assets.reduce((acc, asset) => {
    if (!acc[asset.category]) {
      acc[asset.category] = [];
    }
    acc[asset.category].push(asset);
    return acc;
  }, {} as Record<string, TechnologyAsset[]>);

  return `
    <div class="asset-inventory-section">
      <div class="inventory-header">
        <h2>📦 Technology Asset Inventory</h2>
        <p class="inventory-subtitle">
          Software assets detected from package.json analysis
        </p>
      </div>

      <div class="inventory-stats">
        <div class="stat-box">
          <div class="stat-value">${inventory.totalAssets}</div>
          <div class="stat-label">Total Assets</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${Object.keys(byCategory).length}</div>
          <div class="stat-label">Categories</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${new Date(inventory.detectedAt).toLocaleDateString()}</div>
          <div class="stat-label">Detected</div>
        </div>
      </div>

      <div class="inventory-notice">
        <strong>📋 Note:</strong> This inventory covers software assets detected in code (package.json).
        Please complete the "Responsible Person" and "Location" fields, and add any hardware,
        infrastructure, or third-party services not detected automatically.
        <a href="#" class="export-csv-link" onclick="event.preventDefault(); exportInventoryCsv();">
          Export as CSV →
        </a>
      </div>

      <div class="inventory-table-container">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Version</th>
              <th>Type</th>
              <th>Category</th>
              <th>Provider</th>
              <th>Responsible Person</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(byCategory)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([category, assets]) => `
                <tr class="category-row">
                  <td colspan="8">
                    <strong>${categoryIcons[category]} ${categoryLabels[category]}</strong>
                  </td>
                </tr>
                ${assets.map(asset => `
                  <tr>
                    <td class="asset-id">${escapeHtml(asset.id)}</td>
                    <td class="asset-name"><code>${escapeHtml(asset.name)}</code></td>
                    <td class="asset-version">${escapeHtml(asset.version)}</td>
                    <td>${escapeHtml(asset.type)}</td>
                    <td><span class="category-badge">${escapeHtml(asset.category)}</span></td>
                    <td class="asset-provider">${escapeHtml(asset.provider)}</td>
                    <td class="editable-field">
                      <input type="text" placeholder="Enter name..." class="person-input" />
                    </td>
                    <td class="editable-field">
                      <input type="text" placeholder="e.g., AWS us-east-1" class="location-input" />
                    </td>
                  </tr>
                `).join('')}
              `).join('')}
          </tbody>
        </table>
      </div>

      <script>
        const inventoryData = ${JSON.stringify(inventory.assets)};

        function exportInventoryCsv() {
          const header = 'ID,Name,Version,Type,Category,Provider,Responsible Person,Location\\n';

          const rows = inventoryData.map((asset, idx) => {
            const personInput = document.querySelectorAll('.person-input')[idx];
            const locationInput = document.querySelectorAll('.location-input')[idx];

            return [
              asset.id,
              '"' + asset.name + '"',
              '"' + asset.version + '"',
              asset.type,
              asset.category,
              '"' + asset.provider + '"',
              '"' + (personInput?.value || '') + '"',
              '"' + (locationInput?.value || '') + '"',
            ].join(',');
          }).join('\\n');

          const csv = header + rows;
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'technology-asset-inventory.csv';
          a.click();
          URL.revokeObjectURL(url);
        }
      </script>
    </div>
  `;
}

function renderExecutiveSummaryHtml(report: Report): string {
  const criticalCount = report.summary.critical;
  const highCount = report.summary.high;
  const totalFindings = report.summary.total;

  // Determine overall status
  const overallStatus = criticalCount === 0 && highCount === 0 ? 'compliant' :
                        criticalCount === 0 && highCount <= 3 ? 'needs-attention' :
                        'non-compliant';

  const statusConfig = {
    'compliant': {
      icon: '✅',
      label: 'HIPAA Compliant',
      color: '#10b981',
      message: 'Your application demonstrates strong HIPAA compliance practices with no critical vulnerabilities detected.',
    },
    'needs-attention': {
      icon: '⚠️',
      label: 'Requires Attention',
      color: '#f59e0b',
      message: 'Your application has areas requiring attention to achieve full HIPAA compliance. Address high-severity findings promptly.',
    },
    'non-compliant': {
      icon: '❌',
      label: 'Non-Compliant',
      color: '#dc2626',
      message: 'Critical HIPAA compliance issues detected. Immediate action required to protect PHI and avoid regulatory penalties.',
    },
  };

  const status = statusConfig[overallStatus];

  // Get top priority findings (critical and high, max 5)
  const priorityFindings = report.findings
    .filter(f => f.severity === 'critical' || f.severity === 'high')
    .slice(0, 5);

  // Calculate risk exposure
  const riskLevel = criticalCount > 5 ? 'Critical' :
                    criticalCount > 0 ? 'High' :
                    highCount > 10 ? 'High' :
                    highCount > 0 ? 'Medium' : 'Low';

  const riskColor = riskLevel === 'Critical' ? '#dc2626' :
                    riskLevel === 'High' ? '#ea580c' :
                    riskLevel === 'Medium' ? '#f59e0b' : '#10b981';

  // Categorize findings
  const findingsByCategory = report.findings.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(findingsByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return `
    <div class="executive-summary-section">
      <div class="exec-header">
        <h1>Executive Summary</h1>
        <p class="exec-subtitle">HIPAA Compliance Assessment Report</p>
        <div class="exec-meta">
          <span>Generated: ${new Date(report.timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
          <span>•</span>
          <span>Scanned: ${report.scannedFiles} files</span>
          <span>•</span>
          <span>Duration: ${(report.scanDuration / 1000).toFixed(2)}s</span>
        </div>
      </div>

      <div class="exec-status-card" style="border-left-color: ${status.color}">
        <div class="exec-status-icon" style="color: ${status.color}">${status.icon}</div>
        <div class="exec-status-content">
          <h2 style="color: ${status.color}">${status.label}</h2>
          <p>${status.message}</p>
        </div>
      </div>

      <div class="exec-grid">
        <div class="exec-metric-card">
          <div class="exec-metric-label">Risk Exposure</div>
          <div class="exec-metric-value" style="color: ${riskColor}">${riskLevel}</div>
          <div class="exec-metric-desc">Overall risk level based on findings severity</div>
        </div>

        <div class="exec-metric-card">
          <div class="exec-metric-label">Total Findings</div>
          <div class="exec-metric-value">${totalFindings}</div>
          <div class="exec-metric-desc">
            <span style="color: #dc2626; font-weight: 600;">${criticalCount} critical</span>
            ${highCount > 0 ? `, <span style="color: #ea580c; font-weight: 600;">${highCount} high</span>` : ''}
          </div>
        </div>

        <div class="exec-metric-card">
          <div class="exec-metric-label">Files Analyzed</div>
          <div class="exec-metric-value">${report.scannedFiles}</div>
          <div class="exec-metric-desc">Source code files scanned for HIPAA compliance</div>
        </div>

        <div class="exec-metric-card">
          <div class="exec-metric-label">Technology Stack</div>
          <div class="exec-metric-value" style="font-size: 1.25rem;">
            ${report.stack?.frameworkDisplay || 'N/A'}
          </div>
          <div class="exec-metric-desc">
            ${report.stack?.databaseDisplay || 'Unknown DB'} + ${report.stack?.authDisplay || 'Unknown Auth'}
          </div>
        </div>
      </div>

      ${priorityFindings.length > 0 ? `
      <div class="exec-priority-section">
        <h3>🚨 Priority Action Items</h3>
        <p class="exec-priority-intro">
          The following issues require immediate attention to ensure HIPAA compliance:
        </p>
        <div class="exec-priority-list">
          ${priorityFindings.map((f, idx) => `
            <div class="exec-priority-item" style="border-left-color: ${f.severity === 'critical' ? '#dc2626' : '#ea580c'}">
              <div class="exec-priority-number">${idx + 1}</div>
              <div class="exec-priority-content">
                <div class="exec-priority-header">
                  <span class="exec-priority-badge" style="background: ${f.severity === 'critical' ? '#dc2626' : '#ea580c'}">
                    ${f.severity.toUpperCase()}
                  </span>
                  <span class="exec-priority-title">${escapeHtml(f.title)}</span>
                </div>
                <div class="exec-priority-desc">${escapeHtml(f.description)}</div>
                <div class="exec-priority-action">
                  <strong>Action:</strong> ${escapeHtml(f.recommendation)}
                </div>
                <div class="exec-priority-ref">
                  <span class="exec-file-ref">${escapeHtml(f.file)}${f.line ? ':' + f.line : ''}</span>
                  ${f.hipaaReference ? `<span class="exec-hipaa-ref">${escapeHtml(f.hipaaReference)}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${topCategories.length > 0 ? `
      <div class="exec-categories-section">
        <h3>📊 Top Affected Areas</h3>
        <div class="exec-category-bars">
          ${topCategories.map(([category, count]) => {
            const categoryLabel = formatCategory(category);
            const percentage = Math.round((count / totalFindings) * 100);
            return `
              <div class="exec-category-item">
                <div class="exec-category-header">
                  <span class="exec-category-name">${escapeHtml(categoryLabel)}</span>
                  <span class="exec-category-count">${count} finding${count !== 1 ? 's' : ''} (${percentage}%)</span>
                </div>
                <div class="exec-category-bar-bg">
                  <div class="exec-category-bar" style="width: ${percentage}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <div class="exec-recommendations">
        <h3>💡 Recommended Next Steps</h3>
        <ol class="exec-recommendations-list">
          ${criticalCount > 0 ? `
            <li>
              <strong>Immediate (24-48 hours):</strong> Address all ${criticalCount} critical finding${criticalCount !== 1 ? 's' : ''}
              that could lead to PHI exposure or regulatory violations.
            </li>
          ` : ''}
          ${highCount > 0 ? `
            <li>
              <strong>Short-term (1-2 weeks):</strong> Resolve ${highCount} high-severity issue${highCount !== 1 ? 's' : ''}
              to strengthen security posture and reduce audit risk.
            </li>
          ` : ''}
          <li>
            <strong>Review BAAs:</strong> Ensure Business Associate Agreements are in place for all external service providers
            identified in the ePHI Data Flow Map section.
          </li>
          <li>
            <strong>Document remediation:</strong> Track all fixes and maintain audit logs for compliance documentation.
          </li>
          <li>
            <strong>Schedule regular scans:</strong> Run vlayer scans weekly to monitor ongoing compliance and catch new issues early.
          </li>
        </ol>
      </div>

      ${criticalCount === 0 && highCount === 0 ? `
      <div class="exec-congrats">
        <div class="exec-congrats-icon">🎉</div>
        <div class="exec-congrats-content">
          <h3>Excellent Work!</h3>
          <p>
            No critical or high-severity issues detected. Continue monitoring with regular scans
            and stay current with HIPAA regulation updates.
          </p>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

function renderBackupRecoveryGuideHtml(stack: StackInfo): string {
  let guideContent = '';
  let dbType = 'unknown';
  let dbDisplay = stack?.databaseDisplay || 'Unknown';

  // Detect database type from stack
  const database = stack?.database || 'unknown';

  if (database.includes('supabase')) {
    dbType = 'supabase';
    guideContent = `
      <div class="backup-guide-card">
        <div class="backup-guide-header">
          <span class="backup-guide-icon">🗄️</span>
          <h4>Supabase Database Backup Configuration</h4>
        </div>
        <div class="backup-guide-content">
          <div class="backup-step">
            <div class="backup-step-number">1</div>
            <div class="backup-step-content">
              <strong>Enable Point-in-Time Recovery (PITR)</strong>
              <p>Navigate to Dashboard → Settings → Database → Enable PITR</p>
              <div class="backup-code-block">
                <code>PITR allows you to restore your database to any point within the last 7 days</code>
              </div>
            </div>
          </div>

          <div class="backup-step">
            <div class="backup-step-number">2</div>
            <div class="backup-step-content">
              <strong>Configure Daily Automated Backups</strong>
              <p>Supabase Pro+ plans include daily backups. Verify in your project settings.</p>
              <ul class="backup-checklist">
                <li>✓ Backup retention: 7-30 days (depending on plan)</li>
                <li>✓ Automated daily snapshots</li>
                <li>✓ Geographic redundancy enabled</li>
              </ul>
            </div>
          </div>

          <div class="backup-step">
            <div class="backup-step-number">3</div>
            <div class="backup-step-content">
              <strong>Test Restore Procedure (Quarterly)</strong>
              <p>Regularly verify backup integrity by performing test restores:</p>
              <div class="backup-code-block">
                <pre><code># Create test restore
# Dashboard → Database → Backups → Restore to new project
# Verify data integrity and application functionality</code></pre>
              </div>
            </div>
          </div>

          <div class="backup-step">
            <div class="backup-step-number">4</div>
            <div class="backup-step-content">
              <strong>Additional Manual Backup (Optional)</strong>
              <div class="backup-code-block">
                <pre><code># Using pg_dump for additional backup
pg_dump "postgresql://[user]:[password]@[host]:[port]/[database]" > backup_\$(date +%Y%m%d).sql

# Upload to secure offsite storage
aws s3 cp backup_\$(date +%Y%m%d).sql s3://your-backup-bucket/</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (database.includes('prisma') || database.includes('postgres')) {
    dbType = 'postgresql';
    guideContent = `
      <div class="backup-guide-card">
        <div class="backup-guide-header">
          <span class="backup-guide-icon">🐘</span>
          <h4>PostgreSQL + Prisma Backup Configuration</h4>
        </div>
        <div class="backup-guide-content">
          <div class="backup-step">
            <div class="backup-step-number">1</div>
            <div class="backup-step-content">
              <strong>Create Backup Script</strong>
              <p>Save this script as <code>backup-db.sh</code> in your project root:</p>
              <div class="backup-code-block">
                <pre><code>#!/bin/bash
# PostgreSQL Backup Script for HIPAA Compliance

BACKUP_DIR="/path/to/backups"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="\${BACKUP_DIR}/backup_\${TIMESTAMP}.sql"

# Create backup directory if not exists
mkdir -p \$BACKUP_DIR

# Perform backup
pg_dump \$DATABASE_URL > \$BACKUP_FILE

# Compress backup
gzip \$BACKUP_FILE

# Upload to offsite storage (S3 example)
aws s3 cp \${BACKUP_FILE}.gz s3://your-backup-bucket/postgresql/

# Keep only last 30 days of local backups
find \$BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: \${BACKUP_FILE}.gz"</code></pre>
              </div>
            </div>
          </div>

          <div class="backup-step">
            <div class="backup-step-number">2</div>
            <div class="backup-step-content">
              <strong>Schedule via Cron (Daily 2 AM)</strong>
              <div class="backup-code-block">
                <pre><code># Add to crontab: crontab -e
0 2 * * * /path/to/backup-db.sh >> /var/log/backup.log 2>&1</code></pre>
              </div>
            </div>
          </div>

          <div class="backup-step">
            <div class="backup-step-number">3</div>
            <div class="backup-step-content">
              <strong>Test Restore Monthly</strong>
              <div class="backup-code-block">
                <pre><code># Download backup from S3
aws s3 cp s3://your-backup-bucket/postgresql/backup_YYYYMMDD.sql.gz .

# Decompress
gunzip backup_YYYYMMDD.sql.gz

# Restore to test database
psql \$TEST_DATABASE_URL < backup_YYYYMMDD.sql

# Verify data integrity
psql \$TEST_DATABASE_URL -c "SELECT COUNT(*) FROM patients;"</code></pre>
              </div>
            </div>
          </div>

          <div class="backup-step">
            <div class="backup-step-number">4</div>
            <div class="backup-step-content">
              <strong>Offsite Storage Options</strong>
              <ul class="backup-checklist">
                <li>✓ AWS S3 with versioning and encryption</li>
                <li>✓ Google Cloud Storage with lifecycle policies</li>
                <li>✓ Azure Blob Storage with geo-redundancy</li>
                <li>✓ Ensure BAA in place with storage provider</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (database.includes('mongo')) {
    dbType = 'mongodb';
    guideContent = `
      <div class="backup-guide-card">
        <div class="backup-guide-header">
          <span class="backup-guide-icon">🍃</span>
          <h4>MongoDB + Mongoose Backup Configuration</h4>
        </div>
        <div class="backup-guide-content">
          <div class="backup-step">
            <div class="backup-step-number">1</div>
            <div class="backup-step-content">
              <strong>Using MongoDB Atlas (Recommended)</strong>
              <p>Enable automated backups in Atlas dashboard:</p>
              <ul class="backup-checklist">
                <li>✓ Navigate to Project → Backup tab</li>
                <li>✓ Enable Continuous Cloud Backup</li>
                <li>✓ Configure snapshot schedule (daily recommended)</li>
                <li>✓ Set retention policy (30 days minimum for HIPAA)</li>
                <li>✓ Enable Point-in-Time Restore</li>
              </ul>
            </div>
          </div>

          <div class="backup-step">
            <div class="backup-step-number">2</div>
            <div class="backup-step-content">
              <strong>Manual Backup with mongodump</strong>
              <p>Create backup script for self-hosted MongoDB:</p>
              <div class="backup-code-block">
                <pre><code>#!/bin/bash
# MongoDB Backup Script

TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups"
BACKUP_NAME="mongodb_backup_\${TIMESTAMP}"

# Perform backup
mongodump --uri="\$MONGODB_URI" --out=\${BACKUP_DIR}/\${BACKUP_NAME}

# Compress
tar -czf \${BACKUP_DIR}/\${BACKUP_NAME}.tar.gz -C \${BACKUP_DIR} \${BACKUP_NAME}
rm -rf \${BACKUP_DIR}/\${BACKUP_NAME}

# Upload to S3
aws s3 cp \${BACKUP_DIR}/\${BACKUP_NAME}.tar.gz s3://your-backup-bucket/mongodb/

# Cleanup old local backups (keep 7 days)
find \$BACKUP_DIR -name "mongodb_backup_*.tar.gz" -mtime +7 -delete</code></pre>
              </div>
            </div>
          </div>

          <div class="backup-step">
            <div class="backup-step-number">3</div>
            <div class="backup-step-content">
              <strong>Test Restore Quarterly</strong>
              <div class="backup-code-block">
                <pre><code># Download and extract backup
aws s3 cp s3://your-backup-bucket/mongodb/mongodb_backup_YYYYMMDD.tar.gz .
tar -xzf mongodb_backup_YYYYMMDD.tar.gz

# Restore to test database
mongorestore --uri="\$TEST_MONGODB_URI" mongodb_backup_YYYYMMDD/

# Verify collections
mongo \$TEST_MONGODB_URI --eval "db.getCollectionNames()"</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    dbType = 'none';
    guideContent = `
      <div class="backup-guide-card backup-guide-warning">
        <div class="backup-guide-header">
          <span class="backup-guide-icon">⚠️</span>
          <h4>No Database Detected</h4>
        </div>
        <div class="backup-guide-content">
          <p style="margin-bottom: 1rem;">
            No database connection was detected in your codebase during the scan.
          </p>
          <div class="backup-step">
            <div class="backup-step-content">
              <strong>If you are using an external database service:</strong>
              <ul class="backup-checklist">
                <li>✓ Configure backup per your database provider's documentation</li>
                <li>✓ Ensure automated daily backups are enabled</li>
                <li>✓ Verify backup retention meets HIPAA requirements (30+ days recommended)</li>
                <li>✓ Test restore procedures quarterly</li>
                <li>✓ Document backup and restore procedures</li>
                <li>✓ Ensure Business Associate Agreement (BAA) with provider</li>
              </ul>
            </div>
          </div>
          <div class="backup-step">
            <div class="backup-step-content">
              <strong>Common managed database providers:</strong>
              <ul style="margin-top: 0.5rem;">
                <li><strong>AWS RDS:</strong> Automated backups, point-in-time recovery</li>
                <li><strong>Google Cloud SQL:</strong> Automated backups, on-demand snapshots</li>
                <li><strong>Azure SQL:</strong> Automated backups with geo-redundancy</li>
                <li><strong>MongoDB Atlas:</strong> Continuous cloud backup</li>
                <li><strong>PlanetScale:</strong> Daily automated backups</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="backup-recovery-section">
      <div class="backup-header">
        <h2>💾 Backup & Recovery Guide</h2>
        <p class="backup-subtitle">
          Database backup and disaster recovery procedures for HIPAA compliance
        </p>
      </div>

      <div class="backup-hipaa-notice">
        <strong>⚖️ HIPAA NPRM Requirement:</strong> The HIPAA Notice of Proposed Rulemaking requires
        organizations to maintain the ability to restore ePHI within <strong>72 hours</strong> of a disaster.
        This guide covers code-level configuration. You must verify actual backup execution,
        offsite storage, and restore testing independently through operational procedures.
      </div>

      ${guideContent}

      <div class="backup-verification-checklist">
        <h3>✅ Backup Verification Checklist</h3>
        <div class="backup-checklist-grid">
          <div class="backup-checklist-item">
            <input type="checkbox" id="backup-enabled" />
            <label for="backup-enabled">
              <strong>Automated backups enabled</strong>
              <span>Verify backups run daily without manual intervention</span>
            </label>
          </div>
          <div class="backup-checklist-item">
            <input type="checkbox" id="backup-offsite" />
            <label for="backup-offsite">
              <strong>Offsite storage configured</strong>
              <span>Backups stored in geographically separate location</span>
            </label>
          </div>
          <div class="backup-checklist-item">
            <input type="checkbox" id="backup-encrypted" />
            <label for="backup-encrypted">
              <strong>Backup encryption enabled</strong>
              <span>At-rest encryption for all backup files</span>
            </label>
          </div>
          <div class="backup-checklist-item">
            <input type="checkbox" id="backup-tested" />
            <label for="backup-tested">
              <strong>Restore procedure tested</strong>
              <span>Last restore test: [Document date]</span>
            </label>
          </div>
          <div class="backup-checklist-item">
            <input type="checkbox" id="backup-retention" />
            <label for="backup-retention">
              <strong>Retention policy configured</strong>
              <span>Minimum 30 days, aligned with business requirements</span>
            </label>
          </div>
          <div class="backup-checklist-item">
            <input type="checkbox" id="backup-monitoring" />
            <label for="backup-monitoring">
              <strong>Backup monitoring/alerts</strong>
              <span>Notifications for backup failures</span>
            </label>
          </div>
          <div class="backup-checklist-item">
            <input type="checkbox" id="backup-baa" />
            <label for="backup-baa">
              <strong>BAA with storage provider</strong>
              <span>Business Associate Agreement signed and current</span>
            </label>
          </div>
          <div class="backup-checklist-item">
            <input type="checkbox" id="backup-documented" />
            <label for="backup-documented">
              <strong>Procedures documented</strong>
              <span>Backup and restore procedures in runbook</span>
            </label>
          </div>
        </div>
      </div>

      <div class="backup-recovery-timeline">
        <h3>⏱️ Recovery Time Objectives (RTO)</h3>
        <div class="rto-grid">
          <div class="rto-item rto-critical">
            <div class="rto-label">Critical Data</div>
            <div class="rto-time">&lt; 4 hours</div>
            <div class="rto-desc">Patient records, active appointments</div>
          </div>
          <div class="rto-item rto-important">
            <div class="rto-label">Important Data</div>
            <div class="rto-time">&lt; 24 hours</div>
            <div class="rto-desc">Billing, historical records</div>
          </div>
          <div class="rto-item rto-standard">
            <div class="rto-label">Standard Data</div>
            <div class="rto-time">&lt; 72 hours</div>
            <div class="rto-desc">Analytics, logs, reports (HIPAA max)</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderIncidentResponsePlanHtml(criticalFindings: number, highFindings: number): string {
  const hasActiveIncident = criticalFindings > 0;
  const riskLevel = criticalFindings > 0 ? 'HIGH' : highFindings > 0 ? 'MEDIUM' : 'LOW';

  return `
    <div class="incident-response-section">
      <div class="incident-header">
        <h2>🚨 Incident Response Plan</h2>
        <p class="incident-subtitle">
          HIPAA-compliant incident response and breach notification procedures
        </p>
      </div>

      ${hasActiveIncident ? `
      <div class="incident-alert">
        <div class="incident-alert-icon">⚠️</div>
        <div class="incident-alert-content">
          <strong>Active Security Issues Detected</strong>
          <p>
            ${criticalFindings} critical issue${criticalFindings !== 1 ? 's' : ''} detected that may constitute a security incident.
            Review findings immediately and follow incident response procedures below.
          </p>
        </div>
      </div>
      ` : ''}

      <div class="incident-hipaa-notice">
        <strong>📋 HIPAA Breach Notification Rule:</strong> If a breach affects 500 or more individuals,
        you must notify HHS within <strong>60 days</strong>. For breaches affecting fewer than 500 individuals,
        notification must be made within 60 days of discovery. Maintain detailed documentation of all incidents.
      </div>

      <div class="incident-team-section">
        <h3>👥 Incident Response Team (IRT)</h3>
        <div class="incident-team-table">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Responsibilities</th>
                <th>Contact Person</th>
                <th>Phone/Email</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Incident Commander</strong></td>
                <td>Overall incident coordination, decision-making authority, external communication</td>
                <td class="editable-cell"><input type="text" placeholder="Name" class="contact-input" /></td>
                <td class="editable-cell"><input type="text" placeholder="Contact" class="contact-input" /></td>
              </tr>
              <tr>
                <td><strong>Security Lead</strong></td>
                <td>Technical investigation, containment actions, forensic analysis</td>
                <td class="editable-cell"><input type="text" placeholder="Name" class="contact-input" /></td>
                <td class="editable-cell"><input type="text" placeholder="Contact" class="contact-input" /></td>
              </tr>
              <tr>
                <td><strong>Compliance Officer</strong></td>
                <td>HIPAA breach assessment, regulatory notifications, documentation</td>
                <td class="editable-cell"><input type="text" placeholder="Name" class="contact-input" /></td>
                <td class="editable-cell"><input type="text" placeholder="Contact" class="contact-input" /></td>
              </tr>
              <tr>
                <td><strong>Legal Counsel</strong></td>
                <td>Legal guidance, law enforcement coordination, liability assessment</td>
                <td class="editable-cell"><input type="text" placeholder="Name" class="contact-input" /></td>
                <td class="editable-cell"><input type="text" placeholder="Contact" class="contact-input" /></td>
              </tr>
              <tr>
                <td><strong>Communications Lead</strong></td>
                <td>Patient notifications, media relations, stakeholder communication</td>
                <td class="editable-cell"><input type="text" placeholder="Name" class="contact-input" /></td>
                <td class="editable-cell"><input type="text" placeholder="Contact" class="contact-input" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="incident-severity-section">
        <h3>📊 Incident Severity Levels</h3>
        <div class="severity-grid">
          <div class="severity-card severity-critical">
            <div class="severity-badge">P0 - CRITICAL</div>
            <div class="severity-examples">
              <strong>Examples:</strong>
              <ul>
                <li>PHI exposed to unauthorized parties</li>
                <li>Ransomware affecting production systems</li>
                <li>Active data breach in progress</li>
                <li>Complete system compromise</li>
              </ul>
            </div>
            <div class="severity-response">
              <strong>Response Time:</strong> Immediate (within 15 minutes)
            </div>
          </div>

          <div class="severity-card severity-high">
            <div class="severity-badge">P1 - HIGH</div>
            <div class="severity-examples">
              <strong>Examples:</strong>
              <ul>
                <li>Unauthorized access attempt detected</li>
                <li>Malware on non-production systems</li>
                <li>Potential PHI exposure (unconfirmed)</li>
                <li>DDoS attack affecting availability</li>
              </ul>
            </div>
            <div class="severity-response">
              <strong>Response Time:</strong> Within 1 hour
            </div>
          </div>

          <div class="severity-card severity-medium">
            <div class="severity-badge">P2 - MEDIUM</div>
            <div class="severity-examples">
              <strong>Examples:</strong>
              <ul>
                <li>Suspicious login activity</li>
                <li>Policy violation detected</li>
                <li>Non-PHI data anomaly</li>
                <li>Failed security control</li>
              </ul>
            </div>
            <div class="severity-response">
              <strong>Response Time:</strong> Within 4 hours
            </div>
          </div>

          <div class="severity-card severity-low">
            <div class="severity-badge">P3 - LOW</div>
            <div class="severity-examples">
              <strong>Examples:</strong>
              <ul>
                <li>Minor configuration issue</li>
                <li>Informational security alert</li>
                <li>Routine security event</li>
                <li>Non-urgent vulnerability</li>
              </ul>
            </div>
            <div class="severity-response">
              <strong>Response Time:</strong> Within 24 hours
            </div>
          </div>
        </div>
      </div>

      <div class="incident-phases-section">
        <h3>🔄 Incident Response Phases</h3>

        <div class="phase-card">
          <div class="phase-number">1</div>
          <div class="phase-content">
            <h4>Detection & Analysis</h4>
            <div class="phase-checklist">
              <div class="phase-item">
                <strong>⚡ Immediate Actions (0-15 min):</strong>
                <ul>
                  <li>Document initial detection time and source</li>
                  <li>Assess severity using criteria above</li>
                  <li>Alert Incident Commander and Security Lead</li>
                  <li>Begin incident log documentation</li>
                </ul>
              </div>
              <div class="phase-item">
                <strong>🔍 Investigation (15 min - 2 hours):</strong>
                <ul>
                  <li>Determine scope: systems affected, data involved</li>
                  <li>Identify if PHI is involved or at risk</li>
                  <li>Collect initial evidence (logs, screenshots, network captures)</li>
                  <li>Determine root cause (preliminary)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="phase-card">
          <div class="phase-number">2</div>
          <div class="phase-content">
            <h4>Containment</h4>
            <div class="phase-checklist">
              <div class="phase-item">
                <strong>🛡️ Short-term Containment:</strong>
                <ul>
                  <li>Isolate affected systems from network</li>
                  <li>Disable compromised user accounts</li>
                  <li>Block malicious IPs/domains at firewall</li>
                  <li>Preserve evidence before taking systems offline</li>
                </ul>
              </div>
              <div class="phase-item">
                <strong>🔒 Long-term Containment:</strong>
                <ul>
                  <li>Apply temporary security patches</li>
                  <li>Implement additional monitoring</li>
                  <li>Establish secure backup systems</li>
                  <li>Document all containment actions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="phase-card">
          <div class="phase-number">3</div>
          <div class="phase-content">
            <h4>Eradication</h4>
            <div class="phase-checklist">
              <ul>
                <li>Remove malware from all affected systems</li>
                <li>Close security vulnerabilities exploited</li>
                <li>Reset all compromised credentials</li>
                <li>Apply permanent security patches</li>
                <li>Verify threat has been completely removed</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="phase-card">
          <div class="phase-number">4</div>
          <div class="phase-content">
            <h4>Recovery</h4>
            <div class="phase-checklist">
              <ul>
                <li>Restore systems from clean backups</li>
                <li>Verify system integrity before reconnecting</li>
                <li>Gradually restore services to production</li>
                <li>Monitor closely for signs of re-infection</li>
                <li>Validate business operations are normal</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="phase-card">
          <div class="phase-number">5</div>
          <div class="phase-content">
            <h4>Post-Incident Activity</h4>
            <div class="phase-checklist">
              <ul>
                <li>Conduct post-incident review meeting</li>
                <li>Document lessons learned</li>
                <li>Update incident response procedures</li>
                <li>Implement preventive measures</li>
                <li>Complete HIPAA breach determination</li>
                <li>File required regulatory notifications</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="incident-breach-timeline">
        <h3>⏰ HIPAA Breach Notification Timeline</h3>
        <div class="timeline-container">
          <div class="timeline-item">
            <div class="timeline-marker timeline-discovery"></div>
            <div class="timeline-content">
              <strong>Day 0: Discovery</strong>
              <p>Incident discovered. Begin investigation and documentation.</p>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-marker timeline-assessment"></div>
            <div class="timeline-content">
              <strong>Days 1-5: Assessment</strong>
              <p>Complete breach risk assessment. Determine if PHI compromised.</p>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-marker timeline-notification"></div>
            <div class="timeline-content">
              <strong>Within 60 Days: Notifications</strong>
              <p>
                • Notify affected individuals (written notice)<br/>
                • Notify HHS if 500+ individuals affected<br/>
                • Notify media if 500+ individuals in same state
              </p>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-marker timeline-documentation"></div>
            <div class="timeline-content">
              <strong>Ongoing: Documentation</strong>
              <p>Maintain records for 6 years minimum per HIPAA requirements.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="incident-contacts-section">
        <h3>📞 Critical Contacts</h3>
        <div class="contacts-grid">
          <div class="contact-card">
            <div class="contact-title">HHS Office for Civil Rights</div>
            <div class="contact-info">
              <div>Website: <a href="https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf" target="_blank">ocrportal.hhs.gov</a></div>
              <div>Phone: 1-800-368-1019</div>
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-title">FBI Cyber Division</div>
            <div class="contact-info">
              <div>Website: <a href="https://www.fbi.gov/contact-us" target="_blank">fbi.gov/contact-us</a></div>
              <div>IC3: <a href="https://www.ic3.gov" target="_blank">ic3.gov</a></div>
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-title">Business Associates</div>
            <div class="contact-info editable-contact">
              <input type="text" placeholder="Primary BA Contact" class="contact-input-wide" />
              <input type="text" placeholder="Contact Info" class="contact-input-wide" />
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-title">Cyber Insurance Provider</div>
            <div class="contact-info editable-contact">
              <input type="text" placeholder="Insurance Company" class="contact-input-wide" />
              <input type="text" placeholder="Policy # / Phone" class="contact-input-wide" />
            </div>
          </div>
        </div>
      </div>

      <div class="incident-log-template">
        <h3>📝 Incident Log Template</h3>
        <p class="template-note">Use this template to document security incidents. Maintain logs for 6 years minimum.</p>
        <div class="log-template-box">
          <div class="log-field">
            <strong>Incident ID:</strong> <span class="log-placeholder">[AUTO-GENERATED or YYYY-MM-DD-###]</span>
          </div>
          <div class="log-field">
            <strong>Date/Time Discovered:</strong> <span class="log-placeholder">[YYYY-MM-DD HH:MM UTC]</span>
          </div>
          <div class="log-field">
            <strong>Discovered By:</strong> <span class="log-placeholder">[Name, Role]</span>
          </div>
          <div class="log-field">
            <strong>Severity Level:</strong> <span class="log-placeholder">[P0/P1/P2/P3]</span>
          </div>
          <div class="log-field">
            <strong>Systems Affected:</strong> <span class="log-placeholder">[List all systems, applications, databases]</span>
          </div>
          <div class="log-field">
            <strong>PHI Involved:</strong> <span class="log-placeholder">[YES/NO/UNKNOWN] - If yes, describe data types and # of individuals</span>
          </div>
          <div class="log-field">
            <strong>Initial Description:</strong> <span class="log-placeholder">[What happened? How was it detected?]</span>
          </div>
          <div class="log-field">
            <strong>Containment Actions:</strong> <span class="log-placeholder">[Actions taken and timestamps]</span>
          </div>
          <div class="log-field">
            <strong>Root Cause:</strong> <span class="log-placeholder">[Technical cause, vulnerability exploited]</span>
          </div>
          <div class="log-field">
            <strong>Resolution:</strong> <span class="log-placeholder">[How was incident resolved?]</span>
          </div>
          <div class="log-field">
            <strong>Breach Determination:</strong> <span class="log-placeholder">[BREACH / NOT A BREACH - Justification]</span>
          </div>
          <div class="log-field">
            <strong>Notifications Sent:</strong> <span class="log-placeholder">[HHS, Individuals, Media - with dates]</span>
          </div>
        </div>
      </div>

      <div class="incident-testing-section">
        <h3>🧪 Plan Testing & Drills</h3>
        <div class="testing-recommendations">
          <div class="testing-item">
            <div class="testing-frequency">Quarterly</div>
            <div class="testing-activity">
              <strong>Tabletop Exercises</strong>
              <p>Simulate breach scenarios with IRT. Review and update procedures.</p>
            </div>
          </div>
          <div class="testing-item">
            <div class="testing-frequency">Bi-Annual</div>
            <div class="testing-activity">
              <strong>Technical Drills</strong>
              <p>Test actual incident response tools, backup restores, and communication channels.</p>
            </div>
          </div>
          <div class="testing-item">
            <div class="testing-frequency">Annual</div>
            <div class="testing-activity">
              <strong>Full-Scale Simulation</strong>
              <p>End-to-end breach simulation with all stakeholders including executives and legal.</p>
            </div>
          </div>
          <div class="testing-item">
            <div class="testing-frequency">Annual</div>
            <div class="testing-activity">
              <strong>Plan Review & Update</strong>
              <p>Review incident response plan against current threats and regulations.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderScanComparisonHtml(comparison: ScanComparison | null | undefined): string {
  if (!comparison || !comparison.previousScan) {
    return '';
  }

  const { previousScan, scoreChange, severityChanges, newIssues, resolvedIssues } = comparison;

  const scoreArrow = scoreChange > 0 ? '↑' : scoreChange < 0 ? '↓' : '→';
  const scoreColor = scoreChange > 0 ? '#10b981' : scoreChange < 0 ? '#dc2626' : '#6b7280';
  const scoreSign = scoreChange > 0 ? '+' : '';

  const formatChange = (change: number, inverted: boolean = false): { arrow: string; color: string; sign: string } => {
    // For severity counts, a decrease is good (inverted = true)
    const isPositive = inverted ? change < 0 : change > 0;
    const isNegative = inverted ? change > 0 : change < 0;

    return {
      arrow: isPositive ? '↑' : isNegative ? '↓' : '→',
      color: isPositive ? '#10b981' : isNegative ? '#dc2626' : '#6b7280',
      sign: change > 0 ? '+' : '',
    };
  };

  const criticalChange = formatChange(severityChanges.critical, true);
  const highChange = formatChange(severityChanges.high, true);
  const mediumChange = formatChange(severityChanges.medium, true);
  const lowChange = formatChange(severityChanges.low, true);

  // Format previous scan date
  const prevDate = new Date(previousScan.timestamp);
  const formattedDate = prevDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <div class="comparison-section" style="margin: 3rem 0; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
        <span style="font-size: 2.5rem;">📊</span>
        <div>
          <h2 style="margin: 0; color: #111827; font-size: 1.8rem;">Comparison with Previous Scan</h2>
          <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.95rem;">
            Previous scan: ${escapeHtml(formattedDate)}
          </p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
        <!-- Score Comparison -->
        <div style="background: linear-gradient(135deg, ${scoreChange >= 0 ? '#f0fdf4' : '#fef2f2'} 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid ${scoreChange >= 0 ? '#bbf7d0' : '#fecaca'}; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
          <div style="color: #6b7280; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem;">Compliance Score</div>
          <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="color: #9ca3af; font-size: 1.2rem; font-weight: 600;">${previousScan.complianceScore}</span>
            <span style="color: #6b7280; font-size: 1rem;">→</span>
            <span style="color: ${scoreColor}; font-size: 2rem; font-weight: bold;">${previousScan.complianceScore + scoreChange}</span>
          </div>
          <div style="color: ${scoreColor}; font-size: 1rem; font-weight: 600;">
            (${scoreSign}${scoreChange}) ${scoreArrow}
          </div>
        </div>

        <!-- Critical Comparison -->
        <div style="background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid #fee2e2; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
          <div style="color: #dc2626; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem;">Critical Issues</div>
          <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="color: #9ca3af; font-size: 1.2rem; font-weight: 600;">${previousScan.severity.critical}</span>
            <span style="color: #6b7280; font-size: 1rem;">→</span>
            <span style="color: #dc2626; font-size: 2rem; font-weight: bold;">${previousScan.severity.critical + severityChanges.critical}</span>
          </div>
          <div style="color: ${criticalChange.color}; font-size: 1rem; font-weight: 600;">
            (${criticalChange.sign}${severityChanges.critical}) ${criticalChange.arrow}
          </div>
        </div>

        <!-- High Comparison -->
        <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid #fed7aa; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
          <div style="color: #ea580c; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem;">High Issues</div>
          <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="color: #9ca3af; font-size: 1.2rem; font-weight: 600;">${previousScan.severity.high}</span>
            <span style="color: #6b7280; font-size: 1rem;">→</span>
            <span style="color: #ea580c; font-size: 2rem; font-weight: bold;">${previousScan.severity.high + severityChanges.high}</span>
          </div>
          <div style="color: ${highChange.color}; font-size: 1rem; font-weight: 600;">
            (${highChange.sign}${severityChanges.high}) ${highChange.arrow}
          </div>
        </div>

        <!-- Medium Comparison -->
        <div style="background: linear-gradient(135deg, #fefce8 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid #fef08a; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
          <div style="color: #ca8a04; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem;">Medium Issues</div>
          <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="color: #9ca3af; font-size: 1.2rem; font-weight: 600;">${previousScan.severity.medium}</span>
            <span style="color: #6b7280; font-size: 1rem;">→</span>
            <span style="color: #ca8a04; font-size: 2rem; font-weight: bold;">${previousScan.severity.medium + severityChanges.medium}</span>
          </div>
          <div style="color: ${mediumChange.color}; font-size: 1rem; font-weight: 600;">
            (${mediumChange.sign}${severityChanges.medium}) ${mediumChange.arrow}
          </div>
        </div>
      </div>

      ${newIssues.length > 0 || resolvedIssues.length > 0 ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
          ${newIssues.length > 0 ? `
            <div style="background: #fef2f2; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #dc2626;">
              <h3 style="margin: 0 0 1rem 0; color: #991b1b; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>⚠️</span> New Issues (${newIssues.length})
              </h3>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${newIssues.slice(0, 10).map(id => `
                  <code style="background: white; color: #991b1b; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-family: 'SF Mono', Monaco, monospace;">
                    ${escapeHtml(id)}
                  </code>
                `).join('')}
                ${newIssues.length > 10 ? `<span style="color: #7f1d1d; font-size: 0.9rem;">... and ${newIssues.length - 10} more</span>` : ''}
              </div>
            </div>
          ` : ''}

          ${resolvedIssues.length > 0 ? `
            <div style="background: #f0fdf4; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #10b981;">
              <h3 style="margin: 0 0 1rem 0; color: #065f46; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>✅</span> Resolved Issues (${resolvedIssues.length})
              </h3>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${resolvedIssues.slice(0, 10).map(id => `
                  <code style="background: white; color: #065f46; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-family: 'SF Mono', Monaco, monospace;">
                    ${escapeHtml(id)}
                  </code>
                `).join('')}
                ${resolvedIssues.length > 10 ? `<span style="color: #047857; font-size: 0.9rem;">... and ${resolvedIssues.length - 10} more</span>` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      ` : `
        <div style="background: #eff6ff; padding: 1.5rem; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #1e40af; font-weight: 500;">
            No new issues appeared and no issues were resolved since the last scan.
          </p>
        </div>
      `}
    </div>
  `;
}

function renderDependencyVulnerabilitiesHtml(vulnerabilities: DependencyVulnerability[]): string {
  if (!vulnerabilities || vulnerabilities.length === 0) {
    return '';
  }

  const vulnCounts = {
    critical: vulnerabilities.filter(v => v.severity === 'critical').length,
    high: vulnerabilities.filter(v => v.severity === 'high').length,
    moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
    low: vulnerabilities.filter(v => v.severity === 'low').length,
  };

  const severityColors = {
    critical: '#dc2626',
    high: '#ea580c',
    moderate: '#ca8a04',
    low: '#2563eb',
    info: '#6b7280',
  };

  return `
    <div class="vulnerability-section" style="margin: 3rem 0; padding: 2.5rem; background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
        <span style="font-size: 2.5rem;">📦</span>
        <div>
          <h2 style="margin: 0; color: #111827; font-size: 1.8rem;">Dependency Vulnerabilities</h2>
          <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.95rem;">
            Security vulnerabilities detected in project dependencies via <code>npm audit</code>
          </p>
        </div>
      </div>

      ${vulnCounts.critical > 0 || vulnCounts.high > 0 ? `
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.5rem;">⚠️</span>
            <strong style="color: #991b1b; font-size: 1.1rem;">Action Required</strong>
          </div>
          <p style="color: #7f1d1d; margin: 0;">
            ${vulnCounts.critical > 0 ? `${vulnCounts.critical} critical` : ''}${vulnCounts.critical > 0 && vulnCounts.high > 0 ? ' and ' : ''}${vulnCounts.high > 0 ? `${vulnCounts.high} high` : ''}
            severity vulnerabilities detected. Update affected packages immediately.
          </p>
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
        <div style="background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid #fee2e2; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.1);">
          <div style="color: #dc2626; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem;">Critical</div>
          <div style="color: #dc2626; font-size: 2.5rem; font-weight: bold; line-height: 1;">${vulnCounts.critical}</div>
        </div>
        <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid #fed7aa; box-shadow: 0 2px 4px rgba(234, 88, 12, 0.1);">
          <div style="color: #ea580c; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem;">High</div>
          <div style="color: #ea580c; font-size: 2.5rem; font-weight: bold; line-height: 1;">${vulnCounts.high}</div>
        </div>
        <div style="background: linear-gradient(135deg, #fefce8 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid #fef08a; box-shadow: 0 2px 4px rgba(202, 138, 4, 0.1);">
          <div style="color: #ca8a04; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem;">Moderate</div>
          <div style="color: #ca8a04; font-size: 2.5rem; font-weight: bold; line-height: 1;">${vulnCounts.moderate}</div>
        </div>
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%); padding: 1.5rem; border-radius: 12px; border: 1px solid #dbeafe; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);">
          <div style="color: #2563eb; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 0.5rem;">Low</div>
          <div style="color: #2563eb; font-size: 2.5rem; font-weight: bold; line-height: 1;">${vulnCounts.low}</div>
        </div>
      </div>

      <h3 style="color: #111827; margin: 2rem 0 1.5rem 0; font-size: 1.3rem;">Affected Packages</h3>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${vulnerabilities.map(vuln => `
          <div style="background: #f9fafb; padding: 1.5rem; border-radius: 8px; border-left: 4px solid ${severityColors[vuln.severity]};">
            <div style="display: flex; justify-content: between; align-items: start; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                  <span style="padding: 0.25rem 0.6rem; border-radius: 4px; color: white; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; background: ${severityColors[vuln.severity]};">
                    ${vuln.severity}
                  </span>
                  <code style="font-family: 'SF Mono', Monaco, monospace; font-size: 0.95rem; font-weight: 600; color: #111827;">${escapeHtml(vuln.name)}</code>
                </div>
                <div style="color: #4b5563; font-size: 0.9rem; margin-bottom: 0.5rem;">
                  ${escapeHtml(vuln.via)}
                </div>
                <div style="font-family: 'SF Mono', Monaco, monospace; font-size: 0.8rem; color: #6b7280;">
                  Vulnerable range: <code style="background: #e5e7eb; padding: 0.125rem 0.375rem; border-radius: 3px;">${escapeHtml(vuln.range)}</code>
                </div>
              </div>
              <div style="text-align: right;">
                ${vuln.fixAvailable
                  ? typeof vuln.fixAvailable === 'object'
                    ? `<div style="background: #10b981; color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                         Fix Available
                         <div style="font-size: 0.75rem; font-weight: 400; margin-top: 0.25rem; opacity: 0.9;">
                           ${escapeHtml(vuln.fixAvailable.name)}@${escapeHtml(vuln.fixAvailable.version)}
                         </div>
                       </div>`
                    : `<div style="background: #10b981; color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                         Fix Available
                       </div>`
                  : `<div style="background: #6b7280; color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">
                       No Fix Yet
                     </div>`
                }
              </div>
            </div>
            ${vuln.url ? `
              <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb;">
                <a href="${escapeHtml(vuln.url)}" target="_blank" rel="noopener" style="color: #3b82f6; text-decoration: none; font-size: 0.85rem; display: flex; align-items: center; gap: 0.375rem;">
                  📄 Advisory Details
                  <span style="font-size: 0.7rem;">↗</span>
                </a>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div style="background: #eff6ff; padding: 1.5rem; margin-top: 2rem; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <div style="display: flex; align-items: start; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">💡</span>
          <div>
            <strong style="color: #1e40af; font-size: 1rem;">Remediation Steps</strong>
            <ol style="margin: 0.75rem 0 0 0; padding-left: 1.5rem; color: #1e3a8a;">
              <li style="margin: 0.5rem 0;">Run <code style="background: white; padding: 0.125rem 0.375rem; border-radius: 3px; font-family: 'SF Mono', Monaco, monospace;">npm audit fix</code> to automatically install compatible updates</li>
              <li style="margin: 0.5rem 0;">For breaking changes, use <code style="background: white; padding: 0.125rem 0.375rem; border-radius: 3px; font-family: 'SF Mono', Monaco, monospace;">npm audit fix --force</code> (test thoroughly after)</li>
              <li style="margin: 0.5rem 0;">Review advisory details for packages without automated fixes</li>
              <li style="margin: 0.5rem 0;">Consider alternative packages if vulnerabilities cannot be resolved</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function renderComplianceScoreHtml(report: Report, targetPath: string): Promise<string> {
  const score = calculateComplianceScore(report.findings.filter(f => !f.acknowledged && !f.suppressed && !f.isBaseline));
  const trending = await getScoreTrending(targetPath, score.overall);

  const trendingIcon = trending
    ? trending.direction === 'up'
      ? '↑'
      : trending.direction === 'down'
      ? '↓'
      : '→'
    : '';

  const trendingClass = trending
    ? trending.direction === 'up'
      ? 'trending-up'
      : trending.direction === 'down'
      ? 'trending-down'
      : 'trending-same'
    : '';

  const trendingText = trending
    ? trending.direction === 'up'
      ? `+${trending.change.toFixed(1)} from previous scan`
      : trending.direction === 'down'
      ? `${trending.change.toFixed(1)} from previous scan`
      : 'No change from previous scan'
    : '';

  return `
    <div class="compliance-score-section">
      <div class="score-header">
        <h2>HIPAA Compliance Score</h2>
        <p class="score-subtitle">Overall security posture based on identified findings</p>
      </div>

      <div class="score-main">
        <div class="score-circle" style="border-color: ${score.color}">
          <div class="score-value" style="color: ${score.color}">${Math.round(score.overall)}</div>
          <div class="score-max">/100</div>
          <div class="score-grade" style="background: ${score.color}">${score.grade}</div>
        </div>

        <div class="score-info">
          <div class="score-description">
            ${score.overall >= 80
              ? '<strong>Excellent!</strong> Your codebase demonstrates strong HIPAA compliance practices.'
              : score.overall >= 60
              ? '<strong>Good progress.</strong> Address remaining issues to strengthen compliance.'
              : score.overall >= 40
              ? '<strong>Needs improvement.</strong> Several compliance gaps require attention.'
              : '<strong>Critical issues detected.</strong> Immediate action required for HIPAA compliance.'
            }
          </div>

          ${trending ? `
          <div class="score-trending ${trendingClass}">
            <span class="trending-icon">${trendingIcon}</span>
            <span class="trending-text">${trendingText}</span>
          </div>
          ` : ''}

          <div class="score-formula">
            <strong>Score Calculation:</strong> 100 - (Critical×15 + High×8 + Medium×3 + Low×1)
          </div>
        </div>
      </div>

      <div class="score-categories">
        <h3>Compliance by Category</h3>
        <div class="category-grid">
          ${Object.entries(score.byCategory)
            .sort((a, b) => a[1].score - b[1].score)
            .map(([category, data]) => {
              const catColor = data.score >= 80 ? '#10b981' : data.score >= 60 ? '#eab308' : data.score >= 40 ? '#f97316' : '#ef4444';
              const catWidth = data.score;
              return `
              <div class="category-card">
                <div class="category-name">${escapeHtml(category)}</div>
                <div class="category-score-container">
                  <div class="category-bar-bg">
                    <div class="category-bar" style="width: ${catWidth}%; background: ${catColor}"></div>
                  </div>
                  <div class="category-score" style="color: ${catColor}">${Math.round(data.score)}</div>
                </div>
                <div class="category-findings">${data.findings} finding${data.findings !== 1 ? 's' : ''}</div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderRiskAnalysisHtml(report: Report): string {
  const severityColors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
    info: '#6b7280',
  };

  // Summary table
  const summaryHtml = `
    <div class="risk-summary-table">
      <table>
        <thead>
          <tr>
            <th>Risk Level</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-left: 4px solid ${severityColors.critical}">
            <td><strong>Critical</strong></td>
            <td>${report.summary.critical}</td>
            <td>${report.summary.total > 0 ? Math.round((report.summary.critical / report.summary.total) * 100) : 0}%</td>
          </tr>
          <tr style="border-left: 4px solid ${severityColors.high}">
            <td><strong>High</strong></td>
            <td>${report.summary.high}</td>
            <td>${report.summary.total > 0 ? Math.round((report.summary.high / report.summary.total) * 100) : 0}%</td>
          </tr>
          <tr style="border-left: 4px solid ${severityColors.medium}">
            <td><strong>Medium</strong></td>
            <td>${report.summary.medium}</td>
            <td>${report.summary.total > 0 ? Math.round((report.summary.medium / report.summary.total) * 100) : 0}%</td>
          </tr>
          <tr style="border-left: 4px solid ${severityColors.low}">
            <td><strong>Low</strong></td>
            <td>${report.summary.low}</td>
            <td>${report.summary.total > 0 ? Math.round((report.summary.low / report.summary.total) * 100) : 0}%</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb; font-weight: 600;">
            <td><strong>Total</strong></td>
            <td>${report.summary.total}</td>
            <td>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // Detailed risk table
  const detailedHtml = report.findings.length > 0 ? `
    <div class="risk-detail-table">
      <table>
        <thead>
          <tr>
            <th>Threat</th>
            <th>Vulnerability</th>
            <th>Risk Level</th>
            <th>Mitigation Status</th>
            <th>Remediation Plan</th>
            <th>HIPAA Reference</th>
          </tr>
        </thead>
        <tbody>
          ${report.findings.map(f => `
            <tr style="border-left: 4px solid ${severityColors[f.severity]}">
              <td class="threat-cell">${escapeHtml(getCategoryThreat(f.category))}</td>
              <td class="vulnerability-cell">
                <strong>${escapeHtml(f.title)}</strong>
                <div class="file-ref">${escapeHtml(f.file)}${f.line ? `:${f.line}` : ''}</div>
              </td>
              <td class="risk-level-cell">
                <span class="risk-badge" style="background: ${severityColors[f.severity]}">
                  ${getRiskLevel(f.severity)}
                </span>
              </td>
              <td class="status-cell">
                <span class="status-badge ${f.fixType ? 'status-available' : 'status-open'}">
                  ${escapeHtml(getMitigationStatus(f))}
                </span>
              </td>
              <td class="remediation-cell">${escapeHtml(f.recommendation)}</td>
              <td class="hipaa-cell">${escapeHtml(f.hipaaReference || 'N/A')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '<p style="text-align: center; color: #6b7280; padding: 2rem;">No risks identified.</p>';

  return `
    <div class="risk-analysis-section">
      <h2>📊 Risk Analysis</h2>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">
        Comprehensive risk assessment of identified HIPAA compliance findings with threat categorization and remediation tracking.
      </p>

      <h3>Risk Summary</h3>
      ${summaryHtml}

      <h3 style="margin-top: 2rem;">Detailed Risk Assessment</h3>
      ${detailedHtml}
    </div>
  `;
}

function severityBadge(severity: string): string {
  const badges: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: '⚪',
  };
  return badges[severity] || '⚪';
}

export async function generateReport(
  result: ScanResult,
  targetPath: string,
  options: ReportOptions
): Promise<void> {
  const report = buildReport(result, targetPath, options.vulnerabilities);

  let content: string;
  let extension: string;

  switch (options.format) {
    case 'html':
      content = await generateHtml(report, targetPath, options);
      extension = 'html';
      break;
    case 'markdown':
      content = generateMarkdown(report);
      extension = 'md';
      break;
    case 'json':
    default:
      content = generateJson(report);
      extension = 'json';
  }

  if (options.outputPath) {
    await writeFile(options.outputPath, content);
    console.log(chalk.green(`\nReport saved to: ${options.outputPath}`));
  } else {
    const defaultPath = `vlayer-report.${extension}`;
    await writeFile(defaultPath, content);
    console.log(chalk.green(`\nReport saved to: ${defaultPath}`));
  }
}
