import jwt from 'jsonwebtoken';

/**
 * Generate a JWT for authenticating as the GitHub App.
 * Valid for 10 minutes (GitHub max).
 */
export function generateAppJWT(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set');
  }

  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iat: now - 60, // issued 60s ago to account for clock drift
      exp: now + 600, // expires in 10 minutes
      iss: appId,
    },
    // Vercel stores PEM with escaped newlines — restore them
    privateKey.replace(/\\n/g, '\n'),
    { algorithm: 'RS256' }
  );
}

/**
 * Get an installation access token for a specific GitHub App installation.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const appJwt = generateAppJWT();

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get installation token (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.token;
}
