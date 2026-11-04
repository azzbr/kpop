import { describe, expect, it } from 'vitest';
import { applySave, collectKeys, CODE_PREFIX, decodeSave, encodeSave, SaveCodeError, STORE_KEY, summarize } from './saveTransfer';
import { detectPlatform } from './appInstall';

/** A tiny in-memory Storage (vitest runs in node). */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  quota = Infinity;
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) {
    const used = [...this.map.values()].reduce((n, x) => n + x.length, 0);
    if (used + v.length > this.quota) throw new Error('QuotaExceededError');
    this.map.set(k, String(v));
  }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const save = (state: Record<string, unknown>, version = 5) => JSON.stringify({ state, version });

describe('save codes', () => {
  const keys = {
    [STORE_KEY]: save({ userName: 'Mia', xp: 1234, userCurrency: 56, gameBadges: ['a', 'b'], earnedBadges: ['c'], datesPlayed: ['2026-11-01', '2026-11-02'] }),
    zip_best: '42',
    diary_list: JSON.stringify([{ id: 1, text: 'Dragons 🐉 and “quotes”' }]),
  };

  it('round-trips every key, emoji included', async () => {
    const code = await encodeSave(keys, new Date('2026-11-03T10:00:00Z'));
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    const bundle = await decodeSave(code);
    expect(bundle.keys).toEqual(keys);
    expect(bundle.at).toBe('2026-11-03T10:00:00.000Z');
  });

  it('survives spaces and line breaks added by messaging apps, and text around it', async () => {
    const code = await encodeSave(keys);
    const messy = `Here you go:\n${code.slice(0, 30)}\n  ${code.slice(30, 70)} ${code.slice(70)}\n`;
    expect((await decodeSave(messy)).keys).toEqual(keys);
  });

  it('compresses: a big save gives a much shorter code', async () => {
    const big = { [STORE_KEY]: save({ userName: 'Mia', playLog: Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`day${i}`, { seconds: 600, games: { paper_clash: 3 } }])) }) };
    const code = await encodeSave(big);
    expect(code.length).toBeLessThan(big[STORE_KEY].length / 3);
  });

  it('rejects text that is not a code, a cut-off code, and a code without progress', async () => {
    await expect(decodeSave('hello')).rejects.toBeInstanceOf(SaveCodeError);
    const code = await encodeSave(keys);
    await expect(decodeSave(code.slice(0, code.length / 2))).rejects.toBeInstanceOf(SaveCodeError);
    await expect(decodeSave(await encodeSave({ zip_best: '1' }))).rejects.toThrow(/no saved progress/);
  });
});

describe('summarize', () => {
  it('reads name, XP, coins, badges and days', () => {
    const s = summarize({ [STORE_KEY]: save({ userName: 'Mia', xp: 10, userCurrency: 3, gameBadges: ['x'], earnedBadges: ['y', 'z'], datesPlayed: ['d'] }, 4) });
    expect(s).toEqual({ name: 'Mia', xp: 10, coins: 3, badges: 3, days: 1, version: 4 });
  });
  it('copes with an empty or broken save', () => {
    expect(summarize({})).toBeNull();
    expect(summarize({ [STORE_KEY]: '{oops' })).toBeNull();
    expect(summarize({ [STORE_KEY]: save({}) })?.name).toBe('Player');
  });
});

describe('applySave', () => {
  it('replaces the old progress (old keys that the code lacks are removed) and keeps test markers', () => {
    const st = new MemoryStorage();
    st.setItem(STORE_KEY, save({ userName: 'Old' }));
    st.setItem('wordladder_solved', '[1,2]');
    st.setItem('__e2e', 'keep');
    applySave(st, { [STORE_KEY]: save({ userName: 'New' }), zip_best: '9' });
    expect(collectKeys(st)).toEqual({ [STORE_KEY]: save({ userName: 'New' }), zip_best: '9' });
    expect(st.getItem('__e2e')).toBe('keep');
  });

  it('puts the old progress back when storage runs out part way', () => {
    const st = new MemoryStorage();
    st.setItem(STORE_KEY, save({ userName: 'Old' }));
    st.quota = 200;
    expect(() => applySave(st, { [STORE_KEY]: save({ userName: 'New' }), huge: 'x'.repeat(500) })).toThrow();
    st.quota = Infinity;
    expect(collectKeys(st)).toEqual({ [STORE_KEY]: save({ userName: 'Old' }) });
  });
});

describe('detectPlatform', () => {
  it('tells iPhone, iPad (desktop-style UA), Android and computers apart', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari', 0)).toBe('desktop');
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130', 5)).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', 0)).toBe('desktop');
  });
});

describe('game content keys travel with the save code', () => {
  it('Robo Quest stars and saved programs (robo_stars, robo_code) are included; __ keys are not', () => {
    const s = new MemoryStorage();
    s.setItem('robo_stars', '{"g01":3,"f11":2}');
    s.setItem('robo_code', '{"g01":[{"t":"forward"},{"t":"forward"}]}');
    s.setItem('__e2e_init', '1');
    const k = collectKeys(s);
    expect(k.robo_stars).toBe('{"g01":3,"f11":2}');
    expect(k.robo_code).toBe('{"g01":[{"t":"forward"},{"t":"forward"}]}');
    expect(k.__e2e_init).toBeUndefined();
  });
});
