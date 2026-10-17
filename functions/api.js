// Finanzübersicht — data API as a Cloudflare Pages Function, served at /api on the
// same address as the app. That way the Cloudflare Access login protecting the site
// covers the data too (same origin: the Access cookie is sent, no CORS pre-check).
//
// Pages project binding required:  KV namespace → variable name FINANZ_KV
//   (Settings → Bindings; set it for Production AND Preview)
//
// Defense in depth: every request must carry a valid Cloudflare Access token
// (Cf-Access-Jwt-Assertion header, added by Access after login). The signature, the
// audience (this Access application) and the expiry are verified. If Access is ever
// misconfigured or switched off, the data stays locked instead of becoming public.
//
// Configuration (Pages → Settings → Variables and Secrets; set for Production AND Preview).
// Both ACCESS_* values are required — without them the API refuses every request:
//   ACCESS_TEAM_DOMAIN  e.g. "myteam.cloudflareaccess.com"
//   ACCESS_AUD          Application Audience (AUD) tag of the Access application
//   ACCESS_DISABLED     "true" to skip the check (NOT recommended; only for setups without Access)

const KEY = 'finanz_data';

let certCache = { at: 0, keys: null, team: null };

const b64urlToBytes = s => {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4);
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};
const b64urlToJson = s => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function accessKeys(team) {
  if (certCache.keys && certCache.team === team && Date.now() - certCache.at < 60 * 60 * 1000) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('certs ' + r.status);
  const { keys } = await r.json();
  certCache = { at: Date.now(), keys, team };
  return keys;
}

async function verifyAccess(request, env) {
  if (env.ACCESS_DISABLED === 'true') return { ok: true, email: null };
  const team = (env.ACCESS_TEAM_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const aud  = (env.ACCESS_AUD || '').trim();
  if (!team || !aud) return { ok: false, config: true,
    why: 'ACCESS_TEAM_DOMAIN and ACCESS_AUD must be set in the Pages project (Settings → Variables and Secrets)' };
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, why: 'no Access token' };
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) return { ok: false, why: 'malformed token' };
  const header = b64urlToJson(h), payload = b64urlToJson(p);
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return { ok: false, why: 'token expired' };
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return { ok: false, why: 'wrong audience' };
  if (payload.iss && payload.iss !== `https://${team}`) return { ok: false, why: 'wrong issuer' };
  let keys = await accessKeys(team);
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) { certCache.keys = null; keys = await accessKeys(team); jwk = keys.find(k => k.kid === header.kid); }
  if (!jwk) return { ok: false, why: 'unknown key' };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  return valid ? { ok: true, email: payload.email || null } : { ok: false, why: 'bad signature' };
}

const json = (body, status = 200) => new Response(body, {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export async function onRequest({ request, env }) {
  let auth;
  try { auth = await verifyAccess(request, env); } catch (e) { return json(JSON.stringify({ error: 'auth check failed' }), 503); }
  if (!auth.ok && auth.config) return json(JSON.stringify({ error: 'not configured', reason: auth.why }), 500);
  if (!auth.ok) return json(JSON.stringify({ error: 'unauthorized', reason: auth.why }), 401);
  if (!env.FINANZ_KV) return json(JSON.stringify({ error: 'KV binding FINANZ_KV missing in Pages settings' }), 500);

  if (request.method === 'GET') {
    const data = await env.FINANZ_KV.get(KEY);
    return json(data ?? 'null');
  }
  if (request.method === 'POST') {
    const body = await request.text();
    try { JSON.parse(body); } catch { return json(JSON.stringify({ error: 'invalid JSON' }), 400); }
    await env.FINANZ_KV.put(KEY, body);
    return new Response('OK', { headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
}
