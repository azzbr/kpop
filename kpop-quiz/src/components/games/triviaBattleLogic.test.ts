import { describe, expect, it } from 'vitest';
import { createRng } from '../../games/engine/rng';
import { quizSources } from '../../online/quiz/sources';
import type { QuizQuestion } from '../../data/quiz/types';
import { battleScore, battleSources, buildDeck, buzz, leader, toBattleQ, usable, ROUNDS, KIND_MISS } from './triviaBattleLogic';
import type { BattleQ } from './triviaBattleLogic';

const q: BattleQ = { text: 'Q', options: ['a', 'b', 'c', 'd'], correct: 2 };

describe('triviaBattleLogic', () => {
  it('keeps only choice and true/false questions', () => {
    const qs: QuizQuestion[] = [
      { type: 'choice', text: 'a', options: ['x', 'y'], correct: 1 },
      { type: 'truefalse', text: 'b', options: ['True', 'False'], correct: 0 },
      { type: 'type', text: 'c', answers: ['z'] },
      { type: 'order', text: 'd', options: ['1', '2'] },
      { type: 'poll', text: 'e', options: ['1', '2'] },
    ];
    expect(qs.filter(usable).map(x => x.text)).toEqual(['a', 'b']);
  });

  it('shuffles choice options but keeps the right answer right', () => {
    const src: QuizQuestion = { type: 'choice', text: 'Capital of France?', options: ['Paris', 'Rome', 'Oslo', 'Bern'], correct: 0 };
    for (let s = 1; s < 30; s++) {
      const b = toBattleQ(src, createRng(s));
      expect(b.options[b.correct]).toBe('Paris');
      expect([...b.options].sort()).toEqual(['Bern', 'Oslo', 'Paris', 'Rome']);
    }
    const tf = toBattleQ({ type: 'truefalse', text: 't', options: ['True', 'False'], correct: 1 }, createRng(3));
    expect(tf.options).toEqual(['True', 'False']);
    expect(tf.correct).toBe(1);
  });

  it('deals a fresh deck with no repeats, different each game', () => {
    const mix = quizSources()[0];
    expect(mix.title).toBe('Mega Mix');
    const a = buildDeck(mix.questions(), ROUNDS, createRng(1));
    const b = buildDeck(mix.questions(), ROUNDS, createRng(2));
    expect(a).toHaveLength(ROUNDS);
    expect(new Set(a.map(x => x.text)).size).toBe(ROUNDS);
    expect(a.map(x => x.text)).not.toEqual(b.map(x => x.text));
  });

  it('offers Mega Mix, topic banks and the Music sources', () => {
    const ids = battleSources(quizSources()).map(s => s.id);
    expect(ids[0]).toBe('bank:mix');
    expect(ids).toContain('music:easy');
    expect(ids.length).toBeGreaterThan(5);
    for (const s of battleSources(quizSources())) expect(buildDeck(s.questions(), ROUNDS, createRng(7)).length).toBeGreaterThanOrEqual(5);
  });

  it('first correct buzz wins the point', () => {
    const r = buzz(q, [null, null], 1, 2);
    expect(r.outcome).toEqual({ kind: 'point', player: 1 });
  });

  it('a wrong buzz locks out only that player', () => {
    const r1 = buzz(q, [null, null], 0, 0);
    expect(r1.outcome).toEqual({ kind: 'miss', player: 0 });
    expect(buzz(q, r1.answers, 0, 2).outcome.kind).toBe('ignored');
    expect(buzz(q, r1.answers, 1, 2).outcome).toEqual({ kind: 'point', player: 1 });
    expect(buzz(q, r1.answers, 1, 3).outcome.kind).toBe('both_missed');
  });

  it('scores and words', () => {
    expect(leader([3, 5])).toBe(1);
    expect(leader([4, 4])).toBeNull();
    expect(battleScore([7, 2])).toBe(7);
    for (const line of KIND_MISS) expect(line).not.toMatch(/nope|wrong|💀|💩/i);
  });
});
