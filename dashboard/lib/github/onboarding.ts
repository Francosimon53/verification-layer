import type { Octokit } from '@octokit/rest';

const WORKFLOW_CONTENT = `name: VLayer HIPAA Compliance Scan

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  hipaa-scan:
    name: HIPAA Compliance Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run VLayer HIPAA Scanner
        id: scan
        run: |
          npx -y verification-layer@latest scan . -f json -o vlayer-results.json || true
          if [ -f vlayer-results.json ]; then
            echo "scan_completed=true" >> "$GITHUB_OUTPUT"
          else
            echo "scan_completed=false" >> "$GITHUB_OUTPUT"
            echo "::warning::VLayer scan did not produce output"
          fi

      - name: Upload results to VLayer
        if: steps.scan.outputs.scan_completed == 'true'
        run: |
          if [ -z "\${{ secrets.VLAYER_API_KEY }}" ]; then
            echo "::notice::VLAYER_API_KEY not configured. Skipping upload to VLayer dashboard."
            echo "To enable dashboard integration, add VLAYER_API_KEY to your repository secrets."
            echo "Get your key at https://app.vlayer.app"
            exit 0
          fi

          curl -s -X POST "https://app.vlayer.app/api/webhook/scan-results" \\
            -H "Authorization: Bearer \${{ secrets.VLAYER_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -H "X-GitHub-Repository: \${{ github.repository }}" \\
            -H "X-GitHub-PR: \${{ github.event.pull_request.number }}" \\
            -H "X-GitHub-SHA: \${{ github.event.pull_request.head.sha }}" \\
            -d @vlayer-results.json
`;

const VLAYER_CONFIG = `# VLayer HIPAA Compliance Configuration
# Docs: https://app.vlayer.app/docs

mode: shadow          # shadow = informational, enforce = block PRs on critical
severity_threshold: high  # minimum severity to report: low, medium, high, critical
ignore_paths:
  - "node_modules/**"
  - "dist/**"
  - "**/*.test.*"
  - "**/*.spec.*"
`;

const PR_BODY_AUTO = `## What's this?

This PR adds automated HIPAA compliance scanning to your repository using [VLayer](https://app.vlayer.app).

### How it works

Every time a PR is opened or updated, VLayer scans your code for HIPAA compliance issues and:
- Posts a summary comment with findings
- Creates a Check Run with inline annotations on the diff
- Uploads results to your VLayer dashboard

### Configuration

VLayer is running in **shadow mode** — scans are informational only and will **never block your PRs**.

You can change this in \`.vlayer.yml\`:
- \`mode: shadow\` → informational (default)
- \`mode: enforce\` → block PRs with critical findings

### Zero config required

Secrets have been automatically configured. **Just merge this PR** to start scanning.

---
*Powered by [VLayer HIPAA Compliance](https://app.vlayer.app)*
`;

const PR_BODY_MANUAL = `## What's this?

This PR adds automated HIPAA compliance scanning to your repository using [VLayer](https://app.vlayer.app).

### How it works

Every time a PR is opened or updated, VLayer scans your code for HIPAA compliance issues and:
- Posts a summary comment with findings
- Creates a Check Run with inline annotations on the diff
- Uploads results to your VLayer dashboard

### Setup required

We couldn't automatically configure secrets for this repository. Please add the following secret manually:

1. Go to **Settings → Secrets and variables → Actions** in this repository
2. Click **New repository secret**
3. Name: \`VLAYER_API_KEY\`
4. Value: Get your key from [app.vlayer.app/settings](https://app.vlayer.app/settings)

### Configuration

VLayer is running in **shadow mode** — scans are informational only and will **never block your PRs**.

You can change this in \`.vlayer.yml\`:
- \`mode: shadow\` → informational (default)
- \`mode: enforce\` → block PRs with critical findings

---
*Powered by [VLayer HIPAA Compliance](https://app.vlayer.app)*
`;

/**
 * Create the onboarding PR that adds the VLayer workflow and config to the repo.
 */
export async function createOnboardingPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  secretsInjected: boolean
): Promise<{ prNumber: number; prUrl: string }> {
  const branchName = 'vlayer/setup';
  const repoFullName = `${owner}/${repo}`;

  // 1. Get the default branch and its latest commit SHA
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const baseSha = refData.object.sha;

  // 2. Create or update the vlayer/setup branch
  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
      sha: baseSha,
      force: true,
    });
  } catch {
    // Branch doesn't exist yet — create it
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
  }

  // 3. Create the workflow file
  await upsertFile(
    octokit,
    owner,
    repo,
    branchName,
    '.github/workflows/vlayer.yml',
    WORKFLOW_CONTENT,
    'Add VLayer HIPAA compliance workflow'
  );

  // 4. Create the config file
  await upsertFile(
    octokit,
    owner,
    repo,
    branchName,
    '.vlayer.yml',
    VLAYER_CONFIG,
    'Add VLayer configuration'
  );

  // 5. Check for existing open PR from this branch
  const { data: existingPRs } = await octokit.pulls.list({
    owner,
    repo,
    head: `${owner}:${branchName}`,
    state: 'open',
  });

  if (existingPRs.length > 0) {
    // Update existing PR body
    const existingPR = existingPRs[0];
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: existingPR.number,
      body: secretsInjected ? PR_BODY_AUTO : PR_BODY_MANUAL,
    });
    console.log(`[onboarding] Updated existing PR #${existingPR.number} for ${repoFullName}`);
    return { prNumber: existingPR.number, prUrl: existingPR.html_url };
  }

  // 6. Open new PR
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: '\u{1F6E1}\u{FE0F} Enable VLayer HIPAA Compliance Scanning',
    head: branchName,
    base: defaultBranch,
    body: secretsInjected ? PR_BODY_AUTO : PR_BODY_MANUAL,
  });

  console.log(`[onboarding] Created PR #${pr.number} for ${repoFullName}: ${pr.html_url}`);
  return { prNumber: pr.number, prUrl: pr.html_url };
}

/**
 * Create or update a file on a branch.
 */
async function upsertFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  const encoded = Buffer.from(content).toString('base64');

  // Check if file already exists (to get its SHA for update)
  let existingSha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if ('sha' in data) {
      existingSha = data.sha;
    }
  } catch {
    // File doesn't exist — that's fine
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: encoded,
    branch,
    sha: existingSha,
  });
}
