import { createHash } from 'node:crypto';

const reply = (status, message) => Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });
export function createSubscribeHandler({ configured, save }) {
  return async function handler(request) {
    if (request.method !== 'POST') return reply(405, 'Please use the subscription form.');
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return reply(403, 'Please subscribe from the Folkly website.');
    if (Number(request.headers.get('content-length') || 0) > 2048) return reply(413, 'The request is too large.');
    let data;
    try {
      const text = await request.text();
      if (Buffer.byteLength(text) > 2048) return reply(413, 'The request is too large.');
      const type = request.headers.get('content-type') || '';
      if (type.startsWith('application/json')) data = JSON.parse(text);
      else if (type.startsWith('application/x-www-form-urlencoded')) data = Object.fromEntries(new URLSearchParams(text));
      else return reply(415, 'Please use the subscription form.');
    } catch { return reply(400, 'Please check your email address and try again.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return reply(400, 'Please check your email address.');
    if (data.website) return reply(400, 'Please use the subscription form.');
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email) || data.consent !== 'yes') {
      return reply(400, 'Enter a valid email address and agree to receive Folkly emails.');
    }
    if (!configured()) return reply(503, 'Subscriptions are temporarily unavailable. Please try again later.');
    try {
      const id = createHash('sha256').update(email).digest('hex');
      await save(`subscribers/${id}.json`, { email, consent: true, consentVersion: '2026-10-07', subscribedAt: new Date().toISOString(), source: 'folkly-web' });
      return reply(200, 'Thank you. Your email is on the Folkly subscriber list.');
    } catch {
      console.error('Subscription storage failed');
      return reply(503, 'Could not save your subscription. Please try again later.');
    }
  };
}

export const POST = createSubscribeHandler({
  configured: () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN),
  save: async (path, record) => {
    const { put } = await import('@vercel/blob');
    await put(path, JSON.stringify(record), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  },
});
