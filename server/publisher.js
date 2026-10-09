import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

export function publisherClient(env = process.env, factory = createClient) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHER_TOKEN || !env.SUPABASE_PUBLISHABLE_KEY) throw Error('Scoped publisher configuration missing');
  const jwt = JSON.parse(Buffer.from(env.SUPABASE_PUBLISHER_TOKEN.split('.')[1], 'base64url').toString());
  if (jwt.role !== 'folkly_publisher' || !Number.isFinite(jwt.exp) || jwt.exp <= Date.now()/1000) throw Error('Scoped publisher credential required');
  return factory(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{global:{headers:{Authorization:`Bearer ${env.SUPABASE_PUBLISHER_TOKEN}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export function triggerAuthorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const incoming = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const left=Buffer.from(incoming),right=Buffer.from(expected);
  return left.length===right.length && timingSafeEqual(left,right);
}
export function pacificDate(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);
  const field = type => parts.find(p=>p.type===type).value;
  return `${field('year')}-${field('month')}-${field('day')}`;
}
export async function claimSlot(client, jobKey, at = new Date()) {
  const {data,error}=await client.rpc('folkly_claim_slot',{publication_date:pacificDate(at),job_key:jobKey});
  if(error)throw Error('Publication claim failed');
  return data;
}
// No public trigger or publication commit path exists until content/readback gates pass.
