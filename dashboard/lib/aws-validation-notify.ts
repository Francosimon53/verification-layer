import 'server-only';

const TELEGRAM_TIMEOUT_MS = 3_000;

/**
 * Sends a Telegram message to the founder when TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID are both configured. Silently does nothing otherwise.
 * Never throws and never logs the bot token.
 */
export async function notifyFounder(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn('Founder notification failed with status', response.status);
    }
  } catch (error: unknown) {
    // Timeouts and network errors are reported by name only; the URL (which
    // contains the token) is never included.
    const name = error instanceof Error ? error.name : 'UnknownError';
    console.warn('Founder notification failed:', name);
  }
}
