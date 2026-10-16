import { describe, it, expect } from 'vitest';
import { makeKeyPair, seal, unseal, cryptoReady } from './sealed';

describe('sealed messages', () => {
  it('only the two devices involved can open a sealed message', async () => {
    expect(cryptoReady()).toBe(true);
    const host = (await makeKeyPair())!;
    const kid = (await makeKeyPair())!;
    const sneaky = (await makeKeyPair())!;
    const box = await seal(host, kid.pub, JSON.stringify({ word: 'Panda' }));
    expect(box.ct).not.toContain('Panda');
    expect(JSON.parse((await unseal(kid, host.pub, box))!)).toEqual({ word: 'Panda' });
    // Another player (with the host's public key, which everyone sees) can't read it.
    expect(await unseal(sneaky, host.pub, box)).toBeNull();
    // And the kid's reply to the host works the other way.
    const back = await seal(kid, host.pub, 'towel');
    expect(await unseal(host, kid.pub, back)).toBe('towel');
  });

  it('a broken message opens as null instead of throwing', async () => {
    const a = (await makeKeyPair())!;
    const b = (await makeKeyPair())!;
    expect(await unseal(a, b.pub, { iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA' })).toBeNull();
    expect(await unseal(a, 'not-a-key', { iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAA' })).toBeNull();
  });
});
