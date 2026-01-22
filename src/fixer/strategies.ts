import type { FixType } from '../types.js';

type FixStrategy = (line: string) => string | null;

function toScreamingSnakeCase(varName: string): string {
  return varName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}

function extractVarName(line: string): string | null {
  // Match variable declarations: const/let/var name = or name: or name =
  const match = line.match(/(?:const|let|var)\s+(\w+)|(\w+)\s*[:=]/);
  if (match) {
    return match[1] || match[2];
  }
  return null;
}

const fixStrategies: Record<FixType, FixStrategy> = {
  'sql-injection-template': (line: string): string | null => {
    // Pattern: query(`SELECT * FROM users WHERE id = ${userId}`)
    // Convert to: query('SELECT * FROM users WHERE id = ?', [userId])
    const templateMatch = line.match(/(\w+)\s*\(\s*`([^`]*)\$\{([^}]+)\}([^`]*)`\s*\)/);
    if (templateMatch) {
      const [, funcName, before, variable, after] = templateMatch;
      // Replace all template interpolations with ?
      let sql = before + '?' + after;
      const vars = [variable.trim()];

      // Handle multiple interpolations
      let remaining = sql;
      const additionalMatches = remaining.match(/\$\{([^}]+)\}/g);
      if (additionalMatches) {
        for (const match of additionalMatches) {
          const varMatch = match.match(/\$\{([^}]+)\}/);
          if (varMatch) {
            vars.push(varMatch[1].trim());
            remaining = remaining.replace(match, '?');
          }
        }
        sql = remaining;
      }

      return line.replace(
        /(\w+)\s*\(\s*`[^`]*`\s*\)/,
        `${funcName}('${sql}', [${vars.join(', ')}])`
      );
    }
    return null;
  },

  'sql-injection-concat': (line: string): string | null => {
    // Pattern: query("SELECT * FROM users WHERE id = " + userId + " AND ...")
    // Convert to: query("SELECT * FROM users WHERE id = ? AND ...", [userId])
    // This is a complex pattern - we'll be conservative and only fix simple cases

    // Match: func("sql part" + variable + "sql part")
    const simpleMatch = line.match(/(\w+)\s*\(\s*"([^"]+)"\s*\+\s*(\w+)\s*\+\s*"([^"]*)"\s*\)/);
    if (simpleMatch) {
      const [, funcName, sqlBefore, variable, sqlAfter] = simpleMatch;
      // Remove any trailing quote marks from sqlBefore that were meant for the variable
      const cleanBefore = sqlBefore.replace(/'?\s*$/, '');
      // Remove any leading quote marks from sqlAfter
      const cleanAfter = sqlAfter.replace(/^\s*'?/, '');
      const sql = cleanBefore + '?' + cleanAfter;
      return line.replace(
        /(\w+)\s*\(\s*"[^"]+"\s*\+\s*\w+\s*\+\s*"[^"]*"\s*\)/,
        `${funcName}('${sql}', [${variable}])`
      );
    }

    // For more complex patterns, don't attempt auto-fix
    return null;
  },

  'hardcoded-password': (line: string): string | null => {
    // Pattern: password = "secret" or password: "secret"
    // Convert to: password = process.env.PASSWORD
    const match = line.match(/(password|pwd)\s*[:=]\s*(['"`])[^'"`]+\2/i);
    if (match) {
      const varName = extractVarName(line);
      const envVarName = varName ? toScreamingSnakeCase(varName) : 'PASSWORD';
      return line.replace(
        /(password|pwd)\s*[:=]\s*(['"`])[^'"`]+\2/i,
        `$1 = process.env.${envVarName}`
      );
    }
    return null;
  },

  'hardcoded-secret': (line: string): string | null => {
    // Pattern: secret = "xyz"
    // Convert to: secret = process.env.SECRET
    const match = line.match(/secret\s*[:=]\s*(['"`])[^'"`]+\1/i);
    if (match) {
      const varName = extractVarName(line);
      const envVarName = varName ? toScreamingSnakeCase(varName) : 'SECRET';
      return line.replace(
        /secret\s*[:=]\s*(['"`])[^'"`]+\1/i,
        `secret = process.env.${envVarName}`
      );
    }
    return null;
  },

  'api-key-exposed': (line: string): string | null => {
    // Pattern: apiKey = "abc123xyz" or api_key: "abc123xyz"
    // Convert to: apiKey = process.env.API_KEY
    const match = line.match(/(api[_-]?key|apikey)\s*[:=]\s*(['"`])[^'"`]+\2/i);
    if (match) {
      const varName = extractVarName(line);
      const envVarName = varName ? toScreamingSnakeCase(varName) : 'API_KEY';
      return line.replace(
        /(api[_-]?key|apikey)\s*[:=]\s*(['"`])[^'"`]+\2/i,
        `$1 = process.env.${envVarName}`
      );
    }
    return null;
  },

  'phi-console-log': (line: string): string | null => {
    // Pattern: console.log(patient) or console.log("Patient:", patient)
    // Convert to: // [VLAYER] PHI logging removed - review needed: console.log(...)
    const match = line.match(/^(\s*)console\.(log|info|debug|warn|error)\s*\(/);
    if (match) {
      const indent = match[1];
      return `${indent}// [VLAYER] PHI logging removed - review needed: ${line.trim()}`;
    }
    return null;
  },

  'http-url': (line: string): string | null => {
    // Pattern: http://example.com
    // Convert to: https://example.com
    if (line.includes('http://') && !line.includes('http://localhost') && !line.includes('http://127.0.0.1')) {
      return line.replace(/http:\/\//g, 'https://');
    }
    return null;
  },

  'innerhtml-unsanitized': (line: string): string | null => {
    // Pattern: element.innerHTML = userText
    // Convert to: element.textContent = userText
    const match = line.match(/\.innerHTML\s*=\s*/);
    if (match) {
      return line.replace(/\.innerHTML\s*=/, '.textContent =');
    }
    return null;
  },
};

export function applyFixStrategy(line: string, fixType: FixType): string | null {
  const strategy = fixStrategies[fixType];
  if (!strategy) {
    return null;
  }
  return strategy(line);
}
