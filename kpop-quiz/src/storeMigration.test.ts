import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/save-v3.json';
import fixture4 from './__fixtures__/save-v4.json';
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
    for (const k of ['todCustom', 'pixelArt', 'agent', 'secretsFound', 'paperClash', 'clubs', 'teacher', 'goldStars']) expect(saved).toHaveProperty(k);
    expect(saved).not.toHaveProperty('teacherOn');
    expect(SAVE_VERSION).toBe(5);
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

// A real save captured from the v4 build (src/__fixtures__/save-v4.json).
describe('save migration v4 → v5', () => {
  it('keeps every v4 field', () => {
    expect(fixture4.version).toBe(4);
    const before = structuredClone(fixture4.state) as Record<string, unknown>;
    const after = migrateSave(structuredClone(fixture4.state), 4) as Record<string, unknown>;
    for (const [k, v] of Object.entries(before)) expect(after[k], k).toEqual(v);
  });

  it('loads with clubs, teacher and gold stars at their defaults', () => {
    useGameStore.setState({ clubs: [], teacher: null, goldStars: { lesson: '', inLesson: 0, total: 0 } });
    useGameStore.setState(migrateSave(structuredClone(fixture4.state), 4));
    const s = useGameStore.getState();
    expect(s.userName).toBe('Mia');
    expect(s.paperClash.style).toBe('classic');
    expect(s.todCustom).toHaveLength(1);
    expect(s.clubs).toEqual([]);
    expect(s.teacher).toBeNull();
    expect(s.teacherOn).toBe(false);
  });

  it('clubs: newest first, no duplicates, at most 3', () => {
    useGameStore.setState({ clubs: [] });
    const s = useGameStore.getState();
    for (const code of ['A-1', 'B-2', 'C-3', 'A-1', 'D-4']) s.joinClub({ code, name: code, emoji: '🦊' });
    expect(useGameStore.getState().clubs.map(c => c.code)).toEqual(['D-4', 'A-1', 'C-3']);
    s.leaveClub('A-1');
    expect(useGameStore.getState().clubs.map(c => c.code)).toEqual(['D-4', 'C-3']);
  });

  it('gold stars pay at most 3 times per lesson', () => {
    useGameStore.setState({ goldStars: { lesson: '', inLesson: 0, total: 0 }, userCurrency: 0 });
    const s = useGameStore.getState();
    expect([1, 2, 3, 4].map(() => s.receiveGoldStar('L1'))).toEqual([true, true, true, false]);
    expect(useGameStore.getState().userCurrency).toBe(15);
    expect(s.receiveGoldStar('L2')).toBe(true);
    expect(useGameStore.getState().goldStars.total).toBe(4);
  });

  it('teacher mode needs a teacher and turns off when the teacher is removed', () => {
    const s = useGameStore.getState();
    s.setTeacher(null);
    s.setTeacherOn(true);
    expect(useGameStore.getState().teacherOn).toBe(false);
    s.setTeacher({ name: 'Ms Patel', pinHash: 'x' });
    s.setTeacherOn(true);
    expect(useGameStore.getState().teacherOn).toBe(true);
    s.setTeacher(null);
    expect(useGameStore.getState().teacherOn).toBe(false);
  });
});
