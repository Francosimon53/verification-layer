/**
 * AI Cache - Cache results by file hash
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AI_CONFIG } from './config.js';

interface CacheEntry {
  fileHash: string;
  ruleId: string;
  result: any;
  timestamp: number;
  ttl: number;
}

export class AICache {
  private cacheDir: string;
  private ttlMs: number;

  constructor() {
    this.cacheDir = AI_CONFIG.cache.directory;
    this.ttlMs = AI_CONFIG.cache.ttlHours * 60 * 60 * 1000;
  }

  async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  getFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  getCacheKey(fileHash: string, ruleId: string): string {
    return `${fileHash}-${ruleId}.json`;
  }

  async get(
    fileContent: string,
    ruleId: string
  ): Promise<any | null> {
    if (!AI_CONFIG.cache.enabled) {
      return null;
    }

    await this.ensureCacheDir();
    const fileHash = this.getFileHash(fileContent);
    const cacheKey = this.getCacheKey(fileHash, ruleId);
    const cachePath = path.join(this.cacheDir, cacheKey);

    try {
      const data = await fs.readFile(cachePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(data);

      // Check if cache is expired
      const age = Date.now() - entry.timestamp;
      if (age > this.ttlMs) {
        await fs.unlink(cachePath); // Delete expired cache
        return null;
      }

      return entry.result;
    } catch (error) {
      return null;
    }
  }

  async set(
    fileContent: string,
    ruleId: string,
    result: any
  ): Promise<void> {
    if (!AI_CONFIG.cache.enabled) {
      return;
    }

    await this.ensureCacheDir();
    const fileHash = this.getFileHash(fileContent);
    const cacheKey = this.getCacheKey(fileHash, ruleId);
    const cachePath = path.join(this.cacheDir, cacheKey);

    const entry: CacheEntry = {
      fileHash,
      ruleId,
      result,
      timestamp: Date.now(),
      ttl: this.ttlMs,
    };

    await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  async clear(): Promise<void> {
    await this.ensureCacheDir();
    const files = await fs.readdir(this.cacheDir);
    await Promise.all(
      files.map((file) => fs.unlink(path.join(this.cacheDir, file)))
    );
  }
}
