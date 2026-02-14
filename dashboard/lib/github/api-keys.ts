import { randomBytes, createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Generate a new API key for a GitHub App installation.
 * Stores the SHA-256 hash in Supabase; returns the plaintext key.
 */
export async function generateApiKey(installationId: number): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  const plaintext = `vlayer_live_${raw}`;
  const keyHash = createHash('sha256').update(plaintext).digest('hex');
  const keyPrefix = plaintext.slice(0, 16); // "vlayer_live_xxxx"

  const supabase = createAdminClient();

  // Deactivate any existing keys for this installation
  await supabase
    .from('api_keys')
    .update({ status: 'revoked' })
    .eq('installation_id', installationId)
    .eq('status', 'active');

  // Insert the new key
  const { error } = await supabase.from('api_keys').insert({
    installation_id: installationId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    status: 'active',
  });

  if (error) throw new Error(`Failed to store API key: ${error.message}`);

  return plaintext;
}

/**
 * Validate an API key by hashing it and looking it up in Supabase.
 */
export async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; installationId: number | null }> {
  if (!apiKey || !apiKey.startsWith('vlayer_live_')) {
    return { valid: false, installationId: null };
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('api_keys')
    .select('installation_id')
    .eq('key_hash', keyHash)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return { valid: false, installationId: null };
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash);

  return { valid: true, installationId: data.installation_id };
}
