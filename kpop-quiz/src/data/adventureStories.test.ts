import { describe, it, expect } from 'vitest';
import { ADVENTURE_STORIES, endingsOf, isValidPath, pathText, type AdventureStory } from './adventureStories';
import { isClean } from '../utils/cleanText';

const BANNED = /kpop|k-pop|idol|huntr|\bkill|\bdead\b|\bdie\b|\bblood|scary|monster|weapon|\bgun\b/i;

/** Every path from start to an ending (the graphs are small, so enumerate them all). */
function allPaths(story: AdventureStory): string[][] {
  const out: string[][] = [];
  const walk = (id: string, path: string[]) => {
    expect(path.includes(id), `${story.id}: loop at ${id}`).toBe(false);
    const node = story.nodes[id];
    const next = [...path, id];
    if (node.end) { out.push(next); return; }
    for (const ch of node.choices ?? []) walk(ch.to, next);
  };
  walk(story.start, []);
  return out;
}

describe('Adventure Diary stories', () => {
  it('has 8 stories with unique ids, titles and emojis', () => {
    expect(ADVENTURE_STORIES).toHaveLength(8);
    for (const key of ['id', 'title', 'emoji'] as const) {
      expect(new Set(ADVENTURE_STORIES.map(s => s[key])).size).toBe(8);
    }
  });

  for (const story of ADVENTURE_STORIES) {
    describe(story.title, () => {
      it('every node is a step with 2–3 valid choices or an ending', () => {
        expect(story.nodes[story.start]).toBeDefined();
        for (const [id, n] of Object.entries(story.nodes)) {
          expect(!!n.end !== !!n.choices, `${id} must be a step or an ending`).toBe(true);
          if (n.choices) {
            expect(n.choices.length, id).toBeGreaterThanOrEqual(2);
            expect(n.choices.length, id).toBeLessThanOrEqual(3);
            expect(new Set(n.choices.map(c => c.to)).size, `${id} has two choices to the same place`).toBe(n.choices.length);
            for (const c of n.choices) expect(story.nodes[c.to], `${id} → ${c.to}`).toBeDefined();
          }
        }
      });

      it('every node is reachable and every path reaches an ending in 3–5 choices', () => {
        const paths = allPaths(story);
        const seen = new Set(paths.flat());
        for (const id of Object.keys(story.nodes)) expect(seen.has(id), `${id} is unreachable`).toBe(true);
        for (const p of paths) {
          expect(p.length - 1, p.join(' → ')).toBeGreaterThanOrEqual(3);
          expect(p.length - 1, p.join(' → ')).toBeLessThanOrEqual(5);
          expect(isValidPath(story, p)).toBe(true);
          expect(pathText(story, p)).toHaveLength(p.length);
        }
      });

      it('has several endings, both happy and funny, with unique titles', () => {
        const ends = endingsOf(story);
        expect(ends.length).toBeGreaterThanOrEqual(4);
        expect(new Set(ends.map(([, n]) => n.end.title)).size).toBe(ends.length);
        expect(ends.some(([, n]) => n.end.kind === 'happy')).toBe(true);
        expect(ends.some(([, n]) => n.end.kind === 'funny')).toBe(true);
      });

      it('text is short, clean and G-rated', () => {
        const texts = [story.title, story.blurb, ...Object.values(story.nodes).flatMap(n => [
          n.text, ...(n.choices ?? []).map(c => c.label), ...(n.end ? [n.end.title] : []),
        ])];
        for (const t of texts) {
          expect(t.trim().length).toBeGreaterThan(0);
          expect(isClean(t), t).toBe(true);
          expect(t, t).not.toMatch(BANNED);
        }
        for (const n of Object.values(story.nodes)) {
          expect(n.text.length, n.text).toBeLessThanOrEqual(200);
          for (const c of n.choices ?? []) expect(c.label.length, c.label).toBeLessThanOrEqual(34);
        }
      });
    });
  }

  it('isValidPath rejects broken paths', () => {
    const s = ADVENTURE_STORIES[0];
    expect(isValidPath(s, [])).toBe(false);
    expect(isValidPath(s, [s.start])).toBe(false);
    expect(isValidPath(s, [s.start, 'end_tag'])).toBe(false);
  });
});
