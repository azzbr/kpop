// Private messages over a broadcast-only room (Supabase broadcast / BroadcastChannel deliver
// every message to every device). Each device makes a throwaway ECDH key pair when a game
// mounts and sends its public key in its hello; the host seals a secret (an Imposter card, a
// Riddle Rush guess going the other way) with AES-GCM under the shared key, so only the two
// devices involved can read it. Nothing is stored; new keys every mount.
//
// WebCrypto only exists in secure contexts (https, localhost). On plain-http LAN testing
// `cryptoReady()` is false and callers fall back to plain messages addressed with `to`.

export interface KeyPair { priv: CryptoKey; pub: string }
export interface Sealed { iv: string; ct: string }

const subtle = (): SubtleCrypto | null => (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) || null;

export const cryptoReady = () => !!subtle();

const b64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const unb64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const ALG = { name: 'ECDH', namedCurve: 'P-256' } as const;

/** A fresh key pair (null without WebCrypto). */
export async function makeKeyPair(): Promise<KeyPair | null> {
  const s = subtle();
  if (!s) return null;
  try {
    const kp = await s.generateKey(ALG, false, ['deriveKey']) as CryptoKeyPair;
    const raw = await s.exportKey('raw', kp.publicKey);
    return { priv: kp.privateKey, pub: b64(raw) };
  } catch {
    return null;
  }
}

// Deriving is the slow part; the same pair of keys always gives the same AES key.
const cache = new WeakMap<CryptoKey, Map<string, Promise<CryptoKey>>>();

function sharedKey(priv: CryptoKey, theirPub: string): Promise<CryptoKey> {
  const s = subtle()!;
  let m = cache.get(priv);
  if (!m) { m = new Map(); cache.set(priv, m); }
  let k = m.get(theirPub);
  if (!k) {
    k = s.importKey('raw', unb64(theirPub), ALG, false, [])
      .then(pub => s.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
    m.set(theirPub, k);
    k.catch(() => m!.delete(theirPub));
  }
  return k;
}

/** Seal `text` so only the owner of `theirPub` can open it. */
export async function seal(mine: KeyPair, theirPub: string, text: string): Promise<Sealed> {
  const s = subtle()!;
  const key = await sharedKey(mine.priv, theirPub);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const ct = await s.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { iv: b64(iv), ct: b64(ct) };
}

/** Open a sealed message from the owner of `theirPub`; null if it isn't for us or is broken. */
export async function unseal(mine: KeyPair, theirPub: string, box: Sealed): Promise<string | null> {
  const s = subtle();
  if (!s) return null;
  try {
    const key = await sharedKey(mine.priv, theirPub);
    const pt = await s.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
