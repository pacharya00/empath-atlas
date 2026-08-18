// Stateless signed-cookie session helpers, shared between the edge middleware
// and the /api/login route. Uses Web Crypto (crypto.subtle) rather than
// Node's `crypto` module so this also runs on the edge runtime.

const COOKIE_NAME = 'ea_auth';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET environment variable is not set.');
  return secret;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Token = "<expiryEpochSeconds>.<hmacHex>" — expiry is signed so it can't be
// tampered with, and there's no server-side session store to look up.
async function signToken(expiry) {
  const key = await hmacKey(getSecret());
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(expiry)));
  return `${expiry}.${toHex(sig)}`;
}

export async function createSessionToken() {
  const expiry = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  return signToken(expiry);
}

export async function verifySessionToken(token) {
  if (!token) return false;
  const [expiryStr, sig] = token.split('.');
  const expiry = parseInt(expiryStr, 10);
  if (!expiry || !sig) return false;
  if (Date.now() / 1000 > expiry) return false;
  const expected = await signToken(expiry);
  return expected === token;
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;
export const AUTH_COOKIE_MAX_AGE = MAX_AGE_SECONDS;
