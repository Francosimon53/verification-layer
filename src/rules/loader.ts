import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import { RulesFileSchema, CustomRuleSchema } from './schema.js';
import type { CompiledCustomRule } from '../types.js';
import type { CustomRuleDefinition } from './schema.js';

export interface LoadRulesResult {
  rules: CompiledCustomRule[];
  errors: RuleLoadError[];
}

export interface RuleLoadError {
  file: string;
  error: string;
  details?: string;
}

function parseRegexFlags(flags: string): string {
  // Filter out unsupported flags for JavaScript regex
  const validFlags = 'gimsuy';
  return flags.split('').filter(f => validFlags.includes(f)).join('');
}

function compileRule(rule: CustomRuleDefinition): CompiledCustomRule {
  const flags = parseRegexFlags(rule.flags || 'gi');

  return {
    ...rule,
    compiledPattern: new RegExp(rule.pattern, flags),
    compiledMustNotContain: rule.mustNotContain
      ? new RegExp(rule.mustNotContain, flags)
      : undefined,
  };
}

async function loadYamlFile(filePath: string): Promise<{ rules: CompiledCustomRule[]; errors: RuleLoadError[] }> {
  const rules: CompiledCustomRule[] = [];
  const errors: RuleLoadError[] = [];

  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseYaml(content);

    // Validate against schema
    const validated = RulesFileSchema.parse(parsed);

    // Compile each rule
    for (const rule of validated.rules) {
      try {
        // Additional validation
        CustomRuleSchema.parse(rule);

        // Test that regex is valid
        try {
          new RegExp(rule.pattern);
        } catch (regexError) {
          errors.push({
            file: filePath,
            error: `Invalid regex pattern in rule "${rule.id}"`,
            details: regexError instanceof Error ? regexError.message : 'Unknown regex error',
          });
          continue;
        }

        if (rule.mustNotContain) {
          try {
            new RegExp(rule.mustNotContain);
          } catch (regexError) {
            errors.push({
              file: filePath,
              error: `Invalid mustNotContain regex in rule "${rule.id}"`,
              details: regexError instanceof Error ? regexError.message : 'Unknown regex error',
            });
            continue;
          }
        }

        rules.push(compileRule(rule));
      } catch (ruleError) {
        if (ruleError instanceof ZodError) {
          errors.push({
            file: filePath,
            error: `Validation error in rule "${rule.id}"`,
            details: ruleError.issues.map(e => `${String(e.path.join('.'))}: ${e.message}`).join('; '),
          });
        } else {
          errors.push({
            file: filePath,
            error: `Error processing rule "${rule.id}"`,
            details: ruleError instanceof Error ? ruleError.message : 'Unknown error',
          });
        }
      }
    }
  } catch (error) {
    if (error instanceof ZodError) {
      errors.push({
        file: filePath,
        error: 'Invalid rules file format',
        details: error.issues.map(e => `${String(e.path.join('.'))}: ${e.message}`).join('; '),
      });
    } else {
      errors.push({
        file: filePath,
        error: 'Failed to parse YAML file',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { rules, errors };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function loadCustomRules(
  basePath: string,
  customRulesPath?: string
): Promise<LoadRulesResult> {
  const allRules: CompiledCustomRule[] = [];
  const allErrors: RuleLoadError[] = [];

  // Priority 1: Custom path specified via config or CLI
  if (customRulesPath) {
    const customPath = path.isAbsolute(customRulesPath)
      ? customRulesPath
      : path.join(basePath, customRulesPath);

    if (await fileExists(customPath)) {
      const { rules, errors } = await loadYamlFile(customPath);
      allRules.push(...rules);
      allErrors.push(...errors);
    } else {
      allErrors.push({
        file: customPath,
        error: 'Specified rules file not found',
      });
    }
    return { rules: allRules, errors: allErrors };
  }

  // Priority 2: vlayer-rules.yaml in root directory
  const rootRulesFile = path.join(basePath, 'vlayer-rules.yaml');
  if (await fileExists(rootRulesFile)) {
    const { rules, errors } = await loadYamlFile(rootRulesFile);
    allRules.push(...rules);
    allErrors.push(...errors);
  }

  // Also check for .yml extension
  const rootRulesFileYml = path.join(basePath, 'vlayer-rules.yml');
  if (await fileExists(rootRulesFileYml)) {
    const { rules, errors } = await loadYamlFile(rootRulesFileYml);
    allRules.push(...rules);
    allErrors.push(...errors);
  }

  // Priority 3: .vlayer/rules/*.yaml directory
  const rulesDir = path.join(basePath, '.vlayer', 'rules');
  if (await directoryExists(rulesDir)) {
    try {
      const files = await readdir(rulesDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      for (const file of yamlFiles) {
        const filePath = path.join(rulesDir, file);
        const { rules, errors } = await loadYamlFile(filePath);
        allRules.push(...rules);
        allErrors.push(...errors);
      }
    } catch (error) {
      allErrors.push({
        file: rulesDir,
        error: 'Failed to read rules directory',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Deduplicate rules by ID (later rules override earlier ones)
  const ruleMap = new Map<string, CompiledCustomRule>();
  for (const rule of allRules) {
    ruleMap.set(rule.id, rule);
  }

  return { rules: Array.from(ruleMap.values()), errors: allErrors };
}

export async function validateRulesFile(filePath: string): Promise<{
  valid: boolean;
  rules: number;
  errors: RuleLoadError[];
}> {
  const { rules, errors } = await loadYamlFile(filePath);
  return {
    valid: errors.length === 0,
    rules: rules.length,
    errors,
  };
}
