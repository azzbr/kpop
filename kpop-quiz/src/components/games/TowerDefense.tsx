import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameShell from '../../games/engine/GameShell';
import type { ShellStatus } from '../../games/engine/GameShell';
import { useGameLoop, useCanvasSize } from '../../games/engine/useGameLoop';
import { createRng } from '../../games/engine/rng';
import type { Rng } from '../../games/engine/rng';
import { useGameStore } from '../../store';
import { quizSources } from '../../online/quiz/sources';
import type { QuizSource } from '../../online/quiz/sources';
import { prepare, publicQuestion, toOriginal, isCorrect, correctText, shuffleIdx } from '../../online/quiz/quizLogic';
import type { PreparedQuestion } from '../../online/quiz/quizLogic';
import AnswerPad from '../quiz/AnswerPad';
import type { PadAnswer } from '../quiz/AnswerPad';
import { playClick, playCoin, playCorrect, playPop, playUnlock, playWrong } from '../../utils/sounds';
import {
  MAPS, COLS, ROWS, TICK_HZ, MAX_WAVES, TOWERS, TOWER_KINDS, ENEMIES,
  createWorld, step, startWave, placeTower, upgradeTower, upgradeCost, sellTower, sellValue,
  towerAt, tileFree, towerStats, enemyPos, applyAnswer, scoreOf, isBossWave, mapById,
} from './towerDefenseLogic';
import type { World, TowerKind, Difficulty, Pt } from './towerDefenseLogic';

const params = new URLSearchParams(window.location.search);
const DEBUG = params.has('debug');
const SEED = params.get('seed');
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const DIFFS: { id: Difficulty; label: string; emoji: string }[] = [
  { id: 'easy', label: 'Easy', emoji: '🌱' },
  { id: 'normal', label: 'Normal', emoji: '🌳' },
  { id: 'hard', label: 'Hard', emoji: '🔥' },
];

type Selection = { type: 'tile'; x: number; y: number; preview: TowerKind | null } | { type: 'tower'; id: number } | null;

interface Hud { hearts: number; coins: number; wave: number; cleared: number; phase: World['phase']; questionsLeft: number; streak: number }
interface Fx { kind: TowerKind | 'pop' | 'leak'; from?: Pt; hits: Pt[]; life: number; max: number; text?: string }
interface QuizState { prep: PreparedQuestion; shownAt: number; feedback: { ok: boolean; gain: number; answer: string; fact?: string } | null }

const hudOf = (w: World): Hud => ({
  hearts: w.hearts, coins: w.coins, wave: w.wave, cleared: w.cleared, phase: w.phase, questionsLeft: w.questionsLeft, streak: w.streak,
});

/** Shuffled questions from a source (polls have no right answer, so they are skipped). Own quizzes keep their order. */
function buildDeck(source: QuizSource, fallback: QuizSource, rng: Rng): PreparedQuestion[] {
  let all = source.questions().filter(q => q.type !== 'poll');
  if (!all.length) all = fallback.questions().filter(q => q.type !== 'poll');
  const order = source.group === 'My quizzes' ? all.map((_, i) => i) : shuffleIdx(all.length, rng);
  return order.map(i => prepare(all[i], rng));
}

export default function TowerDefense() {
  const myQuizzes = useGameStore(s => s.myQuizzes);
  const sources = useMemo(() => quizSources(myQuizzes), [myQuizzes]);
  const [sourceId, setSourceId] = useState(sources[0].id);
  const [mapId, setMapId] = useState(MAPS[0].id);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [status, setStatus] = useState<ShellStatus>('ready');
  const [round, setRound] = useState(0);
  const [hud, setHud] = useState<Hud>(() => hudOf(createWorld()));
  const [sel, setSel] = useState<Selection>(null);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [over, setOver] = useState({ score: 0, title: '', stopped: 0, cleared: 0, right: '0/0', streak: 0 });
  const source = sources.find(s => s.id === sourceId) ?? sources[0];

  const worldRef = useRef<World | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const quizRef = useRef(quiz);
  quizRef.current = quiz;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const selRef = useRef(sel);
  selRef.current = sel;
  const holdRef = useRef(false);
  const deck = useRef<PreparedQuestion[]>([]);
  const deckPos = useRef(0);
  const rngRef = useRef<Rng>(createRng(1));
  const fx = useRef<Fx[]>([]);
  const pausedAt = useRef(0);
  const layout = useRef({ ox: 0, oy: 0, cs: 40 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(canvasRef);

  const sync = useCallback(() => { if (worldRef.current) setHud(hudOf(worldRef.current)); }, []);

  const nextQuestion = useCallback((): PreparedQuestion => {
    if (deckPos.current >= deck.current.length) {
      deck.current = buildDeck(source, sources[0], rngRef.current);
      deckPos.current = 0;
    }
    return deck.current[deckPos.current++];
  }, [source, sources]);

  const openQuiz = useCallback(() => {
    const w = worldRef.current;
    if (!w || w.questionsLeft <= 0) return;
    setSel(null);
    setQuiz({ prep: nextQuestion(), shownAt: Date.now(), feedback: null });
  }, [nextQuestion]);

  const start = useCallback(() => {
    const seed = SEED ? Number(SEED) : Math.floor(Math.random() * 1e9);
    rngRef.current = createRng(seed);
    deck.current = buildDeck(source, sources[0], rngRef.current);
    deckPos.current = 0;
    const w = createWorld({ mapId, difficulty });
    worldRef.current = w;
    fx.current = [];
    setSel(null);
    setSpeed(1);
    setHud(hudOf(w));
    setRound(r => r + 1);
    setStatus('playing');
    setQuiz({ prep: deck.current[deckPos.current++], shownAt: Date.now(), feedback: null });
  }, [source, sources, mapId, difficulty]);

  const finish = useCallback((w: World) => {
    const won = w.phase === 'won';
    setQuiz(null);
    setSel(null);
    setOver({
      score: scoreOf(w),
      title: won ? 'You defended the castle! 🏰' : `The critters got in on wave ${w.wave} — great try!`,
      stopped: w.stopped, cleared: w.cleared, right: `${w.correct}/${w.answered}`, streak: w.bestStreak,
    });
    setStatus('over');
  }, []);

  const tick = useCallback(() => {
    const w = worldRef.current;
    if (!w || statusRef.current !== 'playing' || quizRef.current || w.phase !== 'wave') return;
    let popped = false, leaked = false;
    for (let s = 0; s < speedRef.current && w.phase === 'wave'; s++) {
      step(w);
      for (const e of w.events) {
        if (e.type === 'shot') fx.current.push({ kind: e.kind, from: e.from, hits: e.hits, life: e.kind === 'archer' ? 5 : 9, max: e.kind === 'archer' ? 5 : 9 });
        else if (e.type === 'pop') { popped = true; fx.current.push({ kind: 'pop', hits: [{ x: e.x, y: e.y }], life: 18, max: 18, text: e.boss ? '🌟' : '💨' }); }
        else if (e.type === 'leak') { leaked = true; fx.current.push({ kind: 'leak', hits: [{ x: e.x, y: e.y }], life: 30, max: 30, text: `-${e.hearts} ❤️` }); }
      }
    }
    if (popped) playPop();
    if (leaked) playWrong();
    // step() changes the phase, which TypeScript can't see through the early return above.
    const phase = w.phase as World['phase'];
    if (phase !== 'wave' || popped || leaked || w.tick % 6 === 0) sync();
    if (phase === 'won' || phase === 'lost') { finish(w); return; }
    if (phase === 'build') {
      playUnlock();
      if (w.questionsLeft > 0) openQuiz();
    }
  }, [sync, finish, openQuiz]);

  // ------------------------------------------------------------------ drawing

  const draw = useCallback((alpha: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const { w: cw, h: ch, dpr } = size.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    const w = worldRef.current;
    const map = w?.map ?? mapById(mapId);
    const cs = Math.max(10, Math.floor(Math.min((cw - 8) / COLS, (ch - 8) / ROWS)));
    const ox = Math.round((cw - cs * COLS) / 2);
    const oy = Math.round((ch - cs * ROWS) / 2);
    layout.current = { ox, oy, cs };
    const X = (x: number) => ox + x * cs;
    const Y = (y: number) => oy + y * cs;
    const road = w?.road;

    // Grass + road tiles
    ctx.save();
    roundRect(ctx, ox, oy, cs * COLS, cs * ROWS, cs * 0.3);
    ctx.clip();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const isRoad = road ? road.has(y * COLS + x) : false;
        ctx.fillStyle = isRoad ? map.road : shade(map.grass, (x + y) % 2 ? 0.08 : 0);
        ctx.fillRect(X(x), Y(y), cs + 0.5, cs + 0.5);
      }
    }
    if (!road) {
      // Ready screen: preview the chosen map's road.
      ctx.strokeStyle = map.road;
      ctx.lineWidth = cs;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      map.waypoints.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x + 0.5), Y(p.y + 0.5)));
      ctx.stroke();
    }
    // Dashed centre line
    ctx.strokeStyle = 'rgba(120,80,40,0.35)';
    ctx.lineWidth = Math.max(2, cs * 0.06);
    ctx.setLineDash([cs * 0.2, cs * 0.25]);
    ctx.beginPath();
    map.waypoints.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.x + 0.5), Y(p.y + 0.5)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const end = map.waypoints[map.waypoints.length - 1];
    const first = map.waypoints[1] ?? map.waypoints[0];
    const startCell = { x: Math.max(0, Math.min(COLS - 1, map.waypoints[0].x + Math.sign(first.x - map.waypoints[0].x))), y: Math.max(0, Math.min(ROWS - 1, map.waypoints[0].y + Math.sign(first.y - map.waypoints[0].y))) };
    ctx.font = `${cs * 0.55}px ${EMOJI_FONT}`;
    ctx.fillText('🚩', X(startCell.x + 0.25), Y(startCell.y + 0.2));
    ctx.font = `${cs * 0.9}px ${EMOJI_FONT}`;
    ctx.fillText('🏰', X(end.x + 0.5), Y(end.y + 0.5));
    if (!w) return;

    // Selected tile / range circle
    const s = selRef.current;
    let ring: { x: number; y: number; r: number; color: string } | null = null;
    if (s?.type === 'tile') {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      roundRect(ctx, X(s.x) + 2, Y(s.y) + 2, cs - 4, cs - 4, cs * 0.2);
      ctx.stroke();
      if (s.preview) ring = { x: s.x, y: s.y, r: TOWERS[s.preview].levels[0].range, color: TOWERS[s.preview].color };
    } else if (s?.type === 'tower') {
      const t = w.towers.find(t => t.id === s.id);
      if (t) ring = { x: t.x, y: t.y, r: towerStats(t).range, color: TOWERS[t.kind].color };
    }

    // Towers
    for (const t of w.towers) {
      const def = TOWERS[t.kind];
      const kick = t.shots > 0 && t.cooldown > towerStats(t).cooldown - 4 ? 1 : 0;
      ctx.fillStyle = shade(def.color, -0.45);
      roundRect(ctx, X(t.x) + cs * 0.08, Y(t.y) + cs * 0.08, cs * 0.84, cs * 0.84, cs * 0.22);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = `${cs * (0.55 + kick * 0.06)}px ${EMOJI_FONT}`;
      ctx.fillText(def.emoji, X(t.x + 0.5), Y(t.y + 0.45));
      ctx.font = `bold ${Math.max(10, cs * 0.2)}px Nunito, sans-serif`;
      ctx.fillStyle = '#fde047';
      ctx.fillText('★'.repeat(t.level), X(t.x + 0.5), Y(t.y + 0.83));
    }

    if (ring) {
      ctx.fillStyle = hexA(ring.color, 0.15);
      ctx.strokeStyle = hexA(ring.color, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(ring.x + 0.5), Y(ring.y + 0.5), ring.r * cs, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (s?.type === 'tile' && s.preview) {
        ctx.globalAlpha = 0.7;
        ctx.font = `${cs * 0.55}px ${EMOJI_FONT}`;
        ctx.fillText(TOWERS[s.preview].emoji, X(s.x + 0.5), Y(s.y + 0.5));
        ctx.globalAlpha = 1;
      }
    }

    // Enemies (furthest along drawn last, on top)
    const a = statusRef.current === 'playing' && !quizRef.current ? alpha : 1;
    const sorted = [...w.enemies].sort((p, q) => p.dist - q.dist);
    for (const e of sorted) {
      const def = ENEMIES[e.kind];
      const p = enemyPos(w, e, a);
      const px = X(p.x), py = Y(p.y);
      const bob = Math.sin((w.tick + a) * 0.35 + e.id) * cs * 0.04;
      if (e.slowTicks > 0) {
        ctx.fillStyle = 'rgba(125,211,252,0.45)';
        ctx.beginPath();
        ctx.arc(px, py, cs * def.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = `${cs * def.size * 0.75}px ${EMOJI_FONT}`;
      ctx.fillText(def.emoji, px, py + bob);
      if (e.hp < e.maxHp) {
        const bw = cs * def.size * 0.8, bh = Math.max(4, cs * 0.08);
        const bx = px - bw / 2, by = py - cs * def.size * 0.5 - bh;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#4ade80' : e.hp / e.maxHp > 0.25 ? '#facc15' : '#f87171';
        ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
      }
    }

    // Effects
    for (const f of fx.current) {
      const k = f.life / f.max;
      ctx.globalAlpha = Math.max(0, k);
      if (f.kind === 'archer' && f.from) {
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(X(f.from.x), Y(f.from.y));
        ctx.lineTo(X(f.hits[0].x), Y(f.hits[0].y));
        ctx.stroke();
      } else if (f.kind === 'bubble' || f.kind === 'freeze') {
        ctx.fillStyle = f.kind === 'bubble' ? 'rgba(244,114,182,0.5)' : 'rgba(186,230,253,0.6)';
        ctx.strokeStyle = f.kind === 'bubble' ? '#f9a8d4' : '#e0f2fe';
        ctx.lineWidth = 2;
        for (const h of f.hits) {
          ctx.beginPath();
          ctx.arc(X(h.x), Y(h.y), cs * (0.25 + (1 - k) * 0.35), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (f.kind === 'zapper' && f.from) {
        ctx.strokeStyle = '#ddd6fe';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(X(f.from.x), Y(f.from.y));
        let last = f.from;
        for (const h of f.hits) {
          const mx = (last.x + h.x) / 2 + (((f.life * 7 + h.x * 13) % 5) - 2.5) * 0.06;
          const my = (last.y + h.y) / 2 + (((f.life * 11 + h.y * 17) % 5) - 2.5) * 0.06;
          ctx.lineTo(X(mx), Y(my));
          ctx.lineTo(X(h.x), Y(h.y));
          last = h;
        }
        ctx.stroke();
      } else if (f.text) {
        const h = f.hits[0];
        const rise = (1 - k) * cs * 0.6;
        if (f.kind === 'leak') {
          ctx.font = `bold ${Math.max(16, cs * 0.4)}px Fredoka One, Nunito, sans-serif`;
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.fillStyle = '#fca5a5';
          ctx.strokeText(f.text, X(h.x), Y(h.y) - rise - cs * 0.4);
          ctx.fillText(f.text, X(h.x), Y(h.y) - rise - cs * 0.4);
        } else {
          ctx.font = `${cs * 0.5}px ${EMOJI_FONT}`;
          ctx.fillText(f.text, X(h.x), Y(h.y) - rise);
        }
      }
      // Effects fade with real frames only while the game is moving.
      if (statusRef.current === 'playing' && !quizRef.current) f.life -= 0.5 * speedRef.current;
    }
    ctx.globalAlpha = 1;
    fx.current = fx.current.filter(f => f.life > 0);
  }, [size, mapId]);

  const pause = useCallback(() => {
    if (statusRef.current === 'playing') { pausedAt.current = Date.now(); setStatus('paused'); }
  }, []);
  const resume = useCallback(() => {
    const q = quizRef.current;
    if (q && pausedAt.current) setQuiz({ ...q, shownAt: q.shownAt + (Date.now() - pausedAt.current) });
    setStatus('playing');
  }, []);

  useGameLoop({
    tickHz: TICK_HZ,
    update: () => { if (!holdRef.current) tick(); },
    draw,
    running: status === 'playing' && !quiz && hud.phase === 'wave',
    onHidden: pause,
  });

  // ------------------------------------------------------------------ input

  const onPointerDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const w = worldRef.current;
    if (!w || status !== 'playing') return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const { ox, oy, cs } = layout.current;
    const x = Math.floor((ev.clientX - rect.left - ox) / cs);
    const y = Math.floor((ev.clientY - rect.top - oy) / cs);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) { setSel(null); return; }
    const t = towerAt(w, x, y);
    if (t) { playClick(); setSel(sel?.type === 'tower' && sel.id === t.id ? null : { type: 'tower', id: t.id }); return; }
    if (tileFree(w, x, y)) {
      playClick();
      setSel(sel?.type === 'tile' && sel.x === x && sel.y === y ? null : { type: 'tile', x, y, preview: sel?.type === 'tile' ? sel.preview : null });
      return;
    }
    setSel(null);
  };

  const build = (kind: TowerKind) => {
    const w = worldRef.current;
    if (!w || sel?.type !== 'tile') return;
    const t = placeTower(w, sel.x, sel.y, kind);
    if (t) { playCoin(); setSel({ type: 'tower', id: t.id }); sync(); }
  };

  const upgrade = (id: number) => {
    const w = worldRef.current;
    if (w && upgradeTower(w, id)) { playUnlock(); sync(); }
  };

  const sell = (id: number) => {
    const w = worldRef.current;
    if (w && sellTower(w, id)) { playCoin(); setSel(null); sync(); }
  };

  const go = () => {
    const w = worldRef.current;
    if (w && startWave(w)) { playClick(); setSel(null); sync(); }
  };

  const submit = useCallback((pad: PadAnswer) => {
    const w = worldRef.current;
    const q = quizRef.current;
    if (!w || !q || q.feedback || statusRef.current !== 'playing') return;
    const ok = isCorrect(q.prep.q, toOriginal(q.prep, pad)) === true;
    const gain = applyAnswer(w, ok, Date.now() - q.shownAt);
    if (ok) {
      playCorrect();
      playCoin();
      useGameStore.setState(s => ({ totalCorrectAnswers: s.totalCorrectAnswers + 1 }));
      useGameStore.getState().checkAndAwardBadges();
    } else playWrong();
    setQuiz({ ...q, feedback: { ok, gain, answer: correctText(q.prep.q), fact: q.prep.q.fact } });
    sync();
  }, [sync]);

  const closeQuiz = () => { playClick(); setQuiz(null); };
  const another = () => { playClick(); openQuiz(); };

  // Debug hook for automated tests: ?debug&seed=42 exposes the world and a step function.
  useEffect(() => {
    if (!DEBUG) return;
    const api = {
      get world() { return worldRef.current; },
      get status() { return statusRef.current; },
      start,
      hold: (on = true) => { holdRef.current = on; },
      step: (n = 1) => { for (let i = 0; i < n && statusRef.current === 'playing'; i++) tick(); sync(); },
      placeTower: (x: number, y: number, kind: TowerKind) => { const w = worldRef.current; const t = w ? placeTower(w, x, y, kind) : null; sync(); return t; },
      giveCoins: (n: number) => { if (worldRef.current) { worldRef.current.coins += n; sync(); } },
      startWave: () => { const w = worldRef.current; const ok = w ? startWave(w) : false; sync(); return ok; },
      closeQuiz: () => setQuiz(null),
    };
    (window as unknown as { __game: typeof api }).__game = api;
    return () => { delete (window as unknown as { __game?: unknown }).__game; };
  }, [start, tick, sync]);

  // ------------------------------------------------------------------ UI

  const w = worldRef.current;
  const selTower = sel?.type === 'tower' && w ? w.towers.find(t => t.id === sel.id) ?? null : null;
  const nextWave = hud.wave + 1;
  const chip = (on: boolean) => `min-h-[44px] px-3 rounded-xl font-fredoka text-base ${on ? 'bg-fuchsia-500' : 'bg-white/10'}`;
  const pub = quiz ? publicQuestion(quiz.prep) : null;

  return (
    <GameShell
      gameId="tower_defense"
      title="Quiz Tower Defense"
      icon="🏰"
      xpScale={40}
      status={status}
      score={over.score}
      round={round}
      overTitle={over.title}
      overStats={[
        { label: 'Waves survived', value: `${over.cleared}/${MAX_WAVES}` },
        { label: 'Critters stopped', value: String(over.stopped) },
        { label: 'Right answers', value: over.right },
        { label: 'Best streak', value: `🔥 ${over.streak}` },
      ]}
      onStart={start}
      onPause={pause}
      onResume={resume}
      readyContent={
        <div className="text-left font-nunito text-base text-violet-100 space-y-3 max-h-[50dvh] overflow-y-auto pr-1">
          <ul className="space-y-1">
            <li>📝 Answer questions to earn 💰 — fast answers and streaks earn more!</li>
            <li>🏗️ Tap a grass tile to build a tower. Tap a tower to upgrade or sell it.</li>
            <li>🐌 Stop the critters before they reach your 🏰. You have 10 ❤️.</li>
            <li>🐢 A Big Turtle comes every 5th wave. Survive {MAX_WAVES} waves to win!</li>
          </ul>
          <div>
            <div className="font-fredoka text-lg mb-1">Map</div>
            <div className="grid grid-cols-3 gap-2">
              {MAPS.map(m => (
                <button key={m.id} onClick={() => { playClick(); setMapId(m.id); }} className={`${chip(mapId === m.id)} py-2 leading-tight`}>
                  <div className="text-2xl">{m.emoji}</div>{m.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-fredoka text-lg mb-1">Difficulty</div>
            <div className="grid grid-cols-3 gap-2">
              {DIFFS.map(d => (
                <button key={d.id} onClick={() => { playClick(); setDifficulty(d.id); }} className={`${chip(difficulty === d.id)} min-h-[48px] text-lg`}>{d.emoji} {d.label}</button>
              ))}
            </div>
          </div>
          <div className="font-fredoka text-lg">Questions</div>
          {(['Topics', 'My quizzes', 'School', 'Music'] as const).map(g => {
            const list = sources.filter(s => s.group === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <div className="font-nunito text-sm text-violet-300 mb-1">{g}</div>
                <div className="flex flex-wrap gap-2">
                  {list.map(s => <button key={s.id} onClick={() => setSourceId(s.id)} className={chip(sourceId === s.id)}>{s.emoji} {s.title}</button>)}
                </div>
              </div>
            );
          })}
        </div>
      }
    >
      <div className="absolute inset-0 flex flex-col game-surface">
        {/* HUD */}
        <div className="flex flex-wrap items-center gap-2 px-2 py-2 bg-black/25">
          <span className="rounded-full bg-black/40 px-3 py-2 font-fredoka text-xl">❤️ {hud.hearts}</span>
          <span className="rounded-full bg-black/40 px-3 py-2 font-fredoka text-xl text-yellow-300">💰 {hud.coins}</span>
          <span className="rounded-full bg-black/40 px-3 py-2 font-fredoka text-lg">
            🌊 Wave {Math.max(1, hud.phase === 'build' ? Math.min(nextWave, MAX_WAVES) : hud.wave)}/{MAX_WAVES}
            {hud.phase === 'build' && isBossWave(nextWave) && <span className="text-orange-300"> · 🐢 Boss!</span>}
          </span>
          {hud.streak >= 2 && <span className="rounded-full bg-orange-500/80 px-3 py-2 font-fredoka text-lg">🔥 {hud.streak}</span>}
          <div className="flex-1" />
          <button onClick={() => { playClick(); openQuiz(); }} disabled={hud.questionsLeft <= 0 || status !== 'playing'}
            className="min-h-[48px] px-4 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 font-fredoka text-lg disabled:opacity-40">
            📝 Answer to earn ({hud.questionsLeft})
          </button>
          {hud.phase === 'wave' && (
            <button onClick={() => { playClick(); setSpeed(s => (s === 1 ? 2 : 1)); }}
              className={`min-h-[48px] min-w-[64px] px-3 rounded-full font-fredoka text-lg ${speed === 2 ? 'bg-orange-500' : 'bg-white/15'}`}>
              ⏩ ×{speed}
            </button>
          )}
          {hud.phase === 'build' && (
            <button onClick={go} disabled={status !== 'playing'}
              className="min-h-[48px] px-5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 font-fredoka text-xl shadow-lg">
              ▶ Start wave {nextWave}
            </button>
          )}
        </div>

        {/* Map */}
        <div className="relative flex-1 min-h-0">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none" onPointerDown={onPointerDown} />
        </div>

        {/* Context panel */}
        <div className="min-h-[112px] px-2 py-2 bg-black/30">
          {sel?.type === 'tile' ? (
            <div className="flex flex-wrap gap-2 items-stretch">
              {TOWER_KINDS.map(k => {
                const def = TOWERS[k];
                const afford = hud.coins >= def.cost;
                const on = sel.preview === k;
                return (
                  <button key={k} onClick={() => { playClick(); if (on && afford) build(k); else setSel({ ...sel, preview: k }); }}
                    className={`flex-1 min-w-[130px] min-h-[96px] rounded-2xl px-2 py-2 font-fredoka text-center border-2
                      ${on ? 'border-yellow-300 bg-white/25' : 'border-transparent bg-white/10'} ${afford ? '' : 'opacity-60'}`}>
                    <div className="text-3xl">{def.emoji}</div>
                    <div className="text-base leading-tight">{def.name}</div>
                    <div className={`text-base ${afford ? 'text-yellow-300' : 'text-rose-300'}`}>💰 {def.cost}</div>
                    <div className="font-nunito text-sm text-violet-200">{on ? (afford ? 'Tap again to build!' : 'Need more 💰') : def.blurb}</div>
                  </button>
                );
              })}
              <button onClick={() => { playClick(); setSel(null); }} className="min-w-[56px] min-h-[96px] rounded-2xl bg-white/10 text-2xl" aria-label="Close">✕</button>
            </div>
          ) : selTower ? (() => {
            const def = TOWERS[selTower.kind];
            const st = towerStats(selTower);
            const cost = upgradeCost(selTower);
            const nextSt = cost !== null ? def.levels[selTower.level] : null;
            return (
              <div className="flex flex-wrap gap-2 items-stretch">
                <div className="flex-1 min-w-[180px] rounded-2xl bg-white/10 px-3 py-2">
                  <div className="font-fredoka text-xl">{def.emoji} {def.name} <span className="text-yellow-300">{'★'.repeat(selTower.level)}</span></div>
                  <div className="font-nunito text-base text-violet-100">
                    Power {st.damage} · Range {st.range}{st.splash ? ' · Splash' : ''}{st.slow ? ` · Slow ${Math.round(st.slow * 100)}%` : ''}{st.chain ? ` · Chains ${st.chain}` : ''}
                  </div>
                  {nextSt && <div className="font-nunito text-sm text-green-300">Next: power {nextSt.damage}, range {nextSt.range}{nextSt.slow ? `, slow ${Math.round(nextSt.slow * 100)}%` : ''}{nextSt.chain ? `, chains ${nextSt.chain}` : ''}</div>}
                </div>
                <button onClick={() => upgrade(selTower.id)} disabled={cost === null || hud.coins < cost}
                  className="min-w-[130px] min-h-[80px] rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 font-fredoka text-lg disabled:opacity-40">
                  {cost === null ? '⭐ Max level' : <>⬆ Upgrade<div className="text-yellow-200">💰 {cost}</div></>}
                </button>
                <button onClick={() => sell(selTower.id)}
                  className="min-w-[110px] min-h-[80px] rounded-2xl bg-white/15 font-fredoka text-lg">
                  Sell<div className="text-yellow-300">+💰 {sellValue(selTower)}</div>
                </button>
                <button onClick={() => { playClick(); setSel(null); }} className="min-w-[56px] min-h-[80px] rounded-2xl bg-white/10 text-2xl" aria-label="Close">✕</button>
              </div>
            );
          })() : (
            <div className="h-full min-h-[96px] flex items-center justify-center text-center font-nunito text-lg text-violet-100 px-2">
              {hud.phase === 'build'
                ? hud.coins >= 50 ? '👆 Tap a green tile to build a tower, then press ▶ Start wave!' : '📝 Answer questions to earn 💰 for towers!'
                : '👆 Tap a tile to build, or a tower to upgrade. Need 💰? Tap 📝 Answer to earn.'}
            </div>
          )}
        </div>

        {/* Quiz */}
        <AnimatePresence>
          {quiz && pub && status !== 'over' && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className="absolute inset-0 z-10 bg-indigo-950/95 overflow-y-auto px-3 py-3">
              <div className="max-w-3xl mx-auto">
                <div className="flex flex-wrap items-center gap-2 font-fredoka text-lg mb-2">
                  <span className="rounded-full bg-white/10 px-3 py-1">💰 {hud.coins}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1">📝 {hud.questionsLeft} left {hud.phase === 'wave' ? 'this wave' : 'this break'}</span>
                  {hud.streak >= 2 && <span className="rounded-full bg-orange-500/80 px-3 py-1">🔥 {hud.streak}</span>}
                  <div className="flex-1" />
                  {!quiz.feedback && (
                    <button onClick={closeQuiz} className="min-h-[44px] px-4 rounded-full bg-white/15 font-fredoka text-base">
                      {hud.phase === 'wave' ? '⚔️ Back to battle' : '🏗️ Skip — go build'}
                    </button>
                  )}
                </div>
                <div className="rounded-3xl bg-white text-slate-900 px-5 py-5 mb-4 text-center shadow-xl">
                  {pub.emoji && <div className="text-6xl mb-2">{pub.emoji}</div>}
                  <h2 className="font-fredoka text-2xl md:text-3xl leading-tight">{pub.text}</h2>
                </div>
                <AnimatePresence mode="wait">
                  {quiz.feedback ? (
                    <motion.div key="fb" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }}
                      className={`rounded-3xl p-5 text-center ${quiz.feedback.ok ? 'bg-green-600' : 'bg-rose-600'}`}>
                      <div className="text-5xl">{quiz.feedback.ok ? '🎉' : '💪'}</div>
                      <div className="font-fredoka text-3xl">{quiz.feedback.ok ? `Right! +${quiz.feedback.gain} 💰` : `Not quite — +${quiz.feedback.gain} 💰 for trying`}</div>
                      {!quiz.feedback.ok && quiz.feedback.answer && <div className="font-nunito text-lg">The answer was <b>{quiz.feedback.answer}</b></div>}
                      {quiz.feedback.fact && <div className="font-nunito text-base mt-2">💡 {quiz.feedback.fact}</div>}
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <button onClick={another} disabled={hud.questionsLeft <= 0}
                          className="min-h-[56px] rounded-full bg-white/25 font-fredoka text-xl disabled:opacity-40">
                          {hud.questionsLeft > 0 ? `📝 Next (${hud.questionsLeft})` : 'No more this round'}
                        </button>
                        <button onClick={closeQuiz} className="min-h-[56px] rounded-full bg-white text-indigo-900 font-fredoka text-xl">
                          {hud.phase === 'wave' ? '⚔️ Back to battle' : '🏗️ Build!'}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key={`q${quiz.shownAt}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                      <AnswerPad question={pub} onAnswer={submit} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GameShell>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amt: number) {
  const [r, g, b] = hexToRgb(hex).map(v => Math.round(Math.max(0, Math.min(255, v + v * amt))));
  return `rgb(${r},${g},${b})`;
}

function hexA(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
