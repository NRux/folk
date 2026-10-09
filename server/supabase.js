import { createClient } from '@supabase/supabase-js';

export function createEditorialClient(env = process.env, factory = createClient) {
  if (typeof window !== 'undefined') throw new Error('Editorial client is server-only');
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is missing');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/') throw new Error('Invalid Supabase URL');
  if (key.startsWith('sb_publishable_') || key === env.SUPABASE_ANON_KEY || key === env.SUPABASE_PUBLISHABLE_KEY) throw new Error('Editorial writes require a server credential');
  if (!key.startsWith('sb_secret_')) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
    if (role !== 'service_role') throw new Error('Editorial writes require a server credential');
  }
  return factory(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function readEditorialSettings(client = createEditorialClient()) {
  const { data, error } = await client.from('folkly_settings').select('key,value');
  if (error) throw new Error('Editorial database query failed');
  return Object.fromEntries((data || []).map(row => [row.key, row.value]));
}

// Membership is stored privately, not taken from user-editable JWT metadata.
export async function requireFolklyOwner(request, client = createEditorialClient()) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return false;
  const token = authorization.slice(7);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) return false;
  const membership = await client.from('folkly_owners').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return !membership.error && membership.data?.user_id === data.user.id;
}
