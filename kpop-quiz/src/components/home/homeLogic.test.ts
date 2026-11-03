import { describe, it, expect } from 'vitest';
import type { GameState } from '../../store';
import { pickSurpriseGame, pushRecent, toggleIn } from './homeLogic';

describe('recent games', () => {
  it('puts the newest first, drops duplicates and keeps 6', () => {
    let list: GameState[] = [];
    for (const id of ['paper_clash', 'game_2048', 'locker', 'paper_clash'] as GameState[]) list = pushRecent(list, id);
    expect(list).toEqual(['paper_clash', 'locker', 'game_2048']);
    const many: GameState[] = ['paper_clash', 'snake_arena', 'game_2048', 'block_blast', 'quiz_arena', 'emoji_guess', 'zip_game'];
    expect(many.reduce<GameState[]>((l, id) => pushRecent(l, id), [])).toEqual([...many].reverse().slice(0, 6));
  });
});

describe('favourites', () => {
  it('toggles on and off, and stops at the cap', () => {
    let fav = toggleIn([], 'snake_arena');
    expect(fav).toEqual(['snake_arena']);
    fav = toggleIn(fav, 'game_2048');
    expect(fav).toEqual(['snake_arena', 'game_2048']);
    expect(toggleIn(fav, 'snake_arena')).toEqual(['game_2048']);
    expect(toggleIn(['paper_clash', 'snake_arena'], 'game_2048', 2)).toEqual(['paper_clash', 'snake_arena']);
  });
});

describe('Surprise Me', () => {
  const visible = ['paper_clash', 'game_2048', 'truth_or_dare'] as GameState[];

  it('returns null with nothing to pick', () => {
    expect(pickSurpriseGame([], {}, [])).toBeNull();
  });

  it('can pick every visible game', () => {
    const seen = new Set<GameState | null>();
    for (let i = 0; i < 70; i++) seen.add(pickSurpriseGame(visible, {}, [], () => i / 70));
    expect(seen).toEqual(new Set(visible));
  });

  it('makes unmastered games she has not opened lately 3× as likely', () => {
    // paper_clash: 0★ and not recent → weight 3; game_2048: 3★ → 1; truth_or_dare: no stars → 1. Total 5.
    const scores = { game_2048: 9000 };
    const count = (rec: GameState[]) => {
      const c: Record<string, number> = {};
      for (let i = 0; i < 500; i++) {
        const g = pickSurpriseGame(visible, scores, rec, () => (i + 0.5) / 500)!;
        c[g] = (c[g] ?? 0) + 1;
      }
      return c;
    };
    expect(count([])).toEqual({ paper_clash: 300, game_2048: 100, truth_or_dare: 100 });
    // Opened lately → back to a normal chance.
    for (const n of Object.values(count(['paper_clash']))) expect(Math.abs(n - 500 / 3)).toBeLessThanOrEqual(1);
  });
});
