import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/save-v3.json';
import { migrateSave, partializeSave, useGameStore, SAVE_VERSION, DEFAULT_EQUIPPED } from './store';

// A real save captured from the v3 build (src/__fixtures__/save-v3.json).
describe('save migration v3 → v4', () => {
  it('keeps every v3 field and adds the v4 defaults', () => {
    expect(fixture.version).toBe(3);
    const before = structuredClone(fixture.state) as Record<string, unknown>;
    const after = migrateSave(structuredClone(fixture.state), fixture.version) as Record<string, unknown>;
    for (const [k, v] of Object.entries(before)) {
      if (k === 'equipped') continue;
      expect(after[k], k).toEqual(v);
    }
    expect(after.equipped).toEqual({ ...DEFAULT_EQUIPPED, ...(before.equipped as object) });
    expect((after.equipped as { avatar: string }).avatar).toBe('🦊');
    expect(after.todCustom).toEqual([]);
    expect(after.pixelArt).toEqual([]);
    expect(after.agent).toEqual({ solvedIds: [], solved: 0 });
    expect(after.secretsFound).toEqual([]);
    expect(after.paperClash).toEqual({ style: 'new' });
  });

  it('round-trips: the migrated save loads into the store with progress intact', () => {
    const migrated = migrateSave(structuredClone(fixture.state), 3);
    useGameStore.setState(migrated);
    const s = useGameStore.getState();
    expect(s.userName).toBe('Mia');
    expect(s.highScores.paper_clash).toBe(123);
    expect(s.inventory).toContain('rare_star');
    expect(s.myQuizzes).toHaveLength(1);
    expect(s.parent.breakMinutes).toBe(30);
  });

  it('never saves the current screen or secretReturn', () => {
    useGameStore.setState({ gameState: 'doodle_pad', secretReturn: 'welcome' });
    const saved = partializeSave(useGameStore.getState()) as Record<string, unknown>;
    expect(saved).not.toHaveProperty('secretReturn');
    expect(saved).not.toHaveProperty('gameState');
    for (const k of ['todCustom', 'pixelArt', 'agent', 'secretsFound', 'paperClash']) expect(saved).toHaveProperty(k);
    expect(SAVE_VERSION).toBe(4);
  });

  it('openSecret / leaveSecret return to where the screen was opened from', () => {
    const s = useGameStore.getState();
    s.openSecret('sticker_board', 'welcome');
    expect(useGameStore.getState().gameState).toBe('sticker_board');
    useGameStore.getState().leaveSecret();
    expect(useGameStore.getState().gameState).toBe('welcome');
    useGameStore.getState().leaveSecret();
    expect(useGameStore.getState().gameState).toBe('secret_menu');
  });
});
