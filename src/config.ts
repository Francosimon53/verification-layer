import { readFile } from 'fs/promises';
import path from 'path';
import type { VlayerConfig } from './types.js';

const DEFAULT_CONFIG: VlayerConfig = {
  exclude: [],
  ignorePaths: [],
  safeHttpDomains: [
    // XML namespaces
    'www.w3.org',
    'w3.org',
    'xmlns.com',
    'purl.org',
    'ns.adobe.com',
    // CDNs
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'jsdelivr.net',
    'cdn.jsdelivr.net',
    'googleapis.com',
    'fonts.googleapis.com',
    'ajax.googleapis.com',
    'gstatic.com',
    'fonts.gstatic.com',
    'cloudflare.com',
    'bootstrapcdn.com',
    'maxcdn.bootstrapcdn.com',
    'stackpath.bootstrapcdn.com',
    'code.jquery.com',
    'cdn.tailwindcss.com',
    // Schema/standards
    'schema.org',
    'ogp.me',
    'rdfs.org',
    // Healthcare standards
    'hl7.org',
    'www.hl7.org',
    'fhir.org',
    'terminology.hl7.org',
    'loinc.org',
    'snomed.info',
    'icd.who.int',
    'unitsofmeasure.org',
    'nucc.org',
    'ada.org',
    'x12.org',
    // Tooling / package registries
    'opensource.org',
    'creativecommons.org',
    'spdx.org',
    'json-schema.org',
    'yaml.org',
    'xml.org',
    'maven.apache.org',
    'www.apache.org',
    'registry.npmjs.org',
    'pypi.org',
    'rubygems.org',
    'crates.io',
    'pkg.go.dev',
    'mvnrepository.com',
    // Documentation
    'example.com',
    'example.org',
    'localhost',
    '127.0.0.1',
  ],
  contextLines: 2,
  categories: undefined,
};

export async function loadConfig(targetPath: string, configFile?: string): Promise<VlayerConfig> {
  const configPath = configFile || path.join(targetPath, '.vlayerrc.json');

  try {
    const content = await readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content) as Partial<VlayerConfig>;

    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      // Merge arrays instead of replacing
      exclude: [...(DEFAULT_CONFIG.exclude || []), ...(userConfig.exclude || [])],
      ignorePaths: [...(DEFAULT_CONFIG.ignorePaths || []), ...(userConfig.ignorePaths || [])],
      safeHttpDomains: [...(DEFAULT_CONFIG.safeHttpDomains || []), ...(userConfig.safeHttpDomains || [])],
    };
  } catch {
    // No config file found, use defaults
    return DEFAULT_CONFIG;
  }
}

export function isPathIgnored(filePath: string, config: VlayerConfig): boolean {
  const ignorePaths = config.ignorePaths || [];
  return ignorePaths.some(pattern => {
    // Simple glob matching
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    }
    return filePath.includes(pattern);
  });
}

export function isSafeHttpUrl(url: string, config: VlayerConfig): boolean {
  const safeDomains = config.safeHttpDomains || [];
  return safeDomains.some(domain => url.includes(domain));
}

export { DEFAULT_CONFIG };
