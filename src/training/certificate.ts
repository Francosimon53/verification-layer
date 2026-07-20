import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface Certificate {
  name: string;
  email?: string;
  date: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  moduleScores: Record<
    number,
    { correct: number; total: number; percentage: number }
  >;
  duration: number; // in minutes
  hash: string; // verification hash
}

export function generateVerificationHash(certificate: Omit<Certificate, 'hash'>): string {
  const data = JSON.stringify({
    name: certificate.name,
    email: certificate.email,
    date: certificate.date,
    score: certificate.score,
    totalQuestions: certificate.totalQuestions,
  });

  return createHash('sha256').update(data + 'vlayer-hipaa-training').digest('hex');
}

export async function saveCertificate(
  name: string,
  email: string | undefined,
  score: number,
  totalQuestions: number,
  moduleScores: Record<number, { correct: number; total: number; percentage: number }>,
  duration: number
): Promise<{ certificate: Certificate; path: string }> {
  const date = new Date().toISOString();
  const percentage = Math.round((score / totalQuestions) * 100);

  const certificateData: Omit<Certificate, 'hash'> = {
    name,
    email,
    date,
    score,
    totalQuestions,
    percentage,
    moduleScores,
    duration,
  };

  const hash = generateVerificationHash(certificateData);
  const certificate: Certificate = { ...certificateData, hash };

  // Save to .vlayer/training/ in home directory
  const trainingDir = join(homedir(), '.vlayer', 'training');
  await mkdir(trainingDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${safeName}-${timestamp}.json`;
  const filepath = join(trainingDir, filename);

  await writeFile(filepath, JSON.stringify(certificate, null, 2), 'utf-8');

  return { certificate, path: filepath };
}

export function printCertificate(certificate: Certificate): string {
  const border = '═'.repeat(70);
  const passed = certificate.percentage >= 70;

  return `
╔${border}╗
║${' '.repeat(70)}║
║${'CERTIFICATE OF COMPLETION'.padStart(42).padEnd(70)}║
║${' '.repeat(70)}║
║${'HIPAA Security Training for Developers'.padStart(44).padEnd(70)}║
║${' '.repeat(70)}║
╠${border}╣
║${' '.repeat(70)}║
║${'This certifies that'.padStart(33).padEnd(70)}║
║${' '.repeat(70)}║
║${certificate.name.toUpperCase().padStart((70 + certificate.name.length) / 2).padEnd(70)}║
║${' '.repeat(70)}║
║${'has successfully completed the vlayer HIPAA Security Training'.padStart(51).padEnd(70)}║
║${' '.repeat(70)}║
╠${border}╣
║${' '.repeat(70)}║
║  Date: ${new Date(certificate.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).padEnd(61)}║
║  Score: ${certificate.score}/${certificate.totalQuestions} (${certificate.percentage}%)${' '.repeat(70 - 15 - certificate.score.toString().length - certificate.totalQuestions.toString().length - certificate.percentage.toString().length)}║
║  Status: ${passed ? 'PASSED ✓' : 'NEEDS IMPROVEMENT'}${' '.repeat(58 - (passed ? 9 : 17))}║
║  Duration: ${certificate.duration} minutes${' '.repeat(52 - certificate.duration.toString().length)}║
║${' '.repeat(70)}║
╠${border}╣
║${' '.repeat(70)}║
║  Module Breakdown:${' '.repeat(52)}║
║${' '.repeat(70)}║
${Object.entries(certificate.moduleScores)
  .map(([moduleId, scores]) => {
    const moduleNum = `Module ${moduleId}`.padEnd(12);
    const scoreStr = `${scores.correct}/${scores.total} (${scores.percentage}%)`;
    return `║  ${moduleNum}${scoreStr.padEnd(56)}║`;
  })
  .join('\n')}
║${' '.repeat(70)}║
╠${border}╣
║${' '.repeat(70)}║
║  Verification Hash:${' '.repeat(51)}║
║  ${certificate.hash.substring(0, 60)}${' '.repeat(8)}║
║  ${certificate.hash.substring(60)}${' '.repeat(70 - certificate.hash.substring(60).length - 2)}║
║${' '.repeat(70)}║
║${'Verify at: https://github.com/Francosimon53/verification-layer'.padEnd(70)}║
║${' '.repeat(70)}║
╚${border}╝
`;
}
