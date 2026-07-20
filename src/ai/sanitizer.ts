/**
 * PHI/PII Sanitizer - Scrubs sensitive data before sending to LLM
 * CRITICAL for HIPAA compliance of vlayer itself
 */

export interface SanitizationResult {
  sanitizedCode: string;
  phiFound: number;
  replacementMap: Map<string, string>;
  warnings: string[];
}

interface PHIPattern {
  name: string;
  regex: RegExp;
  placeholder: (index: number) => string;
}

const PHI_PATTERNS: PHIPattern[] = [
  {
    name: 'SSN',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    placeholder: (i) => `[PHI_SSN_${i}]`,
  },
  {
    name: 'Email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    placeholder: (i) => `[PHI_EMAIL_${i}]`,
  },
  {
    name: 'Phone',
    regex: /\b(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
    placeholder: (i) => `[PHI_PHONE_${i}]`,
  },
  {
    name: 'Date of Birth',
    regex: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g,
    placeholder: (i) => `[PHI_DOB_${i}]`,
  },
  {
    name: 'Medical Record Number',
    regex: /\bMRN[-:\s]*\d{6,10}\b/gi,
    placeholder: (i) => `[PHI_MRN_${i}]`,
  },
  {
    name: 'IP Address',
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    placeholder: (i) => `[PHI_IP_${i}]`,
  },
];

/**
 * Sanitizes code before sending to LLM API
 * Replaces PHI with safe placeholders
 */
export function sanitizeCodeForLLM(
  code: string,
  filePath: string
): SanitizationResult {
  let sanitizedCode = code;
  const replacementMap = new Map<string, string>();
  const warnings: string[] = [];
  let totalPhiFound = 0;

  for (const pattern of PHI_PATTERNS) {
    const matches = code.match(pattern.regex);
    if (matches) {
      let patternIndex = 0;
      sanitizedCode = sanitizedCode.replace(pattern.regex, (match) => {
        patternIndex++;
        totalPhiFound++;
        const placeholder = pattern.placeholder(patternIndex);
        replacementMap.set(placeholder, match);
        return placeholder;
      });

      warnings.push(
        `Found ${matches.length} ${pattern.name} pattern(s) in ${filePath}`
      );
    }
  }

  if (totalPhiFound > 0) {
    warnings.push(
      `⚠ PHI detected and sanitized before AI analysis (${totalPhiFound} instances)`
    );
  }

  return {
    sanitizedCode,
    phiFound: totalPhiFound,
    replacementMap,
    warnings,
  };
}

/**
 * Restores sanitized PHI (if needed for reporting)
 * Use with caution - only for local file output
 */
export function restoreSanitizedCode(
  sanitizedCode: string,
  replacementMap: Map<string, string>
): string {
  let restored = sanitizedCode;
  for (const [placeholder, original] of replacementMap.entries()) {
    restored = restored.replace(new RegExp(placeholder, 'g'), original);
  }
  return restored;
}
