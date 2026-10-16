// The teacher's 4-digit PIN is kept on this device only, as a SHA-256 hash. It's a lock against
// curious kids, not real security (anyone with the device's storage could reset it).

const SALT = 'funquest-teacher:';

export const isPin = (pin: string) => /^\d{4}$/.test(pin);

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + pin);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // No SubtleCrypto (very old browser or http): a simple FNV-1a hash.
  let h = 0x811c9dc5;
  for (const b of data) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return 'f' + h.toString(16);
}

export async function checkPin(pin: string, hash: string): Promise<boolean> {
  return isPin(pin) && (await hashPin(pin)) === hash;
}
