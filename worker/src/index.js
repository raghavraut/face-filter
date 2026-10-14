const MAX_BYTES = 45 * 1024 * 1024;
const LINK_TTL = 604800;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'x-mira-key, content-type',
};
const VIDEO = new Set(['video/webm', 'video/mp4']);
const IMAGE = new Set(['image/jpeg', 'image/png']);

const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

function same(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const safeKey = key => typeof key === 'string' && key.length < 200 && !key.includes('..') && /^(segments|snapshots)\/[\w./-]+$/.test(key);

const signatureFor = async (env, key, expires) => (await hmac(env.UPLOAD_KEY, `${key}:${expires}`)).slice(0, 32);

const query = async (env, key) => {
  const expires = Math.floor(Date.now() / 1000) + LINK_TTL;
  return `?e=${expires}&s=${await signatureFor(env, key, expires)}`;
};

async function tokenValid(env, key, expires, signature) {
  if (!/^\d{10,}$/.test(expires) || Number(expires) * 1000 < Date.now()) return false;
  return same(await signatureFor(env, key, expires), signature);
}

async function telegram(env, method, fields) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(`telegram ${method}: ${payload.description}`);
}

async function telegramFile(env, method, caption, file) {
  const form = new FormData();
  form.set('chat_id', env.TELEGRAM_CHAT_ID);
  form.set('caption', caption.slice(0, 1024));
  if (method === 'sendVideo') form.set('supports_streaming', 'true');
  form.set(method === 'sendVideo' ? 'video' : 'document', new File([file.bytes], file.name, { type: file.type }));
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', body: form });
  const payload = await response.json();
  if (!payload.ok) throw new Error(`telegram ${method}: ${payload.description}`);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (!env.UPLOAD_KEY || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return reply({ error: 'relay secrets are not set' }, 503);

    const url = new URL(request.url);
    const suppliedKey = request.headers.get('x-mira-key');

    if (url.pathname === '/health') return same(suppliedKey, env.UPLOAD_KEY) ? reply({ ok: true }) : reply({ error: 'bad key' }, 401);

    if (url.pathname.startsWith('/footage/')) {
      const objectKey = decodeURIComponent(url.pathname.slice(9));
      const valid = safeKey(objectKey) && await tokenValid(env, objectKey, url.searchParams.get('e'), url.searchParams.get('s'));
      if (!valid) return reply({ error: 'invalid or expired link' }, 403);
      const object = await env.FOOTAGE.get(objectKey);
      if (!object) return reply({ error: 'not found' }, 404);
      return new Response(object.body, {
        headers: {
          'content-type': object.httpMetadata?.contentType || 'application/octet-stream',
          'cache-control': 'private, max-age=3600',
        },
      });
    }

    if (request.method !== 'POST') return reply({ error: 'method not allowed' }, 405);
    if (!same(suppliedKey, env.UPLOAD_KEY)) return reply({ error: 'bad key' }, 401);

    if (url.pathname === '/upload') {
      const snapshot = url.searchParams.get('kind') === 'snapshot';
      const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!(snapshot ? IMAGE : VIDEO).has(contentType)) return reply({ error: `unsupported type ${contentType || 'unknown'}` }, 415);
      if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return reply({ error: 'payload too large' }, 413);

      const bytes = new Uint8Array(await request.arrayBuffer());
      if (!bytes.length) return reply({ error: 'empty payload' }, 400);
      if (bytes.length > MAX_BYTES) return reply({ error: 'payload too large' }, 413);

      const extension = snapshot ? 'jpg' : contentType === 'video/mp4' ? 'mp4' : 'webm';
      const now = new Date();
      const objectKey = `${snapshot ? 'snapshots' : 'segments'}/${now.toISOString().slice(0, 10).replace(/-/g, '/')}/${now.getTime()}-${crypto.randomUUID()}.${extension}`;
      await env.FOOTAGE.put(objectKey, bytes, { httpMetadata: { contentType } });
      return reply({ key: objectKey, bytes: bytes.length, path: await query(env, objectKey) });
    }

    if (url.pathname === '/notify') {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') return reply({ error: 'invalid json' }, 400);
      const kind = body.kind === 'clip' ? 'clip' : body.kind === 'snapshot' ? 'snapshot' : 'text';
      const at = typeof body.at === 'string' ? body.at.slice(0, 64) : new Date().toISOString();
      const note = typeof body.note === 'string' ? body.note.slice(0, 200) : '';

      if (kind === 'text') {
        await telegram(env, 'sendMessage', { chat_id: env.TELEGRAM_CHAT_ID, text: `Mira is live.\nTime: ${at}` });
        return reply({ ok: true });
      }

      if (!safeKey(body.key)) return reply({ error: 'invalid key' }, 400);
      const object = await env.FOOTAGE.get(body.key);
      if (!object) return reply({ error: 'no such footage' }, 404);

      const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
      const bytes = await object.arrayBuffer();
      const label = kind === 'clip' ? 'Motion clip' : 'Motion snapshot';
      const caption = [
        `${label} detected.`,
        `Time: ${at}`,
        note && `Note: ${note}`,
        `Footage: ${url.origin}/footage/${body.key}${await query(env, body.key)}`,
      ].filter(Boolean).join('\n');

      if (bytes.byteLength > MAX_BYTES) {
        await telegram(env, 'sendMessage', { chat_id: env.TELEGRAM_CHAT_ID, text: caption });
        return reply({ ok: true, delivered: 'link' });
      }

      const method = kind === 'clip' && contentType === 'video/mp4' ? 'sendVideo' : 'sendDocument';
      await telegramFile(env, method, caption, { bytes, name: body.key.split('/').pop(), type: contentType });
      return reply({ ok: true, delivered: method });
    }

    return reply({ error: 'not found' }, 404);
  },
};