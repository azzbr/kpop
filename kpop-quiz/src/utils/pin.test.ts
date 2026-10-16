import { describe, it, expect } from 'vitest';
import { hashPin, checkPin, isPin } from './pin';

describe('teacher PIN', () => {
  it('hashes, never stores the digits, and checks', async () => {
    const h = await hashPin('2580');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('2580');
    expect(await checkPin('2580', h)).toBe(true);
    expect(await checkPin('2581', h)).toBe(false);
    expect(await checkPin('25', h)).toBe(false);
  });
  it('only 4 digits are a PIN', () => {
    expect(isPin('1234')).toBe(true);
    for (const bad of ['123', '12345', 'abcd', '12 4']) expect(isPin(bad)).toBe(false);
  });
});
