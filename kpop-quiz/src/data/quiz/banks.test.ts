import { describe, it, expect } from 'vitest';
import { QUIZ_BANKS, getBank } from './index';

const TARGETS: Record<string, number> = {
  general: 45,
  science: 45,
  geography: 45,
  animals: 45,
  sport: 40,
  truefalse: 45,
  order: 25,
};

describe('quiz banks', () => {
  it('have unique ids and can be looked up', () => {
    const ids = QUIZ_BANKS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getBank(id)?.id).toBe(id);
    expect(getBank('nope')).toBeUndefined();
  });

  it('each bank has at least its target number of questions', () => {
    for (const [id, n] of Object.entries(TARGETS)) {
      const bank = getBank(id);
      expect(bank, id).toBeDefined();
      expect(bank!.questions.length, id).toBeGreaterThanOrEqual(n);
    }
  });

  for (const bank of QUIZ_BANKS) {
    describe(bank.id, () => {
      it('has a title and emoji', () => {
        expect(bank.title.trim()).not.toBe('');
        expect(bank.emoji.trim()).not.toBe('');
      });

      it('question texts are non-empty, ≤110 chars and unique', () => {
        const seen = new Set<string>();
        for (const q of bank.questions) {
          expect(q.text.trim(), q.text).not.toBe('');
          expect(q.text.length, q.text).toBeLessThanOrEqual(110);
          const key = q.text.trim().toLowerCase();
          expect(seen.has(key), `duplicate: ${q.text}`).toBe(false);
          seen.add(key);
        }
      });

      it('every question is well formed for its type', () => {
        for (const q of bank.questions) {
          const label = `${bank.id}: ${q.text}`;
          switch (q.type) {
            case 'choice': {
              const opts = q.options ?? [];
              expect(opts.length, label).toBe(4);
              expect(new Set(opts.map(o => o.trim().toLowerCase())).size, label).toBe(4);
              for (const o of opts) {
                expect(o.trim(), label).not.toBe('');
                expect(o.length, `${label} -> ${o}`).toBeLessThanOrEqual(28);
              }
              expect(q.correct, label).toBe(0);
              break;
            }
            case 'truefalse':
              expect(q.options, label).toEqual(['True', 'False']);
              expect([0, 1], label).toContain(q.correct);
              break;
            case 'type':
              expect(q.answers?.length ?? 0, label).toBeGreaterThan(0);
              for (const a of q.answers!) expect(a.trim(), label).not.toBe('');
              break;
            case 'order': {
              const items = q.options ?? [];
              expect(items.length, label).toBeGreaterThanOrEqual(3);
              expect(items.length, label).toBeLessThanOrEqual(5);
              expect(new Set(items.map(i => i.trim().toLowerCase())).size, label).toBe(items.length);
              for (const i of items) {
                expect(i.trim(), label).not.toBe('');
                expect(i.length, `${label} -> ${i}`).toBeLessThanOrEqual(28);
              }
              break;
            }
            default:
              throw new Error(`Unexpected question type in ${label}: ${q.type}`);
          }
          if (q.fact !== undefined) expect(q.fact.trim(), label).not.toBe('');
        }
      });
    });
  }

  it('the True or False bank is all true/false and roughly balanced', () => {
    const tfBank = getBank('truefalse')!;
    expect(tfBank.questions.every(q => q.type === 'truefalse')).toBe(true);
    const trues = tfBank.questions.filter(q => q.correct === 0).length;
    const ratio = trues / tfBank.questions.length;
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it('the Order It bank is all order questions', () => {
    expect(getBank('order')!.questions.every(q => q.type === 'order')).toBe(true);
  });
});
