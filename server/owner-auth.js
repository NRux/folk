import { readContactInbox } from './contact-inbox.js';
import { readSubscriberInbox } from './subscriber-inbox.js';
import { createClient } from '@supabase/supabase-js';
import { readOwnerDashboard } from './owner-dashboard.js';
import { createEditorialClient } from './supabase.js';

const COOKIE = '__Host-folkly-owner';
const REFRESH_COOKIE = '__Host-folkly-owner-refresh';
const REMEMBER_AGE = 30 * 86400;
const reply = (status, message, headers = {}) => Response.json({ message }, { status, headers: { 'Cache-Control': 'private, no-store', 'Pragma':'no-cache', ...headers } });
const cookie = (token, age, name=COOKIE) => `${name}=${encodeURIComponent(token)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
function cookieValue(request,name) {
  const values = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  if (values.length !== 1) return '';
  try { return decodeURIComponent(values[0].slice(name.length + 1)); } catch { return ''; }
}
export const sessionToken=request=>cookieValue(request,COOKIE);
export const rememberedToken=request=>{const token=cookieValue(request,REFRESH_COOKIE);return /^[A-Za-z0-9._~+\/=-]{1,2048}$/.test(token)?token:'';};
function clearCookies(response){response.headers.append('Set-Cookie',cookie('',0));response.headers.append('Set-Cookie',cookie('',0,REFRESH_COOKIE));return response;}
const expiry=token=>{try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url')).exp;}catch{return 0;}};
const accessAge=expires=>Number.isFinite(expires)?Math.min(900,Math.max(0,Math.floor(expires-Date.now()/1000))):0;
const temporary=error=>Number(error?.status)>=500||Number(error?.status)===429||error?.name==='AuthRetryableFetchError';
function signedInReply(session,remember){
 const age=accessAge(session?.expires_at);if(!age)throw Error('Invalid session expiry');
 if(remember&&!/^[A-Za-z0-9._~+\/=-]{1,2048}$/.test(session?.refresh_token||''))throw Error('Session renewal unavailable');
 const response=Response.json({message:'Signed in.',expiresIn:age},{headers:{'Cache-Control':'private, no-store','Pragma':'no-cache'}});
 response.headers.append('Set-Cookie',cookie(session.access_token,age));
 response.headers.append('Set-Cookie',cookie(remember?session.refresh_token:'',remember?REMEMBER_AGE:0,REFRESH_COOKIE));
 return response;
}
export function createOwnerHandlers({ env = process.env, authClient, editorialClient, readDashboard = readOwnerDashboard, readContacts = readContactInbox, readSubscribers = readSubscriberInbox } = {}) {
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
    if(temporary(error))throw Error('Authentication unavailable');
    if (error || !data?.user?.id || data.user.email?.toLowerCase() !== env.FOLKLY_OWNER_EMAIL.toLowerCase()) return false;
    const row = await db.from('folkly_owners').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if(row.error)throw Error('Membership unavailable');
    if (row.data?.user_id !== data.user.id) return false;
    let sessionId;
    try { sessionId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).session_id; } catch { return false; }
    if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) return false;
    const active = await db.rpc('folkly_owner_session_active', { owner_user: data.user.id, session_uuid: sessionId });
    if(active.error)throw Error('Session verification unavailable');
    return active.data === true;
  }
  async function renew(request,auth,db){
    const token=sessionToken(request),refresh=rememberedToken(request);
    // Keep valid access short-lived. Refresh credentials only when needed.
    if(token&&accessAge(expiry(token))>60){
      if(!await owner(token,auth,db))return clearCookies(reply(401,'Owner sign-in required.'));
      const age=accessAge(expiry(token));
      return Response.json({message:'Signed in.',expiresIn:age},{headers:{'Cache-Control':'private, no-store','Pragma':'no-cache','Set-Cookie':cookie(token,age)}});
    }
    if(!refresh)return clearCookies(reply(401,'Sign in to remember this browser.'));
    const result=await auth.auth.refreshSession({refresh_token:refresh});
    if(result.error){if(temporary(result.error))return reply(503,'Saved sign-in could not be checked. Refresh to try again.');return clearCookies(reply(401,'Saved sign-in expired or was revoked. Request a new code.'));}
    const session=result.data?.session;
    if(!session||!await owner(session.access_token,auth,db))return clearCookies(reply(401,'Owner sign-in required.'));
    return signedInReply(session,true);
  }
  return {
    async authorize(request) {
      const token=sessionToken(request);if(!token)return null;
      const {auth,db}=clients();return await owner(token,auth,db)?{db}:null;
    },
    async POST(request) {
      if (request.headers.get('origin') !== new URL(request.url).origin) return reply(403, 'Use the Folkly owner page.');
      let loggingOut=false;
      try {
        if (Number(request.headers.get('content-length') || 0) > 2048) return reply(413, 'Request too large.');
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 2048) return reply(413, 'Request too large.');
        let data;
        try { data = JSON.parse(raw); } catch { return reply(400, 'Check the form and try again.'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, 'Check the form and try again.');
        loggingOut=data.action==='logout';
        const { auth, db } = clients();
        if(data.action==='refresh')return await renew(request,auth,db);
        if (data.action === 'logout') {
          let token = sessionToken(request);
          if(token&&!await owner(token,auth,db))token='';
          // An expired access cookie must not prevent revoking remembered access.
          if(!token&&rememberedToken(request)){
            const renewed=await auth.auth.refreshSession({refresh_token:rememberedToken(request)});
            if(temporary(renewed.error))return clearCookies(reply(503,'Session revocation could not be confirmed.'));
            token=renewed.data?.session?.access_token||'';
            if(token&&!await owner(token,auth,db))token='';
          }
          if (token) {
            const result = await db.auth.admin.signOut(token, 'global');
            if (result.error) return clearCookies(reply(503,'Session revocation could not be confirmed.'));
          }
          return clearCookies(reply(200,'Signed out.'));
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
          if(data.remember!==undefined&&typeof data.remember!=='boolean')return reply(400,'Check the remembered sign-in choice.');
          if (typeof data.code !== 'string' || !/^\d{6,10}$/.test(data.code)) return reply(400, 'Enter your sign-in code.');
          const result = await auth.auth.verifyOtp({ email, token: data.code, type: 'email' });
          const session = result.data?.session;
          if (result.error || !session) return reply(401, 'The sign-in code is invalid or expired. Request a new code.');
          if (!(await owner(session.access_token, auth, db))) return reply(403, 'This account does not have active owner access.');
          const age = Math.min(900, Math.max(0, Math.floor(session.expires_at - Date.now() / 1000)));
          if (!age) return reply(401, 'Sign-in code expired.');
          return signedInReply(session,data.remember===true);
        }
        return reply(400, 'Unknown action.');
      } catch (error) {
        if (error.message === 'Supabase project mismatch') {
          console.error('Owner Supabase project mismatch');
          const response=reply(503,'Vercel is connected to the wrong Supabase project. Connect the Folkly database before signing in.');return loggingOut?clearCookies(response):response;
        }
        console.error('Owner authentication unavailable');const response=reply(503,loggingOut?'Session revocation could not be confirmed.':'Owner sign-in is temporarily unavailable.');return loggingOut?clearCookies(response):response;
      }
    },
    async GET(request) {
      if (!sessionToken(request)) return reply(401, 'Sign in to view owner status.');
      try {
        const { auth, db } = clients();
        if (!(await owner(sessionToken(request), auth, db))) return reply(401, 'Owner sign-in required.', { 'Set-Cookie': cookie('', 0) });
        const params=new URL(request.url).searchParams;
        if(params.get('view')==='contacts') {
          const cursor=params.has('cursor')?params.get('cursor'):undefined;
          if(cursor!==undefined&&(cursor.length>2048||!/^[\x20-\x7e]+$/.test(cursor)))return reply(400,'Invalid inbox page. Return to the first page.');
          const contacts=await readContacts({env,cursor});
          return Response.json({owner:true,contacts},{headers:{'Cache-Control':'no-store'}});
        }
        if(params.get('view')==='subscribers') {
          const cursor=params.has('cursor')?params.get('cursor'):undefined;
          if(cursor!==undefined&&(cursor.length>2048||!/^[\x20-\x7e]+$/.test(cursor)))return reply(400,'Invalid subscriber page. Return to the first page.');
          const subscribers=await readSubscribers({env,cursor});
          return Response.json({owner:true,subscribers},{headers:{'Cache-Control':'no-store'}});
        }
        const result = await db.from('folkly_settings').select('key,value');
        if (result.error) throw Error('Storage unavailable');
        const switches = ['production.autonomous_enabled', 'publication.autonomous_enabled', 'schedule.enabled'];
        const dashboard = await readDashboard(db);
        return Response.json({ owner: true, dashboard, settings: Object.fromEntries(result.data.filter(r => switches.includes(r.key)).map(r => [r.key, r.value])) }, { headers: { 'Cache-Control': 'no-store' } });
      } catch { console.error('Owner status unavailable'); return reply(503, 'Owner status unavailable.'); }
    },
  };
}
