const enc = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function cookieValue(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

export async function createSession(env, seconds = 8 * 60 * 60) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET não configurado.");
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds });
  const body = toBase64Url(enc.encode(payload));
  const sig = toBase64Url(await hmac(env.SESSION_SECRET, body));
  return `${body}.${sig}`;
}

export async function verifySession(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = cookieValue(request, "sb_session");
  if (!token || !token.includes(".")) return false;
  const [body, sig] = token.split(".");
  try {
    const expected = await hmac(env.SESSION_SECRET, body);
    const received = fromBase64Url(sig);
    if (received.byteLength !== expected.byteLength) return false;
    let diff = 0;
    for (let i = 0; i < received.byteLength; i++) diff |= received[i] ^ expected[i];
    if (diff !== 0) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    return Number(payload.exp || 0) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export function sessionCookie(value, maxAge = 8 * 60 * 60) {
  return `sb_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return "sb_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}
