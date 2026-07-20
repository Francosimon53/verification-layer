import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { Branding, ResolvedBranding } from '../types.js';

/** Logo extensions we support, mapped to their resolved format + MIME type. */
const SUPPORTED_LOGO_FORMATS: Record<string, { format: 'png' | 'jpg' | 'svg'; mime: string }> = {
  '.png': { format: 'png', mime: 'image/png' },
  '.jpg': { format: 'jpg', mime: 'image/jpeg' },
  '.jpeg': { format: 'jpg', mime: 'image/jpeg' },
  '.svg': { format: 'svg', mime: 'image/svg+xml' },
};

/** Default author shown when no brand name is provided. */
export const DEFAULT_BRAND_NAME = 'VLayer Automated Scan';

/**
 * Resolve branding from CLI flags (which take precedence) and config, validating
 * the logo. This never throws: an invalid or missing logo becomes a warning and
 * is dropped so the scan/report always completes.
 *
 * @param cli      Branding from CLI flags (`--brand-name`, `--brand-logo`).
 * @param config   Branding from the `branding` block in config.
 * @param baseDir  Directory used to resolve a relative logo path (defaults to cwd).
 */
export function resolveBranding(
  cli: Branding | undefined,
  config: Branding | undefined,
  baseDir: string = process.cwd()
): ResolvedBranding {
  const warnings: string[] = [];

  // CLI flag wins over config for each field independently.
  const rawName = firstNonEmpty(cli?.name, config?.name);
  const rawLogo = firstNonEmpty(cli?.logo, config?.logo);

  const result: ResolvedBranding = { warnings };

  if (rawName) {
    result.name = rawName.trim();
  }

  if (rawLogo) {
    const logo = validateLogo(rawLogo, baseDir, warnings);
    if (logo) {
      result.logoPath = logo.absolutePath;
      result.logoFormat = logo.format;
    }
  }

  return result;
}

interface ValidatedLogo {
  absolutePath: string;
  format: 'png' | 'jpg' | 'svg';
}

function validateLogo(logo: string, baseDir: string, warnings: string[]): ValidatedLogo | null {
  const absolutePath = path.isAbsolute(logo) ? logo : path.resolve(baseDir, logo);
  const ext = path.extname(absolutePath).toLowerCase();
  const spec = SUPPORTED_LOGO_FORMATS[ext];

  if (!spec) {
    warnings.push(
      `Brand logo "${logo}" has an unsupported format (${ext || 'no extension'}). ` +
        `Supported: .png, .jpg, .jpeg, .svg. Continuing without a logo.`
    );
    return null;
  }

  if (!existsSync(absolutePath)) {
    warnings.push(`Brand logo not found at "${absolutePath}". Continuing without a logo.`);
    return null;
  }

  return { absolutePath, format: spec.format };
}

/**
 * Footer line shown on every page. With branding it reads
 * "Prepared by {name} · Powered by VLayer"; without, just "Powered by VLayer".
 */
export function brandFooterText(branding?: ResolvedBranding): string {
  if (branding?.name) {
    return `Prepared by ${branding.name} · Powered by VLayer`;
  }
  return 'Powered by VLayer';
}

/** Author label for the cover ("Prepared by ..."), falling back to the default. */
export function brandPreparedBy(branding?: ResolvedBranding): string {
  return branding?.name || DEFAULT_BRAND_NAME;
}

/**
 * Read the logo and return a base64 data URI for embedding in HTML `<img src>`.
 * Returns null if the logo can't be read (the report still renders).
 */
export function logoDataUri(branding?: ResolvedBranding): string | null {
  if (!branding?.logoPath || !branding.logoFormat) return null;
  const ext = path.extname(branding.logoPath).toLowerCase();
  const mime = SUPPORTED_LOGO_FORMATS[ext]?.mime;
  if (!mime) return null;
  try {
    const data = readFileSync(branding.logoPath);
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Whether the logo can be drawn into a PDF via pdfkit. pdfkit's `image()`
 * supports PNG and JPEG but not SVG, so SVG logos are skipped in PDFs.
 */
export function pdfLogoPath(branding?: ResolvedBranding): string | null {
  if (!branding?.logoPath) return null;
  if (branding.logoFormat === 'svg') return null;
  return branding.logoPath;
}

/** Whether the brand logo is an SVG that PDF output cannot embed. */
export function isSvgLogo(branding?: ResolvedBranding): boolean {
  return branding?.logoFormat === 'svg';
}

/**
 * Escape a string for safe interpolation into HTML text/attribute context.
 * Mirrors the escaping used across the existing reporters so brand-supplied
 * values (e.g. names with `<` or `"`) cannot inject markup.
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return undefined;
}
