import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import type { Finding, ScanResult } from 'verification-layer';

interface NotificationPayload {
  findings: Finding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  workspaceName: string;
  timestamp: string;
}

let lastNotifiedFindings: Set<string> = new Set();

export async function notifyNewFindings(
  result: ScanResult,
  workspaceName: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration('vlayer');

  if (!config.get<boolean>('notifications.enable')) {
    return;
  }

  // Filter to only new findings (not previously notified)
  const newFindings = result.findings.filter(f => {
    const key = `${f.file}:${f.line}:${f.id}`;
    return !lastNotifiedFindings.has(key);
  });

  if (newFindings.length === 0) {
    return;
  }

  // Update tracked findings
  for (const f of newFindings) {
    const key = `${f.file}:${f.line}:${f.id}`;
    lastNotifiedFindings.add(key);
  }

  // Only notify for critical/high by default
  const minSeverity = config.get<string>('notifications.minSeverity') ?? 'high';
  const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
  const minIndex = severityOrder.indexOf(minSeverity);

  const filteredFindings = newFindings.filter(f =>
    severityOrder.indexOf(f.severity) >= minIndex
  );

  if (filteredFindings.length === 0) {
    return;
  }

  const payload: NotificationPayload = {
    findings: filteredFindings,
    summary: {
      total: filteredFindings.length,
      critical: filteredFindings.filter(f => f.severity === 'critical').length,
      high: filteredFindings.filter(f => f.severity === 'high').length,
      medium: filteredFindings.filter(f => f.severity === 'medium').length,
      low: filteredFindings.filter(f => f.severity === 'low').length,
    },
    workspaceName,
    timestamp: new Date().toISOString(),
  };

  const slackWebhook = config.get<string>('notifications.slackWebhook');
  const teamsWebhook = config.get<string>('notifications.teamsWebhook');

  const promises: Promise<void>[] = [];

  if (slackWebhook) {
    promises.push(sendSlackNotification(slackWebhook, payload));
  }

  if (teamsWebhook) {
    promises.push(sendTeamsNotification(teamsWebhook, payload));
  }

  try {
    await Promise.all(promises);
  } catch (error) {
    console.error('Notification error:', error);
  }
}

async function sendSlackNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<void> {
  const emoji = payload.summary.critical > 0 ? ':rotating_light:' : ':warning:';

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} HIPAA Compliance Alert`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Project:*\n${payload.workspaceName}`,
        },
        {
          type: 'mrkdwn',
          text: `*New Issues:*\n${payload.summary.total}`,
        },
        {
          type: 'mrkdwn',
          text: `*Critical:* ${payload.summary.critical}\n*High:* ${payload.summary.high}`,
        },
        {
          type: 'mrkdwn',
          text: `*Medium:* ${payload.summary.medium}\n*Low:* ${payload.summary.low}`,
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // Add top findings (max 5)
  const topFindings = payload.findings.slice(0, 5);
  for (const finding of topFindings) {
    const severityEmoji = getSeverityEmoji(finding.severity);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${severityEmoji} *${finding.title}*\n\`${finding.file}:${finding.line ?? 0}\`\n${finding.recommendation}`,
      },
    } as any);
  }

  if (payload.findings.length > 5) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_...and ${payload.findings.length - 5} more issues_`,
        },
      ],
    } as any);
  }

  const slackPayload = { blocks };

  await sendWebhook(webhookUrl, slackPayload);
}

async function sendTeamsNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<void> {
  const themeColor = payload.summary.critical > 0 ? 'FF0000' : 'FFA500';

  const facts = [
    { name: 'Project', value: payload.workspaceName },
    { name: 'Total Issues', value: String(payload.summary.total) },
    { name: 'Critical', value: String(payload.summary.critical) },
    { name: 'High', value: String(payload.summary.high) },
    { name: 'Medium', value: String(payload.summary.medium) },
    { name: 'Low', value: String(payload.summary.low) },
  ];

  // Build findings text
  const findingsText = payload.findings
    .slice(0, 5)
    .map(f => `**[${f.severity.toUpperCase()}]** ${f.title} - \`${f.file}:${f.line ?? 0}\``)
    .join('\n\n');

  const teamsPayload = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary: `HIPAA Compliance Alert: ${payload.summary.total} new issues`,
    sections: [
      {
        activityTitle: 'HIPAA Compliance Alert',
        activitySubtitle: payload.timestamp,
        activityImage: 'https://img.icons8.com/color/48/000000/shield.png',
        facts,
        markdown: true,
      },
      {
        title: 'Top Findings',
        text: findingsText + (payload.findings.length > 5
          ? `\n\n_...and ${payload.findings.length - 5} more issues_`
          : ''),
        markdown: true,
      },
    ],
  };

  await sendWebhook(webhookUrl, teamsPayload);
}

function getSeverityEmoji(severity: string): string {
  const emojis: Record<string, string> = {
    critical: ':red_circle:',
    high: ':large_orange_circle:',
    medium: ':large_yellow_circle:',
    low: ':large_blue_circle:',
    info: ':white_circle:',
  };
  return emojis[severity] ?? ':grey_question:';
}

function sendWebhook(url: string, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const req = protocol.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Webhook failed with status ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export function resetNotificationState(): void {
  lastNotifiedFindings.clear();
}
