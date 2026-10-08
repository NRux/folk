import { createClient } from '@supabase/supabase-js';
import { createEditorialClient } from './supabase.js';

const COOKIE = '__Host-folkly-owner';
const reply = (status, message, headers = {}) => Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const cookie = (token, age) => `${COOKIE}=${encodeURIComponent(token)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
export function sessionToken(request) {
  const values = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return '';
  try { return decodeURIComponent(values[0].slice(COOKIE.length + 1)); } catch { return ''; }
}
export function createOwnerHandlers({ env = process.env, authClient, editorialClient } = {}) {
  function clients() {
    if (!env.FOLKLY_OWNER_EMAIL || !env.SUPABASE_URL || !(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)) throw Error('Configuration missing');
    if (new URL(env.SUPABASE_URL).hostname !== 'vxmyggasjgsiohqzzwzh.supabase.co') throw Error('Supabase project mismatch');
    return {
      auth: authClient || createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
      db: editorialClient || createEditorialClient(env),
    };
  }
  async function owner(token, auth, db) {
    if (!token || token.length > 8192) return false;
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data?.user?.id || data.user.email?.toLowerCase() !== env.FOLKLY_OWNER_EMAIL.toLowerCase()) return false;
    const row = await db.from('folkly_owners').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (row.error || row.data?.user_id !== data.user.id) return false;
    let sessionId;
    try { sessionId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).session_id; } catch { return false; }
    if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) return false;
    const active = await db.rpc('folkly_owner_session_active', { owner_user: data.user.id, session_uuid: sessionId });
    return !active.error && active.data === true;
  }
  return {
    async POST(request) {
      if (request.headers.get('origin') !== new URL(request.url).origin) return reply(403, 'Use the Folkly owner page.');
      try {
        if (Number(request.headers.get('content-length') || 0) > 2048) return reply(413, 'Request too large.');
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 2048) return reply(413, 'Request too large.');
        let data;
        try { data = JSON.parse(raw); } catch { return reply(400, 'Check the form and try again.'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, 'Check the form and try again.');
        const { auth, db } = clients();
        if (data.action === 'logout') {
          const token = sessionToken(request);
          if (token) {
            const result = await db.auth.admin.signOut(token, 'global');
            if (result.error) return reply(503, 'Session revocation could not be confirmed.', { 'Set-Cookie': cookie('', 0) });
          }
          return reply(200, 'Signed out.', { 'Set-Cookie': cookie('', 0) });
        }
        const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
        if (email !== env.FOLKLY_OWNER_EMAIL.toLowerCase()) return reply(200, 'If this is the owner account, check your email.');
        if (data.action === 'login') {
          const result = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
          if (result.error) {
            const code = /^[a-z_]{1,80}$/.test(result.error.code || '') ? result.error.code : 'unknown';
            console.error('Owner OTP request failed', { code, status: Number(result.error.status) || 0 });
            if (result.error.status === 429 || code.includes('rate_limit')) return reply(429, 'Too many code requests. Wait a minute before trying again.', { 'Retry-After': '60' });
            if (['email_address_not_authorized', 'email_provider_disabled', 'unexpected_failure'].includes(code)) return reply(503, 'Sign-in email could not be sent. Check the Supabase email provider configuration.');
            return Response.json({ message: 'Sign-in could not send a code. Check the owner account and Supabase email configuration.', errorCode: code }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
          }
          return reply(200, 'Check your email for the sign-in code.');
        }
        if (data.action === 'verify') {
          if (typeof data.code !== 'string' || !/^\d{6,10}$/.test(data.code)) return reply(400, 'Enter your sign-in code.');
          const result = await auth.auth.verifyOtp({ email, token: data.code, type: 'email' });
          const session = result.data?.session;
          if (result.error || !session) return reply(401, 'The sign-in code is invalid or expired. Request a new code.');
          if (!(await owner(session.access_token, auth, db))) return reply(403, 'This account does not have active owner access.');
          const age = Math.min(900, Math.max(0, Math.floor(session.expires_at - Date.now() / 1000)));
          if (!age) return reply(401, 'Sign-in code expired.');
          return reply(200, 'Signed in.', { 'Set-Cookie': cookie(session.access_token, age) });
        }
        return reply(400, 'Unknown action.');
      } catch (error) {
        if (error.message === 'Supabase project mismatch') {
          console.error('Owner Supabase project mismatch');
          return reply(503, 'Vercel is connected to the wrong Supabase project. Connect the Folkly database before signing in.');
        }
        console.error('Owner authentication unavailable'); return reply(503, 'Owner sign-in is temporarily unavailable.');
      }
    },
    async GET(request) {
      if (!sessionToken(request)) return reply(401, 'Sign in to view owner status.');
      try {
        const { auth, db } = clients();
        if (!(await owner(sessionToken(request), auth, db))) return reply(401, 'Owner sign-in required.', { 'Set-Cookie': cookie('', 0) });
        const result = await db.from('folkly_settings').select('key,value');
        if (result.error) throw Error('Storage unavailable');
        const switches = ['production.autonomous_enabled', 'publication.autonomous_enabled', 'schedule.enabled'];
        return Response.json({ owner: true, settings: Object.fromEntries(result.data.filter(r => switches.includes(r.key)).map(r => [r.key, r.value])) }, { headers: { 'Cache-Control': 'no-store' } });
      } catch { console.error('Owner status unavailable'); return reply(503, 'Owner status unavailable.'); }
    },
  };
}
