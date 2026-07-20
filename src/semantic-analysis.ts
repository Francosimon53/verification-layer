import { parse } from '@typescript-eslint/typescript-estree';
import { readFile } from 'fs/promises';
import type { Confidence } from './types.js';

export interface SemanticContext {
  confidence: Confidence;
  context: 'code' | 'string' | 'comment' | 'template' | 'test';
  inTestFile: boolean;
}

/**
 * Check if a file is a test file based on its path
 */
function isTestFile(filePath: string): boolean {
  const testPatterns = [
    /\.test\.(ts|tsx|js|jsx)$/,
    /\.spec\.(ts|tsx|js|jsx)$/,
    /\/__tests__\//,
    /\/tests?\//,
  ];

  return testPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Parse a TypeScript/JavaScript file and analyze semantic context at a specific line
 */
export async function analyzeSemanticContext(
  filePath: string,
  lineNumber: number,
  pattern?: string
): Promise<SemanticContext> {
  // Check if it's a test file first
  const inTestFile = isTestFile(filePath);

  // Only parse TypeScript/JavaScript files
  const isTsJsFile = /\.(ts|tsx|js|jsx)$/.test(filePath);
  if (!isTsJsFile) {
    // For non-TS/JS files, use simple heuristics
    return {
      confidence: 'medium',
      context: 'code',
      inTestFile,
    };
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const targetLine = lines[lineNumber - 1];

    if (!targetLine) {
      return {
        confidence: 'medium',
        context: 'code',
        inTestFile,
      };
    }

    // Quick heuristics before parsing (faster)

    // Check if line is a comment
    const trimmedLine = targetLine.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
      return {
        confidence: 'low',
        context: 'comment',
        inTestFile,
      };
    }

    // Parse the file with AST
    let ast;
    try {
      ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
        tokens: true,
        errorOnUnknownASTType: false,
        jsx: filePath.endsWith('x'),
      });
    } catch {
      // If parsing fails, fall back to regex analysis
      return analyzeWithoutAST(targetLine, inTestFile);
    }

    // Check if the line is in a comment
    if (ast.comments) {
      for (const comment of ast.comments) {
        if (comment.loc &&
            lineNumber >= comment.loc.start.line &&
            lineNumber <= comment.loc.end.line) {
          return {
            confidence: 'low',
            context: 'comment',
            inTestFile,
          };
        }
      }
    }

    // Traverse AST to find the context at the specific line
    const context = findContextAtLine(ast, lineNumber, pattern);

    // If in a test file, reduce confidence
    if (inTestFile && context.confidence === 'high') {
      context.confidence = 'low';
    }

    return {
      ...context,
      inTestFile,
    };

  } catch {
    // If any error occurs, fall back to simple analysis
    return {
      confidence: 'medium',
      context: 'code',
      inTestFile,
    };
  }
}

/**
 * Fallback analysis without AST parsing
 */
function analyzeWithoutAST(line: string, inTestFile: boolean): SemanticContext {
  const trimmed = line.trim();

  // Check for comments
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return { confidence: 'low', context: 'comment', inTestFile };
  }

  // Check for string literals (simple heuristic)
  if (trimmed.match(/['"`]/)) {
    return { confidence: 'low', context: 'string', inTestFile };
  }

  return {
    confidence: inTestFile ? 'low' : 'medium',
    context: 'code',
    inTestFile,
  };
}

/**
 * Find the semantic context at a specific line by traversing the AST
 */
function findContextAtLine(node: any, lineNumber: number, pattern?: string): Omit<SemanticContext, 'inTestFile'> {
  if (!node) {
    return { confidence: 'medium', context: 'code' };
  }

  // Check if this node contains the target line
  if (node.loc && node.loc.start.line <= lineNumber && node.loc.end.line >= lineNumber) {

    // String literal
    if (node.type === 'Literal' && typeof node.value === 'string') {
      // If no pattern provided, treat any string as low confidence (old behavior)
      if (!pattern) {
        return { confidence: 'low', context: 'string' };
      }
      // If pattern is provided, only return string context if pattern is in the string
      if (node.value.includes(pattern)) {
        return { confidence: 'low', context: 'string' };
      }
      // Pattern not in this string, continue searching
    }

    // Template literal
    if (node.type === 'TemplateLiteral') {
      if (!pattern) {
        return { confidence: 'medium', context: 'template' };
      }
      // Check if pattern is in template content
      if (node.quasis) {
        for (const quasi of node.quasis) {
          if (quasi.value && quasi.value.raw && quasi.value.raw.includes(pattern)) {
            return { confidence: 'medium', context: 'template' };
          }
        }
      }
      // Pattern not in template, continue searching
    }

    // Template element (part of template literal)
    if (node.type === 'TemplateElement') {
      if (!pattern) {
        return { confidence: 'medium', context: 'template' };
      }
      if (node.value && node.value.raw && node.value.raw.includes(pattern)) {
        return { confidence: 'medium', context: 'template' };
      }
    }

    // JSX Text
    if (node.type === 'JSXText') {
      if (!pattern) {
        return { confidence: 'low', context: 'string' };
      }
      if (node.value && node.value.includes(pattern)) {
        return { confidence: 'low', context: 'string' };
      }
    }

    // Check children recursively
    for (const key in node) {
      if (key === 'loc' || key === 'range' || key === 'parent') continue;

      const child = node[key];

      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.loc) {
            const result = findContextAtLine(item, lineNumber, pattern);
            if (result.context !== 'code') {
              return result;
            }
          }
        }
      } else if (child && typeof child === 'object' && child.loc) {
        const result = findContextAtLine(child, lineNumber, pattern);
        if (result.context !== 'code') {
          return result;
        }
      }
    }
  }

  // If we found the line but it's in executable code
  if (node.loc && node.loc.start.line === lineNumber) {
    return { confidence: 'high', context: 'code' };
  }

  return { confidence: 'high', context: 'code' };
}

/**
 * Batch analyze multiple findings
 */
export async function batchAnalyzeSemanticContext(
  findings: Array<{ file: string; line?: number; pattern?: string }>
): Promise<SemanticContext[]> {
  const results = await Promise.all(
    findings.map(async f => {
      if (!f.line) {
        return {
          confidence: 'medium' as Confidence,
          context: 'code' as const,
          inTestFile: isTestFile(f.file),
        };
      }
      return analyzeSemanticContext(f.file, f.line, f.pattern);
    })
  );

  return results;
}
