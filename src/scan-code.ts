import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { scan } from './scan.js';
import type { ScanResult, ScanOptions } from './types.js';

export interface CodeInput {
  filename: string;
  content: string;
}

export interface ScanCodeOptions {
  files: CodeInput[];
  categories?: ScanOptions['categories'];
  minConfidence?: ScanOptions['minConfidence'];
}

export async function scanCode(options: ScanCodeOptions): Promise<ScanResult> {
  // Create temp directory
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vlayer-api-'));

  try {
    // Write files to temp directory preserving structure
    for (const file of options.files) {
      const filePath = path.join(tmpDir, file.filename);
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }

    // Run scan on temp directory
    const result = await scan({
      path: tmpDir,
      categories: options.categories,
      minConfidence: options.minConfidence,
    });

    // Clean file paths — remove temp dir prefix
    result.findings = result.findings.map(f => ({
      ...f,
      file: f.file.replace(tmpDir + path.sep, ''),
    }));

    return result;
  } finally {
    // Always clean up temp files
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
