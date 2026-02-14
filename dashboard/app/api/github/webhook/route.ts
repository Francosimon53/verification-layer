import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { verifyWebhookSignature } from '@/lib/github/verify';
import { getInstallationToken } from '@/lib/github/auth';
import { generateApiKey } from '@/lib/github/api-keys';
import { injectRepoSecret } from '@/lib/github/secrets';
import { createOnboardingPR } from '@/lib/github/onboarding';
import { createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-hub-signature-256') ?? '';
    const event = req.headers.get('x-github-event') ?? '';
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // Verify webhook signature
    if (!secret || !verifyWebhookSignature(body, signature, secret)) {
      console.error('[webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);

    // Route by event type
    switch (event) {
      case 'installation':
        return await handleInstallation(payload);

      case 'installation_repositories':
        return await handleInstallationRepos(payload);

      default:
        // Acknowledge all other events
        return NextResponse.json({ ok: true, event, action: payload.action ?? 'none' });
    }
  } catch (err: any) {
    console.error('[webhook] Unhandled error:', err);
    // Always return 200 to GitHub to prevent retries on our bugs
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}

/**
 * Handle installation created/deleted events.
 */
async function handleInstallation(payload: any): Promise<NextResponse> {
  const action = payload.action;
  const installation = payload.installation;
  const installationId = installation?.id;

  if (!installationId) {
    return NextResponse.json({ ok: false, error: 'Missing installation ID' });
  }

  const supabase = createAdminClient();

  if (action === 'created') {
    console.log(`[webhook] Installation created: ${installationId} by ${installation.account.login}`);

    // Save installation to Supabase
    const repos = payload.repositories ?? [];
    await supabase.from('github_installations').upsert(
      {
        installation_id: installationId,
        account_login: installation.account.login,
        account_type: installation.account.type,
        app_id: installation.app_id,
        target_type: installation.repository_selection ?? 'all',
        selected_repos: repos.map((r: any) => ({ id: r.id, full_name: r.full_name })),
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'installation_id' }
    );

    // Generate API key
    const apiKey = await generateApiKey(installationId);

    // Get installation token
    const token = await getInstallationToken(installationId);
    const octokit = new Octokit({ auth: token });

    // Onboard each repo
    for (const repo of repos) {
      try {
        const [owner, repoName] = repo.full_name.split('/');

        // Try to inject VLAYER_API_KEY as a repo secret
        const secretOk = await injectRepoSecret(octokit, owner, repoName, 'VLAYER_API_KEY', apiKey);

        // Create the onboarding PR
        await createOnboardingPR(octokit, owner, repoName, secretOk);

        console.log(`[webhook] Onboarded ${repo.full_name} (secrets: ${secretOk})`);
      } catch (err: any) {
        console.error(`[webhook] Failed to onboard ${repo.full_name}:`, err.message);
      }
    }

    return NextResponse.json({
      ok: true,
      action: 'created',
      installation_id: installationId,
      repos_onboarded: repos.length,
    });
  }

  if (action === 'deleted') {
    console.log(`[webhook] Installation deleted: ${installationId}`);

    await supabase
      .from('github_installations')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('installation_id', installationId);

    // Revoke API keys
    await supabase
      .from('api_keys')
      .update({ status: 'revoked' })
      .eq('installation_id', installationId);

    return NextResponse.json({ ok: true, action: 'deleted', installation_id: installationId });
  }

  return NextResponse.json({ ok: true, action });
}

/**
 * Handle new repos being added to an existing installation.
 */
async function handleInstallationRepos(payload: any): Promise<NextResponse> {
  const action = payload.action;
  const installationId = payload.installation?.id;

  if (!installationId || action !== 'added') {
    return NextResponse.json({ ok: true, action });
  }

  const addedRepos = payload.repositories_added ?? [];
  if (addedRepos.length === 0) {
    return NextResponse.json({ ok: true, action, repos: 0 });
  }

  try {
    const token = await getInstallationToken(installationId);
    const octokit = new Octokit({ auth: token });

    // Get existing API key or generate one
    const supabase = createAdminClient();
    const { data: existingKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('installation_id', installationId)
      .eq('status', 'active')
      .maybeSingle();

    const apiKey = existingKey ? null : await generateApiKey(installationId);

    for (const repo of addedRepos) {
      try {
        const [owner, repoName] = repo.full_name.split('/');
        let secretOk = false;

        if (apiKey) {
          secretOk = await injectRepoSecret(octokit, owner, repoName, 'VLAYER_API_KEY', apiKey);
        }

        await createOnboardingPR(octokit, owner, repoName, secretOk);
        console.log(`[webhook] Onboarded new repo ${repo.full_name}`);
      } catch (err: any) {
        console.error(`[webhook] Failed to onboard ${repo.full_name}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[webhook] Failed to process added repos:', err.message);
  }

  return NextResponse.json({ ok: true, action, repos: addedRepos.length });
}
