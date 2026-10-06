import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoomApi } from '../../online/useRoom';
import { finishArenaGame } from '../../online/arenaRewards';
import { useHelloSync } from '../../online/boardSync';
import {
  PropertyDashGame, COLORS, COLOR_IDS, ACTION_INFO, NO_BUILD, SETS_TO_WIN, PLAYS_PER_TURN, HAND_LIMIT,
  bankTotal, groupComplete, groupLegit, fullSetCount, rentFor, payableCards,
} from '../../online/propertyDashLogic';
import type { Card, ColorId, ActionType, Table, PDState, PDMove } from '../../online/propertyDashLogic';
import { playClick, playCorrect, playWrong, playWin, playCoin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

// Property Dash: a 2–4 player property card game. The host runs the rules
// (online/propertyDashLogic.ts) and broadcasts the whole table; each device only
// shows its own hand. Every message starts with 'pd_'.

const MONEY_STYLE: Record<number, string> = {
  1: 'from-stone-100 to-stone-300 text-stone-700',
  2: 'from-rose-100 to-rose-300 text-rose-700',
  3: 'from-sky-100 to-sky-300 text-sky-700',
  4: 'from-violet-100 to-violet-300 text-violet-700',
  5: 'from-amber-100 to-amber-300 text-amber-700',
  10: 'from-yellow-200 to-amber-400 text-amber-900',
};
const RAINBOW = 'conic-gradient(#7e22ce, #38bdf8, #ec4899, #f97316, #dc2626, #facc15, #16a34a, #1e40af, #1f2937, #84cc16, #7e22ce)';

// ---------- Card visuals ----------

type Size = 'sm' | 'md' | 'lg';
const SZ: Record<Size, { box: string; head: string; name: string; big: string; small: string }> = {
  sm: { box: 'w-20 h-28', head: 'h-8 text-sm', name: 'text-sm', big: 'text-2xl', small: 'text-sm' },
  md: { box: 'w-32 h-44', head: 'h-9 text-sm', name: 'text-sm', big: 'text-3xl', small: 'text-sm' },
  lg: { box: 'w-60 h-80', head: 'h-14 text-2xl', name: 'text-2xl', big: 'text-6xl', small: 'text-lg' },
};

const ValueBadge: React.FC<{ v: number; size: Size }> = ({ v, size }) => (
  <span
    className={`absolute ${size === 'sm' ? 'bottom-1 right-1' : 'top-1 right-1'} rounded-full bg-white text-gray-900 font-fredoka font-bold shadow flex items-center justify-center border border-gray-300 ${
      size === 'lg' ? 'min-w-[44px] h-11 text-xl px-1.5' : 'min-w-[28px] h-7 text-sm px-1'
    }`}
  >
    {v}M
  </span>
);

const CardBack: React.FC = () => (
  <div className="w-14 h-20 text-xl rounded-lg bg-gradient-to-br from-indigo-600 via-purple-700 to-fuchsia-800 border-2 border-white/70 shadow-lg flex flex-col items-center justify-center text-white font-fredoka">
    <span>🏃</span>
    <span className="text-sm font-bold">DASH</span>
  </div>
);

const CardFace: React.FC<{ c: Card; size?: Size; assignedColor?: string }> = ({ c, size = 'md', assignedColor }) => {
  const z = SZ[size];
  const lg = size === 'lg';
  const frame = `${z.box} relative rounded-xl shadow-xl overflow-hidden flex flex-col border border-gray-300 select-none`;
  const asColor = assignedColor ? COLORS[assignedColor as ColorId] : null;
  const asTag = asColor && (
    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap ${z.small} font-bold rounded px-1.5 ${asColor.bg} ${asColor.text} border border-white/70`}>
      as {asColor.label}
    </span>
  );

  if (c.kind === 'property' && c.color) {
    const meta = COLORS[c.color];
    return (
      <div className={`${frame} bg-white text-gray-800`}>
        <div className={`${z.head} ${meta.bg} ${meta.text} flex items-center pl-1.5 ${size === 'sm' ? 'pr-1' : 'pr-9'} font-fredoka font-bold shrink-0 truncate`}>
          {meta.emoji} {meta.label}
        </div>
        <div className={`flex-1 flex items-center justify-center font-nunito font-bold text-center px-1 leading-tight ${z.name}`}>{c.name}</div>
        {lg ? (
          <div className="px-3 pb-3 space-y-1">
            {meta.rent.map((r, i) => (
              <div key={i} className={`flex justify-between rounded px-2 py-0.5 text-lg font-nunito ${i === meta.size - 1 ? 'bg-amber-200 text-amber-900 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                <span>{i === meta.size - 1 ? `★ Full set (${meta.size})` : `${i + 1} card${i > 0 ? 's' : ''}`}</span>
                <span>rent {r}M</span>
              </div>
            ))}
          </div>
        ) : size === 'md' ? (
          <div className={`text-center ${z.small} font-nunito text-gray-500 pb-1`}>set of {meta.size}</div>
        ) : (
          <div className="h-8" />
        )}
        <ValueBadge v={c.value} size={size} />
      </div>
    );
  }
  if (c.kind === 'wild') {
    if (c.any) {
      return (
        <div className={`${frame} items-center justify-center font-fredoka text-white`} style={{ background: RAINBOW }}>
          <span className={`${z.big} drop-shadow`}>🌈</span>
          <span className={`font-bold drop-shadow ${z.small} bg-black/50 rounded px-1.5`}>WILD · any</span>
          {lg && <span className="text-lg font-nunito mt-2 bg-black/50 rounded px-2 text-center">Fits any colour. Worth 0 — can't be banked or paid.</span>}
          {asTag}
        </div>
      );
    }
    const [a, b] = c.colors!;
    return (
      <div className={`${frame} bg-white`}>
        <div className={`h-1/2 ${COLORS[a].bg} ${COLORS[a].text} flex items-center justify-center font-fredoka font-bold ${z.name}`}>
          {COLORS[a].emoji} {COLORS[a].label}
        </div>
        <div className={`h-1/2 ${COLORS[b].bg} ${COLORS[b].text} flex items-center justify-center font-fredoka font-bold ${z.name}`}>
          {COLORS[b].emoji} {COLORS[b].label}
        </div>
        <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-gray-800 rounded-full font-fredoka font-bold shadow px-2 ${z.small}`}>
          WILD
        </span>
        <ValueBadge v={c.value} size={size} />
        {asTag}
      </div>
    );
  }
  if (c.kind === 'rent') {
    if (c.any) {
      return (
        <div className={`${frame} items-center justify-center font-fredoka text-white`} style={{ background: RAINBOW }}>
          <span className={`bg-black/55 rounded-lg px-2 py-0.5 font-bold ${lg ? 'text-3xl' : 'text-base'}`}>RENT</span>
          <span className={`bg-black/55 rounded px-1.5 mt-1 text-center leading-tight ${z.small}`}>any colour · 1 rival</span>
          <ValueBadge v={c.value} size={size} />
        </div>
      );
    }
    const [a, b] = c.colors!;
    return (
      <div className={`${frame} bg-white text-gray-800`}>
        <div className={`h-1/3 ${COLORS[a].bg} ${COLORS[a].text} flex items-center justify-center ${z.small} font-bold`}>{COLORS[a].emoji}{lg ? ` ${COLORS[a].label}` : ''}</div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className={`font-fredoka font-bold ${lg ? 'text-3xl' : 'text-base'}`}>RENT</span>
          <span className={`${z.small} font-nunito text-gray-600`}>all rivals pay</span>
        </div>
        <div className={`h-1/3 ${COLORS[b].bg} ${COLORS[b].text} flex items-center justify-center ${z.small} font-bold`}>{COLORS[b].emoji}{lg ? ` ${COLORS[b].label}` : ''}</div>
        <ValueBadge v={c.value} size={size} />
      </div>
    );
  }
  if (c.kind === 'money') {
    return (
      <div className={`${z.box} relative rounded-xl bg-gradient-to-br ${MONEY_STYLE[c.value] || MONEY_STYLE[1]} shadow-xl border-4 border-double border-white/80 flex flex-col items-center justify-center font-fredoka select-none`}>
        <span className={z.big}>💵</span>
        <span className={`font-bold ${lg ? 'text-5xl' : 'text-2xl'}`}>{c.value}M</span>
        <span className={`${z.small} font-nunito font-bold tracking-widest opacity-70`}>MONEY</span>
      </div>
    );
  }
  const info = ACTION_INFO[c.action!];
  return (
    <div className={`${frame} bg-gradient-to-br from-indigo-100 to-violet-200 text-indigo-900 border-indigo-300 items-center justify-center font-fredoka px-1.5 text-center`}>
      <span className={z.big}>{info.emoji}</span>
      <span className={`font-bold leading-tight ${lg ? 'text-2xl' : 'text-sm'}`}>{info.label}</span>
      {lg && <span className="text-lg font-nunito leading-snug mt-2 text-indigo-800">{info.desc}</span>}
      {c.value > 0 && <ValueBadge v={c.value} size={size} />}
    </div>
  );
};

// ---------- Component ----------

type ModalStep = 'main' | 'wildcolor' | 'rentcolor' | 'renttarget' | 'target' | 'prop' | 'myprop' | 'set';
type Zoom = { card: Card; color?: string; owner?: string };

type PdMsg = { from?: string; t: string; s?: PDState } & Record<string, unknown>;

const btn = 'min-h-[52px] rounded-2xl py-3 px-3 font-fredoka font-bold text-lg';
const backBtn = 'min-h-[48px] rounded-2xl py-2 font-fredoka text-lg bg-white/10 border border-white/20';

const PropertyDash: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;

  const [s, setS] = useState<PDState | null>(null);
  const [sel, setSel] = useState<Card | null>(null);
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [step, setStep] = useState<ModalStep>('main');
  const [target, setTarget] = useState<string | null>(null);
  const [theirProp, setTheirProp] = useState<number | null>(null);
  const [rentColor, setRentColor] = useState<string | null>(null);
  const [useDouble, setUseDouble] = useState(false);
  const [paySel, setPaySel] = useState<number[]>([]);
  const [discardSel, setDiscardSel] = useState<number[]>([]);
  const [flipCard, setFlipCard] = useState<Card | null>(null);
  const [tick, setTick] = useState(0);
  const [dealing, setDealing] = useState(false);
  const [reward, setReward] = useState<{ xp: number; coins: number } | null>(null);
  const rewarded = useRef(false);
  const synced = useRef(false);
  const timers = useRef<number[]>([]);

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  const hostApi = useRef<{ start: () => void; snapshot: () => void } | null>(null);
  useHelloSync(room, 'pd', {
    onStart: () => hostApi.current?.start(),
    onHello: () => hostApi.current?.snapshot(),
    synced: () => synced.current,
  });

  // ---- HOST: dealer & referee ----
  useEffect(() => {
    if (!isHost) return;
    const hostName = (id: string) => {
      const p = playersRef.current.find((x) => x.id === id);
      return p ? `${p.emoji} ${p.name}` : '👻 ???';
    };
    const game = new PropertyDashGame(players.slice(0, 4).map((p) => p.id), hostName);
    const broadcast = () => {
      if (game.dealt) send({ t: 'pd_state', s: game.snapshot() });
    };
    // ?debug: lets Playwright set up a near-finished table (window.__pd)
    if (new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as { __pd?: unknown }).__pd = { game, broadcast };
    }
    hostApi.current = {
      start: () => {
        game.deal(Date.now());
        broadcast();
      },
      snapshot: broadcast,
    };
    const sweep = window.setInterval(() => {
      if (game.sweep(Date.now())) broadcast();
    }, 700);
    const MOVES = ['pd_jsn', 'pd_pay', 'pd_discard', 'pd_flip', 'pd_end', 'pd_play'];
    const offMsg = onMessage((raw) => {
      if (!raw.from || !MOVES.includes(raw.t)) return;
      if (game.handle(raw.from, raw as unknown as PDMove, Date.now())) broadcast();
    });
    return () => {
      offMsg();
      window.clearInterval(sweep);
      hostApi.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE: state sync ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as PdMsg;
      if (m.t !== 'pd_state' || !m.s) return;
      const st = m.s;
      synced.current = true;
      setS((prev) => {
        if (!prev) {
          setDealing(true);
          [200, 500, 800, 1100, 1400].forEach((d) => timers.current.push(window.setTimeout(() => playPop(), d)));
          timers.current.push(window.setTimeout(() => setDealing(false), 2400));
        }
        const hadMine = prev?.pendings.some((p) => p.targetId === myId) || false;
        const hasMine = st.pendings.some((p) => p.targetId === myId);
        if (hasMine && !hadMine) playWrong();
        if (!st.pendings.some((p) => p.targetId === myId && p.phase === 'pay')) setPaySel([]);
        if (!st.discarding || st.discarding.pid !== myId) setDiscardSel([]);
        return st;
      });
      if (st.winner && st.ranked && !rewarded.current) {
        rewarded.current = true;
        const r = finishArenaGame(room, st.ranked);
        setReward({ xp: r.xp, coins: r.coins });
        if (st.winner === myId) playWin();
        setSel(null);
        setZoom(null);
        setFlipCard(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ticker for countdowns
  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(iv);
  }, []);
  void tick;

  const myHand = s?.hands[myId] || [];
  const isMyTurn = s?.turn === myId;
  const inGame = s ? s.order.includes(myId) : true;
  const opponents = s ? s.order.filter((id) => id !== myId) : [];
  const busy = !!s && (s.pendings.length > 0 || !!s.discarding);
  const canPlay = !!s && isMyTurn && s.playsLeft > 0 && !busy && !s.winner;

  const myJsnPending = s?.pendings.find((p) => p.phase === 'jsn' && p.jsnDecider === myId) || null;
  const myPayPending = s?.pendings.find((p) => p.kind === 'pay' && p.phase === 'pay' && p.targetId === myId) || null;
  const mustDiscard = s?.discarding && s.discarding.pid === myId ? s.discarding : null;

  const closeModal = () => {
    setSel(null);
    setStep('main');
    setTarget(null);
    setTheirProp(null);
    setRentColor(null);
    setUseDouble(false);
  };

  const play = (payload: Record<string, unknown>) => {
    playClick();
    send({ t: 'pd_play', ...payload });
    closeModal();
  };

  const secsLeft = (endsAt: number) => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

  const myTable = s?.table[myId] || {};
  const doubleInHand = myHand.find((c) => c.action === 'double_rent');

  const payEligible = s ? payableCards(s.bank[myId] || [], myTable) : [];
  const paySelTotal = payEligible.filter((c) => paySel.includes(c.id)).reduce((sum, c) => sum + c.value, 0);
  const payOk = myPayPending ? paySelTotal >= (myPayPending.amount || 0) || paySel.length === payEligible.length : false;

  const togglePay = (id: number) => {
    playClick();
    setPaySel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const canFlip = (c: Card, owner?: string) => c.kind === 'wild' && owner === myId && isMyTurn && !busy && !s?.winner;

  const tableGroups = (table: Table, owner: string) => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(table).map(([color, g]) => {
        const meta = COLORS[color as ColorId];
        const complete = groupComplete(color, g);
        const legit = groupLegit(color, g);
        return (
          <div key={color} className={`rounded-xl p-1.5 ${legit ? 'bg-amber-400/25 ring-2 ring-amber-300 shadow-lg' : complete ? 'bg-amber-400/10 ring-1 ring-amber-300/50' : 'bg-black/20'}`}>
            <div className="flex items-start">
              <div className="flex flex-col">
                {g.cards.map((c, i) => (
                  <div key={c.id} className={`relative ${i > 0 ? '-mt-[4.25rem]' : ''}`}>
                    <button onClick={() => { playClick(); setZoom({ card: c, color, owner }); }} aria-label="Look at this card" className="block">
                      <CardFace c={c} size="sm" assignedColor={c.kind === 'wild' ? color : undefined} />
                    </button>
                    {canFlip(c, owner) && (
                      <button
                        onClick={() => { playClick(); setFlipCard(c); }}
                        className="absolute top-0.5 -left-2 z-10 w-9 h-9 rounded-full bg-amber-400 text-amber-950 text-lg font-bold shadow-lg border-2 border-white flex items-center justify-center"
                        aria-label="Move this wildcard"
                      >
                        ↔
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {(g.house || g.hotel) && (
                <div className="ml-1 flex flex-col gap-1 text-2xl leading-none">
                  {g.house && <span aria-label="House +3M">🏠</span>}
                  {g.hotel && <span aria-label="Hotel +4M">🏨</span>}
                </div>
              )}
            </div>
            <div className={`text-center text-sm font-fredoka mt-1 leading-tight ${legit ? 'text-amber-300 font-bold' : 'text-white/80'}`}>
              {meta.label} {g.cards.length}/{meta.size}{legit ? ' ⭐' : ''}
              <br />
              {complete && !legit ? 'needs a real street!' : `rent ${rentFor(table, color)}M`}
            </div>
          </div>
        );
      })}
      {Object.keys(table).length === 0 && (
        <span className="text-base font-nunito text-white/60 py-2">{owner === myId ? 'Play street cards here to build sets!' : 'no streets yet'}</span>
      )}
    </div>
  );

  const renderPendingBanner = () => {
    if (!s || s.pendings.length === 0) return null;
    const p = s.pendings[0];
    if (p.targetId === myId || p.jsnDecider === myId) return null;
    const txt =
      p.phase === 'jsn'
        ? `🙅 ${byId(p.jsnDecider || '').name} is deciding whether to say NO WAY…`
        : `💸 Waiting for ${byId(p.targetId).name} to pay ${p.amount}M…`;
    return (
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 rounded-full px-5 py-2 font-fredoka text-base shadow-xl max-w-[90vw] text-center">
        {txt}
      </motion.div>
    );
  };

  const cardBtn = (c: Card, onTap: () => void, picked: boolean, ring: string) => (
    <button key={c.id} onClick={onTap} className={`rounded-xl transition-transform ${picked ? `ring-4 ${ring} scale-105` : 'opacity-80'}`}>
      <CardFace c={c} size="sm" />
    </button>
  );

  return (
    <div className="min-h-screen-d text-white px-3 py-6" style={{ background: 'radial-gradient(ellipse at 50% 30%, #166534 0%, #14532d 45%, #052e16 100%)' }}>
      <div className="max-w-4xl mx-auto pt-8 pb-64">
        <h1 className="text-center font-fredoka font-bold text-3xl md:text-4xl mb-1 drop-shadow-lg">🏃 Property Dash</h1>
        <p className="text-center font-nunito text-emerald-200 text-lg mb-4">First to {SETS_TO_WIN} complete colour sets wins (on your own turn)!</p>

        {!s && <div className="text-center font-fredoka text-xl bg-black/30 rounded-3xl p-8 border border-white/10">🃏 Shuffling 106 cards…</div>}

        {s && !inGame && (
          <div className="text-center font-nunito text-lg bg-black/30 rounded-2xl p-3 mb-3 text-emerald-200">👀 You're watching this game — join the next one!</div>
        )}

        {s && (
          <>
            {/* Opponents */}
            <div className={`grid gap-2 mb-3 ${opponents.length > 2 ? 'md:grid-cols-3 grid-cols-1' : opponents.length === 2 ? 'md:grid-cols-2 grid-cols-1' : 'grid-cols-1'}`}>
              {opponents.map((id) => (
                <div key={id} className={`rounded-2xl p-2.5 border-2 ${s.turn === id ? 'border-amber-400 bg-amber-400/10 shadow-lg' : 'border-white/10 bg-black/25'}`}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="font-fredoka text-lg truncate">
                      {s.turn === id && <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>▶ </motion.span>}
                      {byId(id).emoji} {byId(id).name}
                    </span>
                    <span className="font-fredoka text-base text-amber-300 shrink-0">⭐ {fullSetCount(s.table[id] || {})}/{SETS_TO_WIN}</span>
                  </div>
                  <div className="flex items-center gap-2 font-nunito text-base text-emerald-200 mb-1.5">
                    <span className="bg-emerald-900/60 rounded-full px-2.5 py-0.5">💰 {bankTotal(s.bank[id] || [])}M</span>
                    <span className="bg-indigo-900/60 rounded-full px-2.5 py-0.5">✋ {(s.hands[id] || []).length} cards</span>
                  </div>
                  {tableGroups(s.table[id] || {}, id)}
                </div>
              ))}
            </div>

            {/* Table centre */}
            <div className="bg-black/30 rounded-2xl border border-white/10 p-3 mb-3">
              <div className="flex items-center justify-between font-fredoka text-lg mb-2 gap-2 flex-wrap">
                <span className="text-emerald-300">The Table</span>
                <span className={isMyTurn ? 'text-amber-300' : 'text-white/80'}>
                  {s.winner
                    ? '🏁 Game over'
                    : isMyTurn
                    ? `YOUR TURN · plays left: ${'🟡'.repeat(s.playsLeft)}${'⚪'.repeat(Math.max(0, PLAYS_PER_TURN - s.playsLeft))}`
                    : `${byId(s.turn).emoji} ${byId(s.turn).name}'s turn`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="shrink-0 text-center">
                  <div className="relative w-14 h-20">
                    <div className="absolute top-1 left-1 opacity-50"><CardBack /></div>
                    <div className="absolute top-0.5 left-0.5 opacity-75"><CardBack /></div>
                    <div className="absolute top-0 left-0"><CardBack /></div>
                    <span className="absolute -bottom-2 -right-2 min-w-[28px] h-7 px-1 bg-amber-400 text-amber-950 font-fredoka font-bold text-sm rounded-full shadow flex items-center justify-center">
                      {s.deckCount}
                    </span>
                  </div>
                  <div className="text-sm font-fredoka text-white/70 mt-2">DRAW</div>
                </div>
                <div className="flex-1 min-w-0">
                  {s.feed.map((line, i) => (
                    <div key={`${i}-${line}`} className={`font-nunito leading-snug ${i === 0 ? 'text-white font-bold text-base md:text-lg' : 'text-white/60 text-sm md:text-base truncate'}`}>
                      {line}
                    </div>
                  ))}
                </div>
                <div className="shrink-0 text-center">
                  {s.discardTop ? (
                    <motion.button key={s.discardTop.id} initial={{ scale: 1.3, rotate: 8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} onClick={() => { playClick(); setZoom({ card: s.discardTop! }); }}>
                      <CardFace c={s.discardTop} size="sm" />
                    </motion.button>
                  ) : (
                    <div className="w-20 h-28 rounded-xl border-2 border-dashed border-white/20" />
                  )}
                  <div className="text-sm font-fredoka text-white/70 mt-1">PLAYED</div>
                </div>
              </div>
            </div>

            {/* My table */}
            {inGame && (
              <div className={`rounded-2xl p-3 border-2 mb-3 ${isMyTurn ? 'border-amber-400 bg-amber-400/10 shadow-lg' : 'border-white/10 bg-black/25'}`}>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <span className="font-fredoka text-lg">
                    {byId(myId).emoji} Your streets · <span className="text-emerald-300">💰 {bankTotal(s.bank[myId] || [])}M</span> ·{' '}
                    <span className="text-amber-300">⭐ {fullSetCount(myTable)}/{SETS_TO_WIN} sets</span>
                  </span>
                  {isMyTurn && !s.winner && !busy && (
                    <button
                      onClick={() => { playClick(); send({ t: 'pd_end' }); }}
                      className="min-h-[48px] rounded-full px-5 py-2 font-fredoka text-lg bg-white/15 border border-white/30 active:bg-white/25"
                    >
                      End turn ⏭️
                    </button>
                  )}
                </div>
                {tableGroups(myTable, myId)}
              </div>
            )}
          </>
        )}
      </div>

      {/* My hand (docked bottom) */}
      {s && inGame && !s.winner && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/60 backdrop-blur border-t border-white/10 px-3 pt-2 z-30" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="max-w-4xl mx-auto">
            <div className="font-fredoka text-base text-emerald-300 mb-1.5">
              ✋ Your hand ({myHand.length}/{HAND_LIMIT} at turn end)
              {canPlay ? ' — tap a card to play it!' : ' — tap a card to read it'}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <AnimatePresence initial={false}>
                {myHand.map((c, i) => (
                  <motion.button
                    key={c.id}
                    initial={{ y: 70, opacity: 0, rotate: -6 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: -50, opacity: 0, scale: 0.8 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 24 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      playClick();
                      if (canPlay) {
                        setSel(c);
                        setStep('main');
                      } else {
                        setZoom({ card: c });
                      }
                    }}
                    className={`shrink-0 ${canPlay ? '' : 'opacity-75'}`}
                  >
                    <CardFace c={c} size="md" />
                  </motion.button>
                ))}
              </AnimatePresence>
              {myHand.length === 0 && <span className="font-nunito text-white/60 text-lg py-6">Empty hand — you'll draw 5 next turn!</span>}
            </div>
          </div>
        </div>
      )}

      {renderPendingBanner()}

      <AnimatePresence>
        {/* Dealing animation */}
        {dealing && (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/40">
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i / 16) * Math.PI * 2;
              const dist = 230 + (i % 4) * 55;
              return (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                  animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, rotate: 200 + i * 25, scale: 0.6 }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.75, ease: 'easeOut' }}
                  className="absolute"
                >
                  <CardBack />
                </motion.div>
              );
            })}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 1.1] }}
              transition={{ duration: 2.3, times: [0, 0.15, 0.8, 1] }}
              className="font-fredoka font-bold text-3xl md:text-4xl text-white drop-shadow-2xl"
            >
              🃏 Dealing cards…
            </motion.div>
          </motion.div>
        )}

        {/* Tap-to-zoom: read any card big */}
        {zoom && !sel && (
          <motion.div key="zoom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)} className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3 max-h-[92dvh] overflow-y-auto">
              <CardFace c={zoom.card} size="lg" assignedColor={zoom.card.kind === 'wild' ? zoom.color : undefined} />
              {zoom.owner && <div className="font-fredoka text-lg">{byId(zoom.owner).emoji} {zoom.owner === myId ? 'Yours' : `${byId(zoom.owner).name}'s`}</div>}
              <div className="flex gap-2">
                {canFlip(zoom.card, zoom.owner) && (
                  <button onClick={() => { playClick(); setFlipCard(zoom.card); setZoom(null); }} className={`${btn} bg-gradient-to-r from-amber-400 to-orange-500`}>
                    ↔ Move to another colour
                  </button>
                )}
                <button onClick={() => { playClick(); setZoom(null); }} className={`${btn} bg-white/15 border border-white/30 px-8`}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Play-a-card modal: the zoomed card + what you can do with it */}
        {sel && s && (
          <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/20 rounded-3xl p-5 max-w-md w-full max-h-[92dvh] overflow-y-auto">
              <div className="flex justify-center mb-3"><CardFace c={sel} size={step === 'main' ? 'lg' : 'md'} /></div>

              {step === 'main' && (
                <div className="grid gap-2">
                  {sel.kind === 'property' && (
                    <button onClick={() => play({ cardId: sel.id, mode: 'property' })} className={`${btn} bg-gradient-to-r from-emerald-400 to-green-500`}>
                      🏠 Add to my streets
                    </button>
                  )}
                  {sel.kind === 'wild' && (
                    <button onClick={() => { playClick(); setStep('wildcolor'); }} className={`${btn} bg-gradient-to-r from-emerald-400 to-green-500`}>
                      🌈 Play as a street — choose colour
                    </button>
                  )}
                  {sel.kind === 'rent' && (
                    <button onClick={() => { playClick(); setStep('rentcolor'); }} className={`${btn} bg-gradient-to-r from-violet-400 to-purple-500`}>
                      🧾 Charge rent!
                    </button>
                  )}
                  {sel.kind === 'action' && sel.action !== 'noway' && sel.action !== 'double_rent' && (
                    <button
                      onClick={() => {
                        if (sel.action === 'lucky' || sel.action === 'birthday') { play({ cardId: sel.id, mode: 'action' }); return; }
                        if (sel.action === 'house' || sel.action === 'hotel') { playClick(); setStep('set'); return; }
                        playClick();
                        setStep('target');
                      }}
                      className={`${btn} bg-gradient-to-r from-violet-400 to-purple-500`}
                    >
                      {ACTION_INFO[sel.action!].emoji} Play {ACTION_INFO[sel.action!].label}
                    </button>
                  )}
                  {sel.kind !== 'property' && sel.value > 0 && (
                    <button onClick={() => play({ cardId: sel.id, mode: 'money' })} className={`${btn} bg-gradient-to-r from-amber-400 to-orange-500`}>
                      💰 Bank it ({sel.value}M)
                    </button>
                  )}
                  {sel.action === 'noway' && (
                    <div className="text-center font-nunito text-base text-white/80">🙅 Worth 0 — it can't be banked. Keep it in your hand to block a rival!</div>
                  )}
                  {sel.action === 'double_rent' && (
                    <div className="text-center font-nunito text-base text-white/80">✖️ Pick a Rent card and you'll get the option to double it — or bank this for 1M.</div>
                  )}
                  {sel.kind === 'wild' && sel.any && (
                    <div className="text-center font-nunito text-base text-white/80">🌈 Worth 0 — can't be banked or used to pay.</div>
                  )}
                  <button onClick={() => { playClick(); closeModal(); }} className={backBtn}>Cancel</button>
                </div>
              )}

              {step === 'wildcolor' && sel.kind === 'wild' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka text-lg mb-1">Which colour set?</div>
                  {(sel.any ? COLOR_IDS : sel.colors || []).map((color) => (
                    <button key={color} onClick={() => play({ cardId: sel.id, mode: 'property', color })} className={`${btn} ${COLORS[color].bg} ${COLORS[color].text}`}>
                      {COLORS[color].emoji} {COLORS[color].label} ({myTable[color]?.cards.length || 0}/{COLORS[color].size})
                    </button>
                  ))}
                  <button onClick={() => { playClick(); setStep('main'); }} className={backBtn}>← Back</button>
                </div>
              )}

              {step === 'rentcolor' && sel.kind === 'rent' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka text-lg mb-1">{sel.any ? 'Any colour you own — ONE rival pays:' : 'Charge which colour? (every rival pays)'}</div>
                  {(sel.any ? COLOR_IDS.filter((c) => (myTable[c]?.cards.length || 0) > 0) : sel.colors || []).map((color) => {
                    const owned = (myTable[color]?.cards.length || 0) > 0;
                    const amt = rentFor(myTable, color) * (useDouble ? 2 : 1);
                    return (
                      <button
                        key={color}
                        disabled={!owned}
                        onClick={() => {
                          playClick();
                          setRentColor(color);
                          if (sel.any) setStep('renttarget');
                          else play({ cardId: sel.id, mode: 'rent', color, doubleId: useDouble && doubleInHand ? doubleInHand.id : undefined });
                        }}
                        className={`${btn} ${owned ? `${COLORS[color].bg} ${COLORS[color].text}` : 'bg-white/5 text-white/40'}`}
                      >
                        {COLORS[color].emoji} {COLORS[color].label} — {owned ? `${amt}M` : 'you have none yet'}
                      </button>
                    );
                  })}
                  {sel.any && COLOR_IDS.every((c) => (myTable[c]?.cards.length || 0) === 0) && (
                    <div className="text-center font-nunito text-base text-amber-200">Lay some streets first, then charge rent!</div>
                  )}
                  {doubleInHand && s.playsLeft >= 2 && (
                    <button onClick={() => { playClick(); setUseDouble(!useDouble); }} className={`${btn} border-2 ${useDouble ? 'bg-amber-400/30 border-amber-300' : 'bg-white/5 border-white/20'}`}>
                      ✖️ Add "Double Rent" {useDouble ? '✅' : ''} (uses 2 plays)
                    </button>
                  )}
                  <button onClick={() => { playClick(); setStep('main'); }} className={backBtn}>← Back</button>
                </div>
              )}

              {step === 'renttarget' && sel.kind === 'rent' && rentColor && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka text-lg mb-1">Who pays the {rentFor(myTable, rentColor) * (useDouble ? 2 : 1)}M?</div>
                  {opponents.map((id) => (
                    <button
                      key={id}
                      onClick={() => play({ cardId: sel.id, mode: 'rent', color: rentColor, target: id, doubleId: useDouble && doubleInHand ? doubleInHand.id : undefined })}
                      className={`${btn} bg-white/15 border border-white/30 active:bg-white/25`}
                    >
                      {byId(id).emoji} {byId(id).name} (💰{bankTotal(s.bank[id] || [])}M)
                    </button>
                  ))}
                  <button onClick={() => { playClick(); setStep('rentcolor'); }} className={backBtn}>← Back</button>
                </div>
              )}

              {step === 'set' && (sel.action === 'house' || sel.action === 'hotel') && (() => {
                const sets = Object.entries(myTable).filter(([color, g]) =>
                  groupComplete(color, g) && !NO_BUILD.includes(color as ColorId) && (sel.action === 'house' ? !g.house : g.house && !g.hotel),
                );
                return (
                  <div className="grid gap-2">
                    <div className="text-center font-fredoka text-lg mb-1">Build on which complete set?</div>
                    {sets.map(([color]) => (
                      <button key={color} onClick={() => play({ cardId: sel.id, mode: 'action', color })} className={`${btn} ${COLORS[color as ColorId].bg} ${COLORS[color as ColorId].text}`}>
                        {ACTION_INFO[sel.action!].emoji} {COLORS[color as ColorId].label} set
                      </button>
                    ))}
                    {sets.length === 0 && (
                      <div className="text-center font-nunito text-base text-amber-200">
                        {sel.action === 'house' ? 'You need a complete set first (not Station or Power)!' : 'You need a complete set with a House first!'}
                      </div>
                    )}
                    <button onClick={() => { playClick(); setStep('main'); }} className={backBtn}>← Back</button>
                  </div>
                );
              })()}

              {step === 'target' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka text-lg mb-1">Pick a rival:</div>
                  {opponents.map((id) => {
                    const tt = s.table[id] || {};
                    const swipeOk = Object.entries(tt).some(([color, g]) => !groupComplete(color, g) && g.cards.length > 0);
                    const snatchOk = Object.entries(tt).some(([color, g]) => groupComplete(color, g));
                    const swapMineOk = Object.entries(myTable).some(([color, g]) => !groupComplete(color, g) && g.cards.length > 0);
                    const disabled =
                      ((sel.action === 'swipe' || sel.action === 'swap') && !swipeOk) ||
                      (sel.action === 'swap' && !swapMineOk) ||
                      (sel.action === 'snatch' && !snatchOk);
                    return (
                      <button
                        key={id}
                        disabled={disabled}
                        onClick={() => {
                          playClick();
                          setTarget(id);
                          if (sel.action === 'payup') { play({ cardId: sel.id, mode: 'action', target: id }); return; }
                          setStep('prop');
                        }}
                        className={`${btn} ${disabled ? 'bg-white/5 text-white/40' : 'bg-white/15 border border-white/30 active:bg-white/25'}`}
                      >
                        {byId(id).emoji} {byId(id).name}
                        {disabled && <span className="block text-sm font-nunito">{sel.action === 'swap' && !swapMineOk ? 'you need a loose street to swap' : 'nothing to take'}</span>}
                      </button>
                    );
                  })}
                  <button onClick={() => { playClick(); setStep('main'); }} className={backBtn}>← Back</button>
                </div>
              )}

              {step === 'prop' && target && sel.action === 'snatch' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka text-lg mb-1">Snatch which complete set?</div>
                  {Object.entries(s.table[target] || {})
                    .filter(([color, g]) => groupComplete(color, g))
                    .map(([color, g]) => (
                      <button key={color} onClick={() => play({ cardId: sel.id, mode: 'action', target, color })} className={`${btn} ${COLORS[color as ColorId].bg} ${COLORS[color as ColorId].text}`}>
                        💥 {COLORS[color as ColorId].label} set {g.house ? '+🏠' : ''}{g.hotel ? '+🏨' : ''}
                      </button>
                    ))}
                  <button onClick={() => { playClick(); setStep('target'); }} className={backBtn}>← Back</button>
                </div>
              )}

              {step === 'prop' && target && (sel.action === 'swipe' || sel.action === 'swap') && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka text-lg mb-1">{sel.action === 'swipe' ? 'Take which street?' : 'Which street do you want?'}</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.entries(s.table[target] || {})
                      .filter(([color, g]) => !groupComplete(color, g))
                      .flatMap(([color, g]) => g.cards.map((c) => ({ c, color })))
                      .map(({ c, color }) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            playClick();
                            if (sel.action === 'swipe') { play({ cardId: sel.id, mode: 'action', target, propId: c.id }); return; }
                            setTheirProp(c.id);
                            setStep('myprop');
                          }}
                        >
                          <CardFace c={c} size="md" assignedColor={c.kind === 'wild' ? color : undefined} />
                        </button>
                      ))}
                  </div>
                  <button onClick={() => { playClick(); setStep('target'); }} className={backBtn}>← Back</button>
                </div>
              )}

              {step === 'myprop' && target && theirProp !== null && sel.action === 'swap' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka text-lg mb-1">Give which of YOUR streets?</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.entries(myTable)
                      .filter(([color, g]) => !groupComplete(color, g))
                      .flatMap(([color, g]) => g.cards.map((c) => ({ c, color })))
                      .map(({ c, color }) => (
                        <button key={c.id} onClick={() => play({ cardId: sel.id, mode: 'action', target, propId: theirProp, myPropId: c.id })}>
                          <CardFace c={c} size="md" assignedColor={c.kind === 'wild' ? color : undefined} />
                        </button>
                      ))}
                  </div>
                  <button onClick={() => { playClick(); setStep('prop'); }} className={backBtn}>← Back</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Wildcard move modal */}
        {flipCard && (
          <motion.div key="flip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/20 rounded-3xl p-5 max-w-sm w-full max-h-[92dvh] overflow-y-auto">
              <div className="flex justify-center mb-3"><CardFace c={flipCard} size="md" /></div>
              <div className="text-center font-fredoka text-lg mb-2">Move this wildcard to:</div>
              <div className="grid gap-2">
                {(flipCard.any ? COLOR_IDS : flipCard.colors || []).map((color) => (
                  <button
                    key={color}
                    onClick={() => { playClick(); send({ t: 'pd_flip', cardId: flipCard.id, color }); setFlipCard(null); }}
                    className={`${btn} ${COLORS[color].bg} ${COLORS[color].text}`}
                  >
                    {COLORS[color].emoji} {COLORS[color].label} ({myTable[color]?.cards.length || 0}/{COLORS[color].size})
                  </button>
                ))}
              </div>
              <button onClick={() => { playClick(); setFlipCard(null); }} className={`w-full mt-2 ${backBtn}`}>Cancel</button>
            </motion.div>
          </motion.div>
        )}

        {/* No Way! prompt */}
        {myJsnPending && (
          <motion.div key="jsn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-red-900 to-rose-950 border-4 border-red-400 rounded-3xl p-6 max-w-sm w-full text-center">
              <div className="text-5xl mb-2">
                {myJsnPending.targetId === myId ? (myJsnPending.action === 'rent' ? '🧾' : ACTION_INFO[myJsnPending.action as ActionType]?.emoji || '⚡') : '😮'}
              </div>
              <h2 className="font-fredoka font-bold text-2xl text-red-200 mb-1">
                {myJsnPending.targetId === myId
                  ? myJsnPending.kind === 'pay'
                    ? `${byId(myJsnPending.actorId).name} wants ${myJsnPending.amount}M from you!`
                    : `${byId(myJsnPending.actorId).name} plays ${ACTION_INFO[myJsnPending.action as ActionType]?.label} on you!`
                  : `${byId(myJsnPending.targetId).name} said NO WAY to your card — answer back?`}
              </h2>
              <p className="font-fredoka text-rose-200 text-lg mb-4">⏱️ {secsLeft(myJsnPending.endsAt)}s · You have a No Way! card</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playCorrect(); send({ t: 'pd_jsn', pendingId: myJsnPending.pid, use: true }); }}
                  className="min-h-[52px] px-6 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-red-500 shadow-xl"
                >
                  🙅 {myJsnPending.targetId === myId ? 'NO WAY!' : 'Answer back!'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); send({ t: 'pd_jsn', pendingId: myJsnPending.pid, use: false }); }}
                  className="min-h-[52px] px-6 py-3 rounded-full font-fredoka font-bold text-lg bg-white/15 border border-white/30"
                >
                  👍 {myJsnPending.targetId === myId ? 'Let it happen' : 'Let it go'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Payment picker */}
        {myPayPending && !myJsnPending && (
          <motion.div key="pay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-5 max-w-lg w-full max-h-[92dvh] overflow-y-auto">
              <h2 className="font-fredoka font-bold text-2xl text-amber-300 text-center mb-1">💸 Pay {byId(myPayPending.actorId).name} {myPayPending.amount}M</h2>
              <p className="font-nunito text-base text-white/80 text-center mb-3">
                Tap cards to pay with (no change given!) · ⏱️ {secsLeft(myPayPending.endsAt)}s · picked:{' '}
                <span className={`font-bold ${payOk ? 'text-emerald-300' : 'text-red-300'}`}>{paySelTotal}M</span>
              </p>
              <div className="font-fredoka text-base text-emerald-300 mb-1">💰 Your bank:</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {(s?.bank[myId] || []).map((c) => cardBtn(c, () => togglePay(c.id), paySel.includes(c.id), 'ring-amber-400'))}
                {(s?.bank[myId] || []).length === 0 && <span className="font-nunito text-base text-white/60">empty bank</span>}
              </div>
              <div className="font-fredoka text-base text-emerald-300 mb-1">🏠 Your streets (they move to their table):</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.values(myTable).flatMap((g) => g.cards.filter((c) => c.value > 0)).map((c) => cardBtn(c, () => togglePay(c.id), paySel.includes(c.id), 'ring-amber-400'))}
              </div>
              <button
                disabled={!payOk}
                onClick={() => { playCoin(); send({ t: 'pd_pay', pendingId: myPayPending.pid, cardIds: paySel }); }}
                className={`w-full min-h-[52px] py-3 rounded-full font-fredoka font-bold text-lg ${payOk ? 'bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl' : 'bg-gray-600/50 text-gray-300'}`}
              >
                {payOk ? `Pay ${paySelTotal}M 💸` : `Pick at least ${myPayPending.amount}M`}
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Discard down to 7 */}
        {mustDiscard && (
          <motion.div key="discard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-red-400 rounded-3xl p-5 max-w-lg w-full max-h-[92dvh] overflow-y-auto">
              <h2 className="font-fredoka font-bold text-2xl text-red-200 text-center mb-1">🗑️ Too many cards! Put back {mustDiscard.need}</h2>
              <p className="font-nunito text-base text-white/80 text-center mb-3">You can keep {HAND_LIMIT} at the end of your turn · ⏱️ {secsLeft(mustDiscard.endsAt)}s</p>
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {myHand.map((c) =>
                  cardBtn(
                    c,
                    () => {
                      playClick();
                      setDiscardSel((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : cur.length < mustDiscard.need ? [...cur, c.id] : cur));
                    },
                    discardSel.includes(c.id),
                    'ring-red-400',
                  ),
                )}
              </div>
              <button
                disabled={discardSel.length !== mustDiscard.need}
                onClick={() => { playClick(); send({ t: 'pd_discard', cardIds: discardSel }); }}
                className={`w-full min-h-[52px] py-3 rounded-full font-fredoka font-bold text-lg ${discardSel.length === mustDiscard.need ? 'bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl' : 'bg-gray-600/50 text-gray-300'}`}
              >
                Put back {discardSel.length}/{mustDiscard.need} 🗑️
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Winner */}
        {s?.winner && (
          <motion.div key="win" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-emerald-800 to-teal-900 border-4 border-amber-400 rounded-3xl p-6 text-center max-w-md w-full max-h-[92dvh] overflow-y-auto"
            >
              <div className="text-7xl mb-2">🏆</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
                {byId(s.winner).emoji} {byId(s.winner).name} WINS!
              </h2>
              <p className="font-nunito text-lg text-emerald-100 mb-3">{SETS_TO_WIN} complete colour sets — property champion!</p>
              <div className="bg-black/25 rounded-2xl p-3 mb-3 text-left">
                {(s.ranked || []).flatMap((rung, i) => (Array.isArray(rung) ? rung : [rung]).map((id) => (
                  <div key={id} className="flex justify-between gap-2 font-nunito text-lg py-1 border-b border-white/5 last:border-0">
                    <span>{['🥇', '🥈', '🥉', '4️⃣'][i]} {byId(id).emoji} {byId(id).name}</span>
                    <span className="text-amber-200 shrink-0">⭐{fullSetCount(s.table[id] || {})} · 💰{bankTotal(s.bank[id] || [])}M</span>
                  </div>
                )))}
              </div>
              {reward && <p className="font-fredoka text-lg text-green-300 mb-4">+{reward.xp} XP · +{reward.coins} 🪙</p>}
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="min-h-[52px] px-8 py-3 rounded-full font-fredoka font-bold text-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-lg text-emerald-200">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PropertyDash;
