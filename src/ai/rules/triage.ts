/**
 * AI Triage - Reduce false positives from static scan
 */

import { getAIClient } from '../client.js';
import { AI_CONFIG } from '../config.js';
import { sanitizeCodeForLLM } from '../sanitizer.js';
import type { Finding } from '../../types.js';
import type { TriageResponse, TriagedFinding } from './types.js';

const TRIAGE_SYSTEM_PROMPT = `You are a HIPAA compliance expert analyzing potential security findings.
Your job is to classify findings as:
- confirmed: Definitely a real security issue
- likely: Probably real, needs review
- possible: Might be a false positive
- false_positive: Not a real issue

Common false positives to watch for:
- http://www.w3.org in XML namespaces (NOT an encryption issue)
- Variable names like "dateOfBirth" or "ssn" in forms (NOT PHI exposure unless actual data)
- Test data with fake SSNs/emails in test files
- HTTP URLs in comments or documentation
- Development/localhost URLs

Be conservative - when in doubt, classify as "likely" rather than "false_positive".`;

export async function triageFinding(
  finding: Finding,
  fileContent: string,
  filePath: string
): Promise<TriagedFinding> {
  const client = getAIClient();

  // Sanitize code before sending
  const { sanitizedCode } = sanitizeCodeForLLM(fileContent, filePath);

  // Get context around the finding (±10 lines)
  const lines = sanitizedCode.split('\n');
  const line = finding.line || 1;
  const contextStart = Math.max(0, line - 10);
  const contextEnd = Math.min(lines.length, line + 10);
  const context = lines.slice(contextStart, contextEnd).join('\n');

  const userPrompt = `Finding to triage:
File: ${filePath}
Line: ${finding.line}
Category: ${finding.category}
Severity: ${finding.severity}
Title: ${finding.title}
Description: ${finding.description}

Code context (lines ${contextStart + 1}-${contextEnd + 1}):
\`\`\`
${context}
\`\`\`

Is this a real security issue or a false positive? Respond in JSON:
{
  "classification": "confirmed" | "likely" | "possible" | "false_positive",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggestedAction": "what to do about it (optional)"
}`;

  try {
    const response = await client.messages.create({
      model: AI_CONFIG.model,
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
      system: TRIAGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }, {
      timeout: AI_CONFIG.triage.timeoutMs,
      maxRetries: AI_CONFIG.triage.maxRetries,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const triageResult: TriageResponse = JSON.parse(content.text);

    return {
      ...finding,
      aiClassification: triageResult.classification,
      aiConfidence: triageResult.confidence,
      aiReasoning: triageResult.reasoning,
      source: 'static',
    };
  } catch (error) {
    // On error, return finding as-is with low confidence
    return {
      ...finding,
      aiClassification: 'likely',
      aiConfidence: 0.5,
      aiReasoning: `Triage failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      source: 'static',
    };
  }
}

/**
 * Triage multiple findings in batch
 */
export async function triageFindings(
  findings: Finding[],
  fileContents: Map<string, string>
): Promise<TriagedFinding[]> {
  const cap = AI_CONFIG.triage.maxFindings;

  // Honest fallback: a finding we did not AI-verify is returned regex-flagged,
  // never dropped, so the report stays complete.
  const notVerified = (f: Finding, reason: string): TriagedFinding => ({
    ...f,
    aiClassification: 'likely',
    aiConfidence: 0.5,
    aiReasoning: reason,
    source: 'static',
  });

  const triaged: TriagedFinding[] = [];
  let calls = 0;

  for (const finding of findings) {
    if (calls >= cap) {
      triaged.push(notVerified(finding, 'Not AI-verified (triage cap reached) — regex-flagged only'));
      continue;
    }
    const content = fileContents.get(finding.file);
    if (!content) {
      triaged.push(notVerified(finding, 'File content not available for triage'));
      continue;
    }
    triaged.push(await triageFinding(finding, content, finding.file));
    calls++;
  }

  return triaged;
}
