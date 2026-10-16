import { describe, it, expect } from 'vitest';
import { safeName, shownName, NAME_MAX } from './names';

describe('display names', () => {
  it('keeps normal first names tidy', () => {
    expect(safeName('  Mia  ')).toBe('Mia');
    expect(safeName('Ms  Patel')).toBe('Ms Patel');
    expect(safeName('Zoë')).toBe('Zoë');
    expect(safeName('Leo<script>')).toBe('Leoscript');
    expect(safeName('A very long name indeed').length).toBeLessThanOrEqual(NAME_MAX);
  });

  it('rejects rude, empty or number-only names', () => {
    for (const bad of ['', '   ', '1234', 'poop', 'Stupid Head', 'butt face']) expect(safeName(bad), bad).toBe('');
    expect(shownName('poop')).toBe('Player');
    expect(shownName('Mia')).toBe('Mia');
  });
});
