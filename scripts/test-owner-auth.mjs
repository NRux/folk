import assert from 'node:assert/strict';
import { createOwnerHandlers, sessionToken } from '../server/owner-auth.js';
const env = { FOLKLY_OWNER_EMAIL: 'owner@example.com', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const sid = '00000000-0000-0000-0000-000000000001';
const token = `head.${Buffer.from(JSON.stringify({ session_id: sid })).toString('base64url')}.signature`;
let active = true, member = true, calls = 0;
const authClient = { auth: {
  signInWithOtp: async args => { calls++; assert.equal(args.options.shouldCreateUser, false); return {}; },
  verifyOtp: async () => ({ data: { session: { access_token: token, expires_at: Date.now()/1000+3600 } } }),
  getUser: async value => value === token ? { data: { user: { id: sid, email: env.FOLKLY_OWNER_EMAIL } } } : { error: true },
} };
const editorialClient = { auth: { admin: { signOut: async () => { active=false; return {}; } } },
  rpc: async (name, args) => { assert.equal(name, 'folkly_owner_session_active'); assert.equal(args.session_uuid,sid); return { data: active }; },
  from: name => ({ select: () => name === 'folkly_settings' ? Promise.resolve({ data: [{ key:'schedule.enabled',value:'false' }] }) : { eq: () => ({ maybeSingle: async () => ({ data: member ? {user_id:sid}:null }) }) } }),
};
const handlers = createOwnerHandlers({env,authClient,editorialClient});
const post = (body, origin='https://www.folkly.com', cookies='') => new Request('https://www.folkly.com/api/owner',{method:'POST',headers:{origin,'content-type':'application/json',cookie:cookies},body:JSON.stringify(body)});
assert.equal((await handlers.POST(post({action:'login',email:env.FOLKLY_OWNER_EMAIL},'https://evil.example'))).status,403);
assert.equal((await handlers.POST(post({action:'login',email:'other@example.com'}))).status,200); assert.equal(calls,0);
assert.equal((await handlers.POST(post({action:'login',email:env.FOLKLY_OWNER_EMAIL}))).status,200);assert.equal(calls,1);
const success=await handlers.POST(post({action:'verify',email:env.FOLKLY_OWNER_EMAIL,code:'123456'}));
assert.equal(success.status,200); assert.match(success.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict; Max-Age=900/);
assert(!(await success.text()).includes(token));
const cookies=`__Host-folkly-owner=${encodeURIComponent(token)}`;
const req=new Request('https://www.folkly.com/api/owner',{headers:{cookie:cookies}});
assert.equal((await handlers.GET(req)).status,200);
member=false;assert.equal((await handlers.GET(req)).status,401);member=true;
active=false;assert.equal((await handlers.GET(req)).status,401);active=true;
assert.equal((await handlers.GET(new Request(req.url))).status,401);
assert.equal(sessionToken(new Request(req.url,{headers:{cookie:`${cookies}; ${cookies}`}})),'');
assert.equal((await handlers.POST(post({action:'logout'},undefined,cookies))).status,200);
assert.equal((await handlers.GET(req)).status,401);
assert.equal((await createOwnerHandlers({env:{}}).POST(post({action:'login'}))).status,503);
console.log('Owner auth passed: invite-only OTP, origin denial, HttpOnly bounded session, private membership, revoked-session denial, logout, no token response, missing configuration.');
