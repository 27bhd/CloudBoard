const encoder = new TextEncoder();

const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // 32 symbols → no modulo bias over a byte

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Unguessable URL-safe secret (invite tokens, OAuth state). */
export function randomToken(byteLength = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** Short, sortable-enough public identifier (12 chars ≈ 60 bits). */
export function shortId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let id = '';
  for (const byte of bytes) id += ID_ALPHABET[byte % 32];
  return id;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/** Returns `value.signature`. */
export async function sign(secret: string, value: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), encoder.encode(value));
  return `${value}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the original value if the signature is valid, otherwise null. */
export async function unsign(secret: string, signed: string): Promise<string | null> {
  const split = signed.lastIndexOf('.');
  if (split < 1) return null;
  const value = signed.slice(0, split);
  let signature: Uint8Array;
  try {
    signature = fromBase64Url(signed.slice(split + 1));
  } catch {
    return null;
  }
  // subtle.verify compares in constant time.
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), signature, encoder.encode(value));
  return ok ? value : null;
}
