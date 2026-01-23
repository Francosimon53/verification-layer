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

  'phi-localstorage': (line: string): string | null => {
    // Pattern: localStorage.setItem("patientData", data)
    // Convert to: comment with suggestion to use server-side session
    const match = line.match(/^(\s*)localStorage\.(setItem|getItem)\s*\(/);
    if (match) {
      const indent = match[1];
      return `${indent}// [VLAYER] PHI in localStorage removed - use server-side session storage instead\n${indent}// TODO: Replace with: await sessionApi.store(key, encryptedData)\n${indent}// Original: ${line.trim()}`;
    }
    return null;
  },

  'phi-url-param': (line: string): string | null => {
    // Pattern: fetch(`/api?patientId=${id}`)
    // Convert to: suggestion to use POST with body
    const match = line.match(/^(\s*)(fetch|axios\.get|http\.get)\s*\(\s*[`'"]/);
    if (match) {
      const indent = match[1];
      const method = match[2];
      return `${indent}// [VLAYER] PHI in URL params - use POST with encrypted body instead\n${indent}// TODO: Replace with: ${method === 'fetch' ? "fetch(url, { method: 'POST', body: JSON.stringify({ patientId }) })" : 'axios.post(url, { patientId })'}\n${indent}// Original: ${line.trim()}`;
    }
    return null;
  },

  'phi-log-unredacted': (line: string): string | null => {
    // Pattern: logger.info("Patient data", patientData)
    // Convert to: logger.info("Patient data", redactPHI(patientData))
    const match = line.match(/(logger\.(log|info|debug|warn|error))\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*(\w+)/);
    if (match) {
      const [fullMatch, loggerCall, , message, variable] = match;
      return line.replace(
        new RegExp(`(${loggerCall.replace('.', '\\.')}\\s*\\(\\s*${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,\\s*)${variable}`),
        `$1redactPHI(${variable})`
      );
    }
    // Simpler pattern: logger.info(patientData)
    const simpleMatch = line.match(/(logger\.(log|info|debug|warn|error))\s*\(\s*(\w*patient\w*)\s*\)/i);
    if (simpleMatch) {
      const [, loggerCall, , variable] = simpleMatch;
      return line.replace(
        new RegExp(`(${loggerCall.replace('.', '\\.')}\\s*\\()${variable}(\\s*\\))`),
        `$1redactPHI(${variable})$2`
      );
    }
    return null;
  },

  'cookie-insecure': (line: string): string | null => {
    // Pattern: cookie: { maxAge: 3600 } or res.cookie('session', value)
    // Add httpOnly: true, secure: true

    // Pattern 1: cookie options object without httpOnly
    const optionsMatch = line.match(/cookie\s*:\s*\{([^}]*)\}/);
    if (optionsMatch && !line.includes('httpOnly')) {
      const options = optionsMatch[1];
      const newOptions = options.trim() ? `${options.trim()}, httpOnly: true, secure: true` : 'httpOnly: true, secure: true';
      return line.replace(/cookie\s*:\s*\{[^}]*\}/, `cookie: { ${newOptions} }`);
    }

    // Pattern 2: res.cookie() without options
    const resCookieMatch = line.match(/(res\.cookie\s*\(\s*['"`][^'"`]+['"`]\s*,\s*\w+)\s*\)/);
    if (resCookieMatch && !line.includes('httpOnly')) {
      return line.replace(
        /(res\.cookie\s*\(\s*['"`][^'"`]+['"`]\s*,\s*\w+)\s*\)/,
        '$1, { httpOnly: true, secure: true })'
      );
    }

    return null;
  },

  'backup-unencrypted': (line: string): string | null => {
    // Pattern: writeFile('backup.sql', data) or backup.sql without encryption
    // Add encryption suggestion
    const match = line.match(/^(\s*)(fs\.)?writeFile\s*\(\s*(['"`][^'"`]*backup[^'"`]*['"`])/i);
    if (match) {
      const indent = match[1];
      const filePath = match[3];
      return `${indent}// [VLAYER] Unencrypted backup - encrypt before writing\n${indent}// TODO: const encrypted = await crypto.encrypt(data, process.env.BACKUP_KEY);\n${indent}// Then write encrypted data to ${filePath}.enc\n${indent}// Original: ${line.trim()}`;
    }

    // Pattern for backup config
    const configMatch = line.match(/^(\s*).*backup.*=.*\.(sql|csv|json|txt)/i);
    if (configMatch && !line.includes('encrypt') && !line.includes('gpg')) {
      const indent = configMatch[1];
      return `${indent}// [VLAYER] Use encrypted backup format (.gpg, .enc) or enable encryption\n${indent}${line.trim()}`;
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
