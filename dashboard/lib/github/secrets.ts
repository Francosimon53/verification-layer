import type { Octokit } from '@octokit/rest';
import sodium from 'libsodium-wrappers';

/**
 * Inject a repository secret using GitHub's encrypted secrets API.
 * Returns true on success, false on failure (e.g. 403/404).
 */
export async function injectRepoSecret(
  octokit: Octokit,
  owner: string,
  repo: string,
  secretName: string,
  secretValue: string
): Promise<boolean> {
  try {
    // Get the repo's public key for encrypting secrets
    const { data: pubKeyData } = await octokit.actions.getRepoPublicKey({
      owner,
      repo,
    });

    // Encrypt the secret value with libsodium sealed box
    await sodium.ready;
    const binKey = sodium.from_base64(pubKeyData.key, sodium.base64_variants.ORIGINAL);
    const binSecret = sodium.from_string(secretValue);
    const encryptedBytes = sodium.crypto_box_seal(binSecret, binKey);
    const encryptedValue = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

    // Store the encrypted secret
    await octokit.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: secretName,
      encrypted_value: encryptedValue,
      key_id: pubKeyData.key_id,
    });

    return true;
  } catch (err: any) {
    console.error(`[secrets] Failed to inject ${secretName} into ${owner}/${repo}:`, err.status ?? err.message);
    return false;
  }
}
