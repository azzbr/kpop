import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWrong, playWin, playCoin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const SETS_TO_WIN = 3;
const PLAYS_PER_TURN = 3;
const HAND_LIMIT = 7;
const TURN_MS = 90000;
const JSN_MS = 12000;
const PAY_MS = 25000;
const DISCARD_MS = 20000;

type ColorId = 'brown' | 'lblue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'dblue' | 'rr' | 'util';
type ActionType = 'pass_go' | 'jsn' | 'sly' | 'forced' | 'breaker' | 'debt' | 'birthday' | 'double_rent' | 'house' | 'hotel';

const COLOR_IDS: ColorId[] = ['brown', 'lblue', 'pink', 'orange', 'red', 'yellow', 'green', 'dblue', 'rr', 'util'];

const COLORS: Record<ColorId, { label: string; size: number; rent: number[]; value: number; bg: string; text: string; streets: string[] }> = {
  brown: { label: 'Brown', size: 2, rent: [1, 2], value: 1, bg: 'bg-amber-800', text: 'text-white', streets: ['Mediterranean Ave', 'Baltic Ave'] },
  lblue: { label: 'Light Blue', size: 3, rent: [1, 2, 3], value: 1, bg: 'bg-sky-400', text: 'text-white', streets: ['Oriental Ave', 'Vermont Ave', 'Connecticut Ave'] },
  pink: { label: 'Pink', size: 3, rent: [1, 2, 4], value: 2, bg: 'bg-pink-500', text: 'text-white', streets: ['St. Charles Place', 'States Ave', 'Virginia Ave'] },
  orange: { label: 'Orange', size: 3, rent: [1, 3, 5], value: 2, bg: 'bg-orange-500', text: 'text-white', streets: ['St. James Place', 'Tennessee Ave', 'New York Ave'] },
  red: { label: 'Red', size: 3, rent: [2, 3, 6], value: 3, bg: 'bg-red-600', text: 'text-white', streets: ['Kentucky Ave', 'Indiana Ave', 'Illinois Ave'] },
  yellow: { label: 'Yellow', size: 3, rent: [2, 4, 6], value: 3, bg: 'bg-yellow-400', text: 'text-yellow-950', streets: ['Atlantic Ave', 'Ventnor Ave', 'Marvin Gardens'] },
  green: { label: 'Green', size: 3, rent: [2, 4, 7], value: 4, bg: 'bg-green-600', text: 'text-white', streets: ['Pacific Ave', 'North Carolina Ave', 'Pennsylvania Ave'] },
  dblue: { label: 'Dark Blue', size: 2, rent: [3, 8], value: 4, bg: 'bg-blue-800', text: 'text-white', streets: ['Park Place', 'Boardwalk'] },
  rr: { label: 'Railroad', size: 4, rent: [1, 2, 3, 4], value: 2, bg: 'bg-gray-800', text: 'text-white', streets: ['Reading Railroad', 'Pennsylvania Railroad', 'B. & O. Railroad', 'Short Line'] },
  util: { label: 'Utility', size: 2, rent: [1, 2], value: 2, bg: 'bg-lime-500', text: 'text-lime-950', streets: ['Electric Company', 'Water Works'] },
};

const ACTION_INFO: Record<ActionType, { label: string; emoji: string; desc: string }> = {
  pass_go: { label: 'Pass GO', emoji: '🎁', desc: 'Draw 2 extra cards' },
  jsn: { label: 'Just Say No', emoji: '🙅', desc: 'Blocks an action played against you (kept in hand, $0)' },
  sly: { label: 'Sly Deal', emoji: '🦊', desc: 'Steal a property — not from a complete set' },
  forced: { label: 'Forced Deal', emoji: '🔁', desc: 'Swap one of your properties with a rival\'s — no complete sets' },
  breaker: { label: 'Deal Breaker', emoji: '💥', desc: 'Steal a COMPLETE set (house & hotel included!)' },
  debt: { label: 'Debt Collector', emoji: '💼', desc: 'One rival pays you 5M' },
  birthday: { label: "It's My Birthday", emoji: '🎂', desc: 'Every rival pays you 2M' },
  double_rent: { label: 'Double the Rent', emoji: '✖️', desc: 'Play with a Rent card to double it (costs a play)' },
  house: { label: 'House', emoji: '🏠', desc: '+3M rent on a complete set (not Railroad/Utility)' },
  hotel: { label: 'Hotel', emoji: '🏨', desc: '+4M rent on a set that has a House' },
};

const MONEY_STYLE: Record<number, string> = {
  1: 'from-stone-100 to-stone-300 text-stone-700',
  2: 'from-rose-100 to-rose-300 text-rose-700',
  3: 'from-sky-100 to-sky-300 text-sky-700',
  4: 'from-violet-100 to-violet-300 text-violet-700',
  5: 'from-amber-100 to-amber-300 text-amber-700',
  10: 'from-yellow-200 to-amber-400 text-amber-900',
};

interface Card {
  id: number;
  kind: 'property' | 'wild' | 'money' | 'action' | 'rent';
  value: number;
  color?: ColorId;
  name?: string;
  colors?: ColorId[]; // dual wild / dual rent
  any?: boolean; // multi wild / wild rent
  action?: ActionType;
}

function buildDeck(): Card[] {
  let id = 0;
  const deck: Card[] = [];
  // 28 properties
  COLOR_IDS.forEach((color) => {
    COLORS[color].streets.forEach((name) => {
      deck.push({ id: id++, kind: 'property', value: COLORS[color].value, color, name });
    });
  });
  // 11 wildcards: 9 dual + 2 multi
  const duals: [ColorId, ColorId, number, number][] = [
    ['lblue', 'brown', 1, 1], ['lblue', 'rr', 4, 1], ['pink', 'orange', 2, 2],
    ['red', 'yellow', 3, 2], ['dblue', 'green', 4, 1], ['green', 'rr', 4, 1], ['rr', 'util', 2, 1],
  ];
  duals.forEach(([a, b, v, n]) => {
    for (let i = 0; i < n; i++) deck.push({ id: id++, kind: 'wild', value: v, colors: [a, b] });
  });
  for (let i = 0; i < 2; i++) deck.push({ id: id++, kind: 'wild', value: 0, any: true });
  // 34 actions
  const actions: [ActionType, number, number][] = [
    ['pass_go', 10, 1], ['jsn', 3, 0], ['sly', 3, 3], ['forced', 3, 3], ['breaker', 2, 5],
    ['debt', 3, 3], ['birthday', 3, 2], ['double_rent', 2, 1], ['house', 3, 3], ['hotel', 2, 4],
  ];
  actions.forEach(([a, n, v]) => {
    for (let i = 0; i < n; i++) deck.push({ id: id++, kind: 'action', value: v, action: a });
  });
  // 13 rent: 10 dual + 3 wild
  const rentPairs: [ColorId, ColorId][] = [
    ['lblue', 'brown'], ['pink', 'orange'], ['red', 'yellow'], ['dblue', 'green'], ['rr', 'util'],
  ];
  rentPairs.forEach(([a, b]) => {
    for (let i = 0; i < 2; i++) deck.push({ id: id++, kind: 'rent', value: 1, colors: [a, b] });
  });
  for (let i = 0; i < 3; i++) deck.push({ id: id++, kind: 'rent', value: 3, any: true });
  // 20 money
  const money: [number, number][] = [[10, 1], [5, 2], [4, 3], [3, 3], [2, 5], [1, 6]];
  money.forEach(([v, n]) => {
    for (let i = 0; i < n; i++) deck.push({ id: id++, kind: 'money', value: v });
  });
  return deck.sort(() => Math.random() - 0.5);
}

interface Group {
  cards: Card[];
  house: Card | null;
  hotel: Card | null;
}
type Table = Record<string, Group>; // keyed by ColorId

interface Pending {
  pid: number;
  kind: 'pay' | 'steal';
  action: ActionType | 'rent';
  actorId: string;
  targetId: string;
  amount?: number;
  reason?: string;
  color?: string;
  cardId?: number;
  myCardId?: number;
  chainable: boolean;
  jsnDecider: string | null; // who may currently Just-Say-No
  phase: 'jsn' | 'pay';
  endsAt: number;
}

interface MDState {
  order: string[];
  turn: string;
  playsLeft: number;
  hands: Record<string, Card[]>;
  bank: Record<string, Card[]>;
  table: Record<string, Table>;
  deckCount: number;
  discardTop: Card | null;
  feed: string[];
  pendings: Pending[];
  discarding: { pid: string; need: number; endsAt: number } | null;
  winner: string | null;
}

const bankTotal = (cards: Card[]) => cards.reduce((s, c) => s + c.value, 0);
const groupComplete = (color: string, g: Group) => g.cards.length >= COLORS[color as ColorId].size;
const groupLegit = (color: string, g: Group) =>
  groupComplete(color, g) && g.cards.some((c) => c.kind === 'property');
const fullSetCount = (table: Table) =>
  Object.entries(table).filter(([color, g]) => groupLegit(color, g)).length;
const rentFor = (table: Table, color: string): number => {
  const g = table[color];
  if (!g || g.cards.length === 0) return 0;
  const meta = COLORS[color as ColorId];
  const n = Math.min(g.cards.length, meta.size);
  let rent = meta.rent[n - 1];
  if (groupComplete(color, g)) {
    if (g.house) rent += 3;
    if (g.hotel) rent += 4;
  }
  return rent;
};
// Cards you may pay debts with: bank cards + table property/wild cards with value > 0 (houses/hotels are anchored)
const payableCards = (bank: Card[], table: Table): Card[] => [
  ...bank,
  ...Object.values(table).flatMap((g) => g.cards.filter((c) => c.value > 0)),
];

// ---------- Card visuals ----------

const CardBack: React.FC<{ small?: boolean }> = ({ small }) => (
  <div
    className={`${small ? 'w-10 h-14 text-base' : 'w-14 h-20 text-xl'} rounded-lg bg-gradient-to-br from-indigo-600 via-purple-700 to-fuchsia-800 border-2 border-white/70 shadow-lg flex flex-col items-center justify-center text-white font-fredoka`}
  >
    <span>🃏</span>
    {!small && <span className="text-[9px] font-bold tracking-widest">DEAL</span>}
  </div>
);

const CardFace: React.FC<{ c: Card; small?: boolean; assignedColor?: string }> = ({ c, small, assignedColor }) => {
  const base = small ? 'w-16 h-24' : 'w-28 h-40';
  if (c.kind === 'property' && c.color) {
    const meta = COLORS[c.color];
    return (
      <div className={`${base} relative rounded-xl bg-white text-gray-800 shadow-xl overflow-hidden flex flex-col border border-gray-300`}>
        <div className={`${small ? 'h-5' : 'h-7'} ${meta.bg} ${meta.text} flex items-center justify-center font-fredoka font-bold ${small ? 'text-[8px]' : 'text-[10px]'} tracking-wide shrink-0`}>
          {meta.label.toUpperCase()}
        </div>
        <div className={`flex items-center justify-center font-nunito font-bold text-center px-1 ${small ? 'text-[9px] flex-1' : 'text-xs h-9'}`}>
          {c.name}
        </div>
        {!small && (
          <div className="px-1.5 pb-1 space-y-0.5 mt-auto">
            {meta.rent.map((r, i) => (
              <div
                key={i}
                className={`flex justify-between rounded px-1.5 py-px text-[8px] font-nunito ${
                  i === meta.size - 1 ? 'bg-amber-200 text-amber-800 font-bold' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span>{i === meta.size - 1 ? `★ SET (${meta.size})` : `${i + 1} card${i > 0 ? 's' : ''}`}</span>
                <span>{r}M</span>
              </div>
            ))}
          </div>
        )}
        <span className={`absolute top-0.5 right-1 font-fredoka font-bold drop-shadow ${small ? 'text-[8px]' : 'text-[10px]'} ${meta.text}`}>
          {c.value}M
        </span>
      </div>
    );
  }
  if (c.kind === 'wild') {
    if (c.any) {
      return (
        <div className={`${base} relative rounded-xl shadow-xl border border-gray-300 overflow-hidden flex flex-col items-center justify-center font-fredoka text-white`}
          style={{ background: 'conic-gradient(#92400e, #38bdf8, #ec4899, #f97316, #dc2626, #facc15, #16a34a, #1e40af, #1f2937, #84cc16, #92400e)' }}
        >
          <span className={`${small ? 'text-base' : 'text-3xl'} drop-shadow`}>🌈</span>
          <span className={`font-bold drop-shadow ${small ? 'text-[8px]' : 'text-xs'} bg-black/40 rounded px-1`}>WILD · ANY</span>
          {!small && <span className="text-[8px] font-nunito mt-1 bg-black/40 rounded px-1">$0 — can't be banked</span>}
          {assignedColor && (
            <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold rounded px-1 ${COLORS[assignedColor as ColorId].bg} ${COLORS[assignedColor as ColorId].text}`}>
              as {COLORS[assignedColor as ColorId].label}
            </span>
          )}
        </div>
      );
    }
    const [a, b] = c.colors!;
    return (
      <div className={`${base} relative rounded-xl bg-white shadow-xl border border-gray-300 overflow-hidden flex flex-col`}>
        <div className={`h-1/2 ${COLORS[a].bg} ${COLORS[a].text} flex items-center justify-center font-fredoka font-bold ${small ? 'text-[8px]' : 'text-[11px]'}`}>
          {COLORS[a].label.toUpperCase()}
        </div>
        <div className={`h-1/2 ${COLORS[b].bg} ${COLORS[b].text} flex items-center justify-center font-fredoka font-bold ${small ? 'text-[8px]' : 'text-[11px]'}`}>
          {COLORS[b].label.toUpperCase()}
        </div>
        <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-gray-800 rounded-full font-fredoka font-bold shadow ${small ? 'text-[7px] px-1' : 'text-[9px] px-1.5 py-0.5'}`}>
          WILD {c.value}M
        </span>
        {assignedColor && (
          <span className={`absolute bottom-0.5 right-0.5 text-[8px] font-bold rounded px-1 bg-black/60 text-white`}>
            ▶ {COLORS[assignedColor as ColorId].label}
          </span>
        )}
      </div>
    );
  }
  if (c.kind === 'rent') {
    if (c.any) {
      return (
        <div className={`${base} relative rounded-xl shadow-xl border border-gray-300 flex flex-col items-center justify-center font-fredoka text-white`}
          style={{ background: 'conic-gradient(#92400e, #38bdf8, #ec4899, #f97316, #dc2626, #facc15, #16a34a, #1e40af, #1f2937, #84cc16, #92400e)' }}
        >
          <span className={`bg-black/50 rounded-lg px-2 py-0.5 font-bold ${small ? 'text-[9px]' : 'text-sm'}`}>RENT</span>
          <span className={`bg-black/50 rounded px-1 mt-1 ${small ? 'text-[7px]' : 'text-[9px]'}`}>any colour · 1 player</span>
          <span className={`absolute top-0.5 right-1 font-bold ${small ? 'text-[8px]' : 'text-[10px]'} drop-shadow`}>{c.value}M</span>
        </div>
      );
    }
    const [a, b] = c.colors!;
    return (
      <div className={`${base} relative rounded-xl bg-white text-gray-800 shadow-xl border border-gray-300 overflow-hidden flex flex-col`}>
        <div className={`h-2/5 ${COLORS[a].bg}`} />
        <div className="flex-1 flex flex-col items-center justify-center">
          <span className={`font-fredoka font-bold ${small ? 'text-[9px]' : 'text-sm'}`}>RENT</span>
          {!small && <span className="text-[8px] font-nunito text-gray-500">all rivals pay</span>}
        </div>
        <div className={`h-2/5 ${COLORS[b].bg}`} />
        <span className={`absolute top-0.5 right-1 font-bold text-[9px] ${COLORS[a].text} drop-shadow`}>{c.value}M</span>
      </div>
    );
  }
  if (c.kind === 'money') {
    return (
      <div className={`${base} relative rounded-xl bg-gradient-to-br ${MONEY_STYLE[c.value] || MONEY_STYLE[1]} shadow-xl border-4 border-double border-white/80 flex flex-col items-center justify-center font-fredoka`}>
        <span className={small ? 'text-xl' : 'text-4xl'}>💵</span>
        <span className={`font-bold ${small ? 'text-sm' : 'text-2xl'}`}>{c.value}M</span>
        {!small && <span className="text-[9px] font-nunito font-bold tracking-widest mt-1 opacity-70">MONEY</span>}
      </div>
    );
  }
  const info = ACTION_INFO[c.action!];
  return (
    <div className={`${base} relative rounded-xl bg-gradient-to-br from-indigo-100 to-violet-200 text-indigo-900 shadow-xl border border-indigo-300 flex flex-col items-center justify-center font-fredoka px-1 text-center`}>
      <span className={small ? 'text-xl' : 'text-3xl'}>{info.emoji}</span>
      <span className={`font-bold leading-tight ${small ? 'text-[8px]' : 'text-xs'}`}>{info.label}</span>
      {!small && <span className="text-[8px] font-nunito leading-tight mt-1 text-indigo-700 px-0.5">{info.desc}</span>}
      <span className={`absolute top-0.5 right-1 font-bold ${small ? 'text-[8px]' : 'text-[10px]'} text-indigo-500`}>{c.value}M</span>
    </div>
  );
};

// ---------- Component ----------

type ModalStep =
  | 'main' | 'wildcolor' | 'rentcolor' | 'renttarget' | 'target' | 'prop' | 'myprop' | 'set';

const MonopolyDeal: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [s, setS] = useState<MDState | null>(null);
  const [sel, setSel] = useState<Card | null>(null);
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
  const xpGiven = useRef(false);

  const playersRef = useRef(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const byId = (id: string) =>
    players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', isHost: false, joinedAt: 0 };

  // Host-side authoritative state
  const hd = useRef({
    deck: [] as Card[],
    discard: [] as Card[],
    order: [] as string[],
    turnIdx: 0,
    playsLeft: 0,
    hands: {} as Record<string, Card[]>,
    bank: {} as Record<string, Card[]>,
    table: {} as Record<string, Table>,
    feed: [] as string[],
    pendings: [] as Pending[],
    discarding: null as { pid: string; need: number; endsAt: number } | null,
    winner: null as string | null,
    pidSeq: 1,
    timer: 0,
    turnTimer: 0,
    sweep: 0,
  });

  // ---- HOST: dealer & referee ----
  useEffect(() => {
    if (!isHost) return;
    const h = hd.current;
    h.deck = buildDeck();
    h.order = players.slice(0, 4).map((p) => p.id);
    h.order.forEach((id) => {
      h.hands[id] = [];
      h.bank[id] = [];
      h.table[id] = {};
    });

    const hostName = (id: string) => {
      const p = playersRef.current.find((x) => x.id === id);
      return p ? `${p.emoji} ${p.name}` : '👻 ???';
    };
    const pushFeed = (line: string) => {
      h.feed = [line, ...h.feed].slice(0, 4);
    };
    const draw = (pid: string, n: number) => {
      for (let i = 0; i < n; i++) {
        if (h.deck.length === 0) {
          h.deck = [...h.discard].sort(() => Math.random() - 0.5);
          h.discard = [];
        }
        const c = h.deck.pop();
        if (c) h.hands[pid].push(c);
      }
    };
    const broadcast = () => {
      const snapshot: MDState = JSON.parse(
        JSON.stringify({
          order: h.order,
          turn: h.order[h.turnIdx],
          playsLeft: h.playsLeft,
          hands: h.hands,
          bank: h.bank,
          table: h.table,
          deckCount: h.deck.length,
          discardTop: h.discard[h.discard.length - 1] || null,
          feed: h.feed,
          pendings: h.pendings,
          discarding: h.discarding,
          winner: h.winner,
        })
      );
      send({ t: 'md_state', s: snapshot });
    };

    // Official rule: you can only win on your own turn
    const winCheck = () => {
      if (h.winner) return;
      const pid = h.order[h.turnIdx];
      if (fullSetCount(h.table[pid]) >= SETS_TO_WIN) {
        h.winner = pid;
        pushFeed(`🏆 ${hostName(pid)} collected ${SETS_TO_WIN} full sets!`);
        window.clearTimeout(h.turnTimer);
        h.pendings = [];
        h.discarding = null;
      }
    };

    const groupOf = (pid: string, color: string): Group => {
      if (!h.table[pid][color]) h.table[pid][color] = { cards: [], house: null, hotel: null };
      return h.table[pid][color];
    };
    const removeTableCard = (pid: string, cardId: number): { card: Card; color: string } | null => {
      for (const [color, g] of Object.entries(h.table[pid])) {
        const card = g.cards.find((c) => c.id === cardId);
        if (card) {
          g.cards = g.cards.filter((c) => c.id !== cardId);
          if (g.cards.length === 0 && !g.house && !g.hotel) delete h.table[pid][color];
          return { card, color };
        }
      }
      return null;
    };
    const giveTableCard = (pid: string, card: Card, color: string) => {
      groupOf(pid, color).cards.push(card);
    };

    const transferPayment = (from: string, to: string, cardIds: number[]): string => {
      const parts: string[] = [];
      cardIds.forEach((cid) => {
        const inBank = h.bank[from].find((c) => c.id === cid);
        if (inBank) {
          h.bank[from] = h.bank[from].filter((c) => c.id !== cid);
          h.bank[to].push(inBank);
          parts.push(`${inBank.value}M`);
          return;
        }
        const fromTable = removeTableCard(from, cid);
        if (fromTable && fromTable.card.value > 0) {
          // Paid properties go straight to the receiver's property section
          giveTableCard(to, fromTable.card, fromTable.card.kind === 'property' ? fromTable.card.color! : fromTable.color);
          parts.push(fromTable.card.name || `${COLORS[fromTable.color as ColorId].label} wild`);
        }
      });
      return parts.length ? parts.join(' + ') : 'nothing';
    };

    const autoPaySelect = (from: string, amount: number): number[] => {
      let remaining = amount;
      const ids: number[] = [];
      const bankSorted = [...h.bank[from]].sort((a, b) => b.value - a.value);
      for (const c of bankSorted) {
        if (remaining <= 0) break;
        ids.push(c.id);
        remaining -= c.value;
      }
      if (remaining > 0) {
        const propCards: { card: Card; full: boolean }[] = [];
        Object.entries(h.table[from]).forEach(([color, g]) =>
          g.cards.forEach((card) => {
            if (card.value > 0) propCards.push({ card, full: groupComplete(color, g) });
          })
        );
        propCards.sort((a, b) => (a.full ? 1 : 0) - (b.full ? 1 : 0));
        for (const { card } of propCards) {
          if (remaining <= 0) break;
          ids.push(card.id);
          remaining -= card.value;
        }
      }
      return ids;
    };

    const resolvePayPending = (p: Pending, cardIds: number[]) => {
      const paid = transferPayment(p.targetId, p.actorId, cardIds);
      pushFeed(`${p.reason || '💸'} ${hostName(p.targetId)} paid: ${paid}`);
      h.pendings = h.pendings.filter((x) => x.pid !== p.pid);
    };

    const applySteal = (p: Pending) => {
      if (p.action === 'sly' && p.cardId !== undefined) {
        const got = removeTableCard(p.targetId, p.cardId);
        if (got) {
          giveTableCard(p.actorId, got.card, got.card.kind === 'property' ? got.card.color! : got.color);
          pushFeed(`🦊 ${hostName(p.actorId)} stole ${got.card.name || 'a wildcard'}!`);
        }
      } else if (p.action === 'forced' && p.cardId !== undefined && p.myCardId !== undefined) {
        const theirs = removeTableCard(p.targetId, p.cardId);
        const mine = removeTableCard(p.actorId, p.myCardId);
        if (theirs) giveTableCard(p.actorId, theirs.card, theirs.card.kind === 'property' ? theirs.card.color! : theirs.color);
        if (mine) giveTableCard(p.targetId, mine.card, mine.card.kind === 'property' ? mine.card.color! : mine.color);
        pushFeed(`🔁 ${hostName(p.actorId)} swapped ${mine?.card.name || 'a card'} for ${theirs?.card.name || 'a card'}!`);
      } else if (p.action === 'breaker' && p.color) {
        const g = h.table[p.targetId][p.color];
        if (g && groupComplete(p.color, g)) {
          delete h.table[p.targetId][p.color];
          const mine = groupOf(p.actorId, p.color);
          mine.cards.push(...g.cards);
          // House & hotel travel with the stolen set
          if (g.house && !mine.house) mine.house = g.house;
          else if (g.house) h.discard.push(g.house);
          if (g.hotel && !mine.hotel) mine.hotel = g.hotel;
          else if (g.hotel) h.discard.push(g.hotel);
          pushFeed(`💥 ${hostName(p.actorId)} DEAL-BREAKED the ${COLORS[p.color as ColorId].label} set!`);
        }
      }
      h.pendings = h.pendings.filter((x) => x.pid !== p.pid);
    };

    const proceedPending = (p: Pending) => {
      // No (more) Just-Say-No — execute the effect
      if (p.kind === 'steal') {
        applySteal(p);
      } else {
        p.phase = 'pay';
        p.jsnDecider = null;
        p.endsAt = Date.now() + PAY_MS;
      }
    };

    const startTurn = () => {
      if (h.winner) return;
      const pid = h.order[h.turnIdx];
      // Turn-locked win: sets completed by payments count at the start of your turn
      winCheck();
      if (h.winner) {
        broadcast();
        return;
      }
      // Empty-hand rule: draw 5 instead of 2
      const n = h.hands[pid].length === 0 ? 5 : 2;
      draw(pid, n);
      h.playsLeft = PLAYS_PER_TURN;
      pushFeed(`▶️ ${hostName(pid)}'s turn — drew ${n} card${n > 1 ? 's' : ''}`);
      broadcast();
      window.clearTimeout(h.turnTimer);
      h.turnTimer = window.setTimeout(() => {
        if (h.pendings.length > 0 || h.discarding) {
          h.turnTimer = window.setTimeout(() => requestEnd(true), 8000);
        } else {
          pushFeed(`⏰ ${hostName(pid)} ran out of time`);
          requestEnd(true);
        }
      }, TURN_MS);
    };

    const finishEnd = () => {
      if (h.winner) return;
      window.clearTimeout(h.timer);
      h.turnIdx = (h.turnIdx + 1) % h.order.length;
      startTurn();
    };

    const requestEnd = (auto: boolean) => {
      if (h.winner || h.pendings.length > 0) return;
      const pid = h.order[h.turnIdx];
      winCheck();
      if (h.winner) {
        broadcast();
        return;
      }
      // Hand limit: max 7 at the END of your turn
      if (h.hands[pid].length > HAND_LIMIT) {
        h.discarding = { pid, need: h.hands[pid].length - HAND_LIMIT, endsAt: Date.now() + DISCARD_MS };
        if (!auto) pushFeed(`🗑️ ${hostName(pid)} must discard down to ${HAND_LIMIT}`);
        broadcast();
        return;
      }
      finishEnd();
    };

    const charge = (actorId: string, targetId: string, amount: number, reason: string, chainable: boolean) => {
      if (amount <= 0) return;
      const assets = payableCards(h.bank[targetId], h.table[targetId]);
      if (assets.length === 0) {
        // Bankruptcy: nothing on the table = debt forgiven
        pushFeed(`🫥 ${hostName(targetId)} is broke — debt forgiven!`);
        return;
      }
      const hasJsn = h.hands[targetId].some((c) => c.action === 'jsn');
      h.pendings.push({
        pid: h.pidSeq++,
        kind: 'pay',
        action: 'rent',
        actorId,
        targetId,
        amount,
        reason,
        chainable,
        jsnDecider: hasJsn ? targetId : null,
        phase: hasJsn ? 'jsn' : 'pay',
        endsAt: Date.now() + (hasJsn ? JSN_MS : PAY_MS),
      });
    };

    const afterPlay = () => {
      winCheck();
      broadcast();
    };

    // Periodic sweep: resolves expired JSN windows, payments and discards
    h.sweep = window.setInterval(() => {
      if (h.winner) return;
      const now = Date.now();
      let changed = false;
      [...h.pendings].forEach((p) => {
        if (now < p.endsAt) return;
        changed = true;
        if (p.phase === 'jsn') {
          if (p.jsnDecider === p.actorId) {
            // Actor didn't counter — the block stands, action cancelled
            pushFeed(`🙅 The action was blocked!`);
            h.pendings = h.pendings.filter((x) => x.pid !== p.pid);
          } else {
            proceedPending(p);
          }
        } else if (p.kind === 'pay') {
          resolvePayPending(p, autoPaySelect(p.targetId, p.amount || 0));
        }
      });
      if (h.discarding && now >= h.discarding.endsAt) {
        const { pid, need } = h.discarding;
        const dump = h.hands[pid].slice(-need);
        h.hands[pid] = h.hands[pid].slice(0, h.hands[pid].length - need);
        h.discard.push(...dump);
        pushFeed(`🗑️ ${hostName(pid)} auto-discarded ${need}`);
        h.discarding = null;
        changed = true;
        finishEnd();
        return;
      }
      if (changed) {
        winCheck();
        broadcast();
      }
    }, 700);

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (h.winner) return;
      const currentPid = h.order[h.turnIdx];

      // --- Just Say No decisions ---
      if (m.t === 'md_jsn') {
        const p = h.pendings.find((x) => x.pid === m.pendingId);
        if (!p || p.phase !== 'jsn' || p.jsnDecider !== m.from) return;
        if (m.use) {
          const jsnCard = h.hands[m.from].find((c) => c.action === 'jsn');
          if (!jsnCard) return;
          h.hands[m.from] = h.hands[m.from].filter((c) => c.id !== jsnCard.id);
          h.discard.push(jsnCard);
          if (m.from === p.targetId) {
            pushFeed(`🙅 ${hostName(p.targetId)} says JUST SAY NO!`);
            // The attacker may counter with their own JSN (chain rule)
            if (p.chainable && h.hands[p.actorId].some((c) => c.action === 'jsn')) {
              p.jsnDecider = p.actorId;
              p.endsAt = Date.now() + JSN_MS;
            } else {
              h.pendings = h.pendings.filter((x) => x.pid !== p.pid);
            }
          } else {
            pushFeed(`😈 ${hostName(p.actorId)} counters with their OWN Just Say No!`);
            // Target may JSN again
            if (h.hands[p.targetId].some((c) => c.action === 'jsn')) {
              p.jsnDecider = p.targetId;
              p.endsAt = Date.now() + JSN_MS;
            } else {
              proceedPending(p);
            }
          }
        } else {
          if (m.from === p.targetId) proceedPending(p);
          else h.pendings = h.pendings.filter((x) => x.pid !== p.pid); // attacker accepts the block
        }
        winCheck();
        broadcast();
        return;
      }

      // --- Payment selections ---
      if (m.t === 'md_pay') {
        const p = h.pendings.find((x) => x.pid === m.pendingId);
        if (!p || p.kind !== 'pay' || p.phase !== 'pay' || p.targetId !== m.from) return;
        const ids = (m.cardIds as number[]) || [];
        const eligible = payableCards(h.bank[m.from], h.table[m.from]);
        const eligibleIds = new Set(eligible.map((c) => c.id));
        if (!ids.every((id) => eligibleIds.has(id))) return;
        const total = eligible.filter((c) => ids.includes(c.id)).reduce((sum, c) => sum + c.value, 0);
        const allAssets = ids.length === eligible.length;
        if (total < (p.amount || 0) && !allAssets) return;
        resolvePayPending(p, ids);
        winCheck();
        broadcast();
        return;
      }

      // --- End-of-turn discard selection ---
      if (m.t === 'md_discard') {
        if (!h.discarding || h.discarding.pid !== m.from) return;
        const ids = (m.cardIds as number[]) || [];
        if (ids.length !== h.discarding.need) return;
        const hand = h.hands[m.from];
        if (!ids.every((id) => hand.some((c) => c.id === id))) return;
        ids.forEach((id) => {
          const c = hand.find((x) => x.id === id)!;
          h.discard.push(c);
        });
        h.hands[m.from] = hand.filter((c) => !ids.includes(c.id));
        h.discarding = null;
        broadcast();
        finishEnd();
        return;
      }

      // --- Wildcard rearranging (free, own turn only) ---
      if (m.t === 'md_flip') {
        if (m.from !== currentPid || h.pendings.length > 0 || h.discarding) return;
        const got = removeTableCard(m.from, Number(m.cardId));
        if (!got) return;
        const card = got.card;
        const toColor = String(m.color);
        const valid =
          card.kind === 'wild' &&
          (card.any ? COLOR_IDS.includes(toColor as ColorId) : (card.colors || []).includes(toColor as ColorId));
        giveTableCard(m.from, card, valid ? toColor : got.color);
        if (valid) pushFeed(`↔️ ${hostName(m.from)} moved a wildcard to ${COLORS[toColor as ColorId].label}`);
        broadcast();
        return;
      }

      if (m.from !== currentPid || h.pendings.length > 0 || h.discarding) return;

      if (m.t === 'md_end') {
        requestEnd(false);
        return;
      }

      if (m.t !== 'md_play' || h.playsLeft <= 0) return;
      const hand = h.hands[currentPid];
      const card = hand.find((c) => c.id === m.cardId);
      if (!card) return;
      const removeFromHand = () => {
        h.hands[currentPid] = h.hands[currentPid].filter((c) => c.id !== card.id);
      };
      const opponents = h.order.filter((id) => id !== currentPid);

      // Bank it (money, actions, rent cards, dual wilds — anything with value; never plain properties)
      if (m.mode === 'money') {
        if (card.kind === 'property' || card.value <= 0) return;
        removeFromHand();
        h.bank[currentPid].push(card);
        h.playsLeft -= 1;
        pushFeed(`💰 ${hostName(currentPid)} banked ${card.value}M`);
        afterPlay();
        return;
      }

      // Lay out a property or wildcard
      if (m.mode === 'property') {
        let color: string | null = null;
        if (card.kind === 'property') color = card.color!;
        else if (card.kind === 'wild') {
          const want = String(m.color || '');
          if (card.any ? COLOR_IDS.includes(want as ColorId) : (card.colors || []).includes(want as ColorId)) color = want;
        }
        if (!color) return;
        removeFromHand();
        giveTableCard(currentPid, card, color);
        h.playsLeft -= 1;
        pushFeed(`🏠 ${hostName(currentPid)} played ${card.name || 'a wildcard'} (${COLORS[color as ColorId].label})`);
        afterPlay();
        return;
      }

      // Rent cards
      if (m.mode === 'rent' && card.kind === 'rent') {
        const color = String(m.color || '');
        const okColor = card.any ? COLOR_IDS.includes(color as ColorId) : (card.colors || []).includes(color as ColorId);
        const g = h.table[currentPid][color];
        if (!okColor || !g || g.cards.length === 0) return;
        // Double the Rent costs an extra play
        let mult = 1;
        let doubleCard: Card | undefined;
        if (m.doubleId !== undefined && m.doubleId !== null) {
          doubleCard = hand.find((c) => c.id === Number(m.doubleId) && c.action === 'double_rent');
          if (!doubleCard || h.playsLeft < 2) return;
          mult = 2;
        }
        removeFromHand();
        h.discard.push(card);
        if (doubleCard) {
          h.hands[currentPid] = h.hands[currentPid].filter((c) => c.id !== doubleCard!.id);
          h.discard.push(doubleCard);
          h.playsLeft -= 2;
        } else {
          h.playsLeft -= 1;
        }
        const amount = rentFor(h.table[currentPid], color) * mult;
        if (card.any) {
          const tgt = String(m.target || '');
          if (!opponents.includes(tgt)) return;
          pushFeed(`🧾 ${hostName(currentPid)} charges ${hostName(tgt)} ${amount}M ${COLORS[color as ColorId].label} rent${mult > 1 ? ' (DOUBLED!)' : ''}!`);
          charge(currentPid, tgt, amount, '🧾', true);
        } else {
          pushFeed(`🧾 ${hostName(currentPid)} charges EVERYONE ${amount}M ${COLORS[color as ColorId].label} rent${mult > 1 ? ' (DOUBLED!)' : ''}!`);
          opponents.forEach((opp) => charge(currentPid, opp, amount, '🧾', false));
        }
        afterPlay();
        return;
      }

      // Action cards
      if (m.mode === 'action' && card.kind === 'action' && card.action && card.action !== 'jsn' && card.action !== 'double_rent') {
        if (card.action === 'pass_go') {
          removeFromHand();
          h.discard.push(card);
          draw(currentPid, 2);
          h.playsLeft -= 1;
          pushFeed(`🎁 ${hostName(currentPid)} passed GO — drew 2`);
          afterPlay();
          return;
        }
        if (card.action === 'birthday') {
          removeFromHand();
          h.discard.push(card);
          h.playsLeft -= 1;
          pushFeed(`🎂 It's ${hostName(currentPid)}'s birthday — everyone pays 2M!`);
          opponents.forEach((opp) => charge(currentPid, opp, 2, '🎂', false));
          afterPlay();
          return;
        }
        if (card.action === 'house' || card.action === 'hotel') {
          const color = String(m.color || '');
          const g = h.table[currentPid][color];
          if (!g || !groupComplete(color, g) || color === 'rr' || color === 'util') return;
          if (card.action === 'house' && g.house) return;
          if (card.action === 'hotel' && (!g.house || g.hotel)) return;
          removeFromHand();
          if (card.action === 'house') g.house = card;
          else g.hotel = card;
          h.playsLeft -= 1;
          pushFeed(`${card.action === 'house' ? '🏠' : '🏨'} ${hostName(currentPid)} built on ${COLORS[color as ColorId].label}!`);
          afterPlay();
          return;
        }

        const tgt = String(m.target || '');
        if (!opponents.includes(tgt)) return;

        if (card.action === 'debt') {
          removeFromHand();
          h.discard.push(card);
          h.playsLeft -= 1;
          pushFeed(`💼 ${hostName(currentPid)} demands 5M from ${hostName(tgt)}!`);
          charge(currentPid, tgt, 5, '💼', true);
          afterPlay();
          return;
        }

        if (card.action === 'sly' || card.action === 'forced' || card.action === 'breaker') {
          if (card.action === 'sly' || card.action === 'forced') {
            const pCardId = Number(m.propId);
            const okSteal = Object.entries(h.table[tgt]).some(
              ([color, g]) => !groupComplete(color, g) && g.cards.some((c) => c.id === pCardId)
            );
            if (!okSteal) return;
          }
          if (card.action === 'forced') {
            const myCardId = Number(m.myPropId);
            const okMine = Object.entries(h.table[currentPid]).some(
              ([color, g]) => !groupComplete(color, g) && g.cards.some((c) => c.id === myCardId)
            );
            if (!okMine) return;
          }
          if (card.action === 'breaker') {
            const color = String(m.color || '');
            const g = h.table[tgt][color];
            if (!g || !groupComplete(color, g)) return;
          }
          removeFromHand();
          h.discard.push(card);
          h.playsLeft -= 1;
          const hasJsn = h.hands[tgt].some((c) => c.action === 'jsn');
          const pend: Pending = {
            pid: h.pidSeq++,
            kind: 'steal',
            action: card.action,
            actorId: currentPid,
            targetId: tgt,
            color: m.color ? String(m.color) : undefined,
            cardId: card.action === 'breaker' ? undefined : Number(m.propId),
            myCardId: card.action === 'forced' ? Number(m.myPropId) : undefined,
            chainable: true,
            jsnDecider: hasJsn ? tgt : null,
            phase: hasJsn ? 'jsn' : 'pay',
            endsAt: Date.now() + JSN_MS,
          };
          if (hasJsn) {
            h.pendings.push(pend);
            pushFeed(`⚡ ${hostName(currentPid)} plays ${ACTION_INFO[card.action].label} on ${hostName(tgt)}!`);
          } else {
            h.pendings.push(pend);
            applySteal(pend);
          }
          afterPlay();
          return;
        }
      }
    });

    // Deal 5 cards each, then start
    h.timer = window.setTimeout(() => {
      h.order.forEach((id) => draw(id, 5));
      pushFeed(`🃏 Cards dealt — collect ${SETS_TO_WIN} full sets to win!`);
      startTurn();
    }, 1200);

    return () => {
      offMsg();
      window.clearTimeout(h.timer);
      window.clearTimeout(h.turnTimer);
      window.clearInterval(h.sweep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- EVERYONE: state sync ----
  useEffect(() => {
    return onMessage((raw) => {
      const m = raw as any;
      if (m.t !== 'md_state') return;
      const st = m.s as MDState;
      setS((prev) => {
        if (!prev) {
          setDealing(true);
          [200, 500, 800, 1100, 1400].forEach((d) => window.setTimeout(() => playPop(), d));
          window.setTimeout(() => setDealing(false), 2400);
        }
        const hadMine = prev?.pendings.some((p) => p.targetId === myId) || false;
        const hasMine = st.pendings.some((p) => p.targetId === myId);
        if (hasMine && !hadMine) playWrong();
        if (st.winner && (!prev || !prev.winner)) {
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(st.winner === myId ? 50 : 15);
          }
          if (st.winner === myId) playWin();
        }
        // Reset local selections when the relevant prompt disappears
        if (!st.pendings.some((p) => p.targetId === myId && p.phase === 'pay')) setPaySel([]);
        if (!st.discarding || st.discarding.pid !== myId) setDiscardSel([]);
        return st;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1s ticker for countdowns
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
    send({ t: 'md_play', ...payload });
    closeModal();
  };

  const secsLeft = (endsAt: number) => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

  const myTable = s?.table[myId] || {};
  const doubleInHand = myHand.find((c) => c.action === 'double_rent');

  const payEligible = s ? payableCards(s.bank[myId] || [], myTable) : [];
  const paySelTotal = payEligible.filter((c) => paySel.includes(c.id)).reduce((sum, c) => sum + c.value, 0);
  const payOk = myPayPending
    ? paySelTotal >= (myPayPending.amount || 0) || paySel.length === payEligible.length
    : false;

  const togglePay = (id: number) => {
    playClick();
    setPaySel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const TableGroups: React.FC<{ table: Table; owner: string }> = ({ table, owner }) => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(table).map(([color, g]) => {
        const meta = COLORS[color as ColorId];
        const complete = groupComplete(color, g);
        const legit = groupLegit(color, g);
        return (
          <div
            key={color}
            className={`rounded-xl p-1.5 ${legit ? 'bg-amber-400/25 ring-2 ring-amber-300 shadow-lg' : complete ? 'bg-amber-400/10 ring-1 ring-amber-300/50' : 'bg-black/20'}`}
          >
            <div className="flex items-start">
              {g.cards.map((c, i) => (
                <div key={c.id} className={`relative ${i > 0 ? '-ml-10' : ''}`}>
                  <CardFace c={c} small assignedColor={c.kind === 'wild' ? color : undefined} />
                  {c.kind === 'wild' && owner === myId && isMyTurn && !busy && !s?.winner && (
                    <button
                      onClick={() => { playClick(); setFlipCard(c); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold shadow flex items-center justify-center"
                      title="Move this wildcard"
                    >
                      ↔
                    </button>
                  )}
                </div>
              ))}
              {(g.house || g.hotel) && (
                <div className="ml-1 flex flex-col gap-0.5 text-base leading-none">
                  {g.house && <span title="House +3M">🏠</span>}
                  {g.hotel && <span title="Hotel +4M">🏨</span>}
                </div>
              )}
            </div>
            <div className={`text-center text-[9px] font-fredoka mt-1 ${legit ? 'text-amber-300 font-bold' : 'text-white/70'}`}>
              {meta.label} {g.cards.length}/{meta.size}
              {legit ? ' ⭐' : complete ? ' (needs a real property!)' : ''} · rent {rentFor(table, color)}M
            </div>
          </div>
        );
      })}
      {Object.keys(table).length === 0 && (
        <span className="text-[10px] font-nunito text-white/40 py-2">{owner === myId ? 'Play property cards here to build sets!' : 'no properties yet'}</span>
      )}
    </div>
  );

  const renderPendingBanner = () => {
    if (!s || s.pendings.length === 0) return null;
    const p = s.pendings[0];
    if (p.targetId === myId || p.jsnDecider === myId) return null;
    const txt =
      p.phase === 'jsn'
        ? `🙅 ${byId(p.jsnDecider || '').name} is deciding whether to JUST SAY NO…`
        : `💸 waiting for ${byId(p.targetId).name} to pay ${p.amount}M…`;
    return (
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="fixed top-3 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 rounded-full px-5 py-2 font-fredoka text-sm shadow-xl">
        {txt}
      </motion.div>
    );
  };

  return (
    <div
      className="min-h-screen text-white px-3 py-6"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #166534 0%, #14532d 45%, #052e16 100%)' }}
    >
      <div className="max-w-3xl mx-auto pt-6 pb-56">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1 drop-shadow-lg">🃏 Monopoly Deal</h1>
        <p className="text-center font-nunito text-emerald-200 text-sm mb-4">
          Official rules — first to {SETS_TO_WIN} complete sets wins (on your own turn)!
        </p>

        {!s && (
          <div className="text-center font-fredoka text-xl bg-black/30 rounded-3xl p-8 border border-white/10">
            🃏 Shuffling 106 cards…
          </div>
        )}

        {s && !inGame && (
          <div className="text-center font-nunito bg-black/30 rounded-2xl p-3 mb-3 text-emerald-200">
            👀 You're spectating this match — join the next one!
          </div>
        )}

        {s && (
          <>
            {/* Opponents */}
            <div className={`grid gap-2 mb-3 ${opponents.length > 2 ? 'md:grid-cols-3 grid-cols-1' : opponents.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {opponents.map((id) => (
                <div
                  key={id}
                  className={`rounded-2xl p-2.5 border-2 ${s.turn === id ? 'border-amber-400 bg-amber-400/10 shadow-lg' : 'border-white/10 bg-black/25'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-fredoka text-sm truncate">
                      {s.turn === id && <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>▶ </motion.span>}
                      {byId(id).emoji} {byId(id).name}
                    </span>
                    <span className="font-fredoka text-xs text-amber-300">⭐{fullSetCount(s.table[id] || {})}/{SETS_TO_WIN}</span>
                  </div>
                  <div className="flex items-center gap-2 font-nunito text-xs text-emerald-200 mb-1.5">
                    <span className="bg-emerald-900/60 rounded-full px-2 py-0.5">💰 {bankTotal(s.bank[id] || [])}M</span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: Math.min(8, (s.hands[id] || []).length) }).map((_, i) => (
                        <span key={i} className="inline-block w-2.5 h-4 rounded-sm bg-gradient-to-b from-indigo-500 to-purple-700 border border-white/50 -ml-1 first:ml-0" />
                      ))}
                      <span className="ml-1">{(s.hands[id] || []).length}</span>
                    </span>
                  </div>
                  <TableGroups table={s.table[id] || {}} owner={id} />
                </div>
              ))}
            </div>

            {/* Table centre */}
            <div className="bg-black/30 rounded-2xl border border-white/10 p-3 mb-3">
              <div className="flex items-center justify-between font-fredoka text-sm mb-2">
                <span className="text-emerald-300">The Table</span>
                <span className={isMyTurn ? 'text-amber-300' : 'text-white/70'}>
                  {s.winner
                    ? '🏁 Game over'
                    : isMyTurn
                    ? `YOUR TURN · plays: ${'🂠'.repeat(s.playsLeft)}${'·'.repeat(Math.max(0, PLAYS_PER_TURN - s.playsLeft))}`
                    : `${byId(s.turn).emoji} ${byId(s.turn).name}'s turn`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="shrink-0 text-center">
                  <div className="relative w-14 h-20">
                    <div className="absolute top-1 left-1 opacity-50"><CardBack /></div>
                    <div className="absolute top-0.5 left-0.5 opacity-75"><CardBack /></div>
                    <div className="absolute top-0 left-0"><CardBack /></div>
                    <span className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-950 font-fredoka font-bold text-[10px] rounded-full px-1.5 py-0.5 shadow">
                      {s.deckCount}
                    </span>
                  </div>
                  <div className="text-[9px] font-fredoka text-white/60 mt-1.5">DRAW</div>
                </div>
                <div className="flex-1 min-w-0">
                  {s.feed.map((line, i) => (
                    <div key={`${i}-${line}`} className={`font-nunito text-xs truncate ${i === 0 ? 'text-white font-bold' : 'text-white/45'}`}>
                      {line}
                    </div>
                  ))}
                </div>
                <div className="shrink-0 text-center">
                  {s.discardTop ? (
                    <motion.div key={s.discardTop.id} initial={{ scale: 1.3, rotate: 8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}>
                      <CardFace c={s.discardTop} small />
                    </motion.div>
                  ) : (
                    <div className="w-16 h-24 rounded-xl border-2 border-dashed border-white/20" />
                  )}
                  <div className="text-[9px] font-fredoka text-white/60 mt-1">PLAYED</div>
                </div>
              </div>
            </div>

            {/* My table */}
            {inGame && (
              <div className={`rounded-2xl p-3 border-2 mb-3 ${isMyTurn ? 'border-amber-400 bg-amber-400/10 shadow-lg' : 'border-white/10 bg-black/25'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-fredoka text-sm">
                    {byId(myId).emoji} Your table · <span className="text-emerald-300">💰 {bankTotal(s.bank[myId] || [])}M</span> ·{' '}
                    <span className="text-amber-300">⭐ {fullSetCount(myTable)}/{SETS_TO_WIN} sets</span>
                  </span>
                  {isMyTurn && !s.winner && !busy && (
                    <button
                      onClick={() => { playClick(); send({ t: 'md_end' }); }}
                      className="rounded-full px-4 py-1 font-fredoka text-xs bg-white/15 border border-white/30 hover:bg-white/25"
                    >
                      End turn ⏭️
                    </button>
                  )}
                </div>
                <TableGroups table={myTable} owner={myId} />
              </div>
            )}
          </>
        )}
      </div>

      {/* My hand (docked bottom) */}
      {s && inGame && !s.winner && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/60 backdrop-blur border-t border-white/10 px-3 pt-2 pb-3 z-30">
          <div className="max-w-3xl mx-auto">
            <div className="font-fredoka text-xs text-emerald-300 mb-1.5">
              ✋ Your hand ({myHand.length}/{HAND_LIMIT} at turn end)
              {isMyTurn && s.playsLeft > 0 && !busy ? ' — tap a card to play it!' : ''}
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
                    whileHover={{ y: -10 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      if (!isMyTurn || s.playsLeft <= 0 || busy) return;
                      playClick();
                      setSel(c);
                      setStep('main');
                    }}
                    className={`shrink-0 ${isMyTurn && s.playsLeft > 0 && !busy ? 'cursor-pointer' : 'opacity-60'}`}
                  >
                    <CardFace c={c} />
                  </motion.button>
                ))}
              </AnimatePresence>
              {myHand.length === 0 && <span className="font-nunito text-white/40 text-sm py-6">Empty hand — you'll draw 5 next turn!</span>}
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

        {/* Play-a-card modal */}
        {sel && s && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4">
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/20 rounded-3xl p-5 max-w-sm w-full max-h-[85vh] overflow-y-auto">
              <div className="flex justify-center mb-3"><CardFace c={sel} /></div>

              {step === 'main' && (
                <div className="grid gap-2">
                  {sel.kind === 'property' && (
                    <button onClick={() => play({ cardId: sel.id, mode: 'property' })} className="rounded-2xl py-3 font-fredoka font-bold bg-gradient-to-r from-emerald-400 to-green-500">
                      🏠 Add to my properties
                    </button>
                  )}
                  {sel.kind === 'wild' && (
                    <button onClick={() => { playClick(); setStep('wildcolor'); }} className="rounded-2xl py-3 font-fredoka font-bold bg-gradient-to-r from-emerald-400 to-green-500">
                      🌈 Play as property — choose colour
                    </button>
                  )}
                  {sel.kind === 'rent' && (
                    <button onClick={() => { playClick(); setStep('rentcolor'); }} className="rounded-2xl py-3 font-fredoka font-bold bg-gradient-to-r from-violet-400 to-purple-500">
                      🧾 Charge rent!
                    </button>
                  )}
                  {sel.kind === 'action' && sel.action !== 'jsn' && sel.action !== 'double_rent' && (
                    <button
                      onClick={() => {
                        if (sel.action === 'pass_go' || sel.action === 'birthday') { play({ cardId: sel.id, mode: 'action' }); return; }
                        if (sel.action === 'house' || sel.action === 'hotel') { playClick(); setStep('set'); return; }
                        playClick(); setStep('target');
                      }}
                      className="rounded-2xl py-3 font-fredoka font-bold bg-gradient-to-r from-violet-400 to-purple-500"
                    >
                      {ACTION_INFO[sel.action!].emoji} {ACTION_INFO[sel.action!].desc}
                    </button>
                  )}
                  {sel.kind !== 'property' && sel.value > 0 && (
                    <button onClick={() => play({ cardId: sel.id, mode: 'money' })} className="rounded-2xl py-3 font-fredoka font-bold bg-gradient-to-r from-amber-400 to-orange-500">
                      💰 Bank it ({sel.value}M)
                    </button>
                  )}
                  {sel.action === 'jsn' && (
                    <div className="text-center font-nunito text-xs text-white/60">
                      🙅 Worth $0 — it can't be banked. Keep it in your hand to block attacks!
                    </div>
                  )}
                  {sel.action === 'double_rent' && (
                    <div className="text-center font-nunito text-xs text-white/60">
                      ✖️ Play it together with a Rent card (pick a Rent card and you'll get the option) — or bank it for 1M.
                    </div>
                  )}
                  {sel.kind === 'wild' && sel.any && (
                    <div className="text-center font-nunito text-xs text-white/60">🌈 Worth $0 — can't be banked or used to pay debts.</div>
                  )}
                  <button onClick={() => { playClick(); closeModal(); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">
                    Cancel
                  </button>
                </div>
              )}

              {step === 'wildcolor' && sel.kind === 'wild' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Which colour set?</div>
                  {(sel.any ? COLOR_IDS : sel.colors || []).map((color) => (
                    <button key={color} onClick={() => play({ cardId: sel.id, mode: 'property', color })} className={`rounded-2xl py-2.5 font-fredoka font-bold ${COLORS[color].bg} ${COLORS[color].text}`}>
                      {COLORS[color].label} ({(myTable[color]?.cards.length || 0)}/{COLORS[color].size})
                    </button>
                  ))}
                  <button onClick={() => { playClick(); setStep('main'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'rentcolor' && sel.kind === 'rent' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">
                    {sel.any ? 'Any colour you own — charges ONE player:' : 'Charge which colour? (everyone pays)'}
                  </div>
                  {(sel.any ? COLOR_IDS.filter((c) => (myTable[c]?.cards.length || 0) > 0) : (sel.colors || [])).map((color) => {
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
                        className={`rounded-2xl py-2.5 font-fredoka font-bold ${owned ? `${COLORS[color].bg} ${COLORS[color].text}` : 'bg-white/5 text-white/30'}`}
                      >
                        {COLORS[color].label} — {owned ? `${amt}M` : 'you own none'}
                      </button>
                    );
                  })}
                  {doubleInHand && (s?.playsLeft || 0) >= 2 && (
                    <button
                      onClick={() => { playClick(); setUseDouble(!useDouble); }}
                      className={`rounded-2xl py-2 font-fredoka text-sm border-2 ${useDouble ? 'bg-amber-400/30 border-amber-300' : 'bg-white/5 border-white/20'}`}
                    >
                      ✖️ Add "Double the Rent" {useDouble ? '✅ (uses 2 plays)' : '(uses 2 plays)'}
                    </button>
                  )}
                  <button onClick={() => { playClick(); setStep('main'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'renttarget' && sel.kind === 'rent' && rentColor && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Who pays the {rentFor(myTable, rentColor) * (useDouble ? 2 : 1)}M?</div>
                  {opponents.map((id) => (
                    <button
                      key={id}
                      onClick={() => play({ cardId: sel.id, mode: 'rent', color: rentColor, target: id, doubleId: useDouble && doubleInHand ? doubleInHand.id : undefined })}
                      className="rounded-2xl py-3 font-fredoka font-bold bg-white/15 border border-white/30 hover:bg-white/25"
                    >
                      {byId(id).emoji} {byId(id).name} (💰{bankTotal(s.bank[id] || [])}M)
                    </button>
                  ))}
                  <button onClick={() => { playClick(); setStep('rentcolor'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'set' && (sel.action === 'house' || sel.action === 'hotel') && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Build on which complete set?</div>
                  {Object.entries(myTable)
                    .filter(([color, g]) =>
                      groupComplete(color, g) && color !== 'rr' && color !== 'util' &&
                      (sel.action === 'house' ? !g.house : g.house && !g.hotel)
                    )
                    .map(([color]) => (
                      <button key={color} onClick={() => play({ cardId: sel.id, mode: 'action', color })} className={`rounded-2xl py-3 font-fredoka font-bold ${COLORS[color as ColorId].bg} ${COLORS[color as ColorId].text}`}>
                        {ACTION_INFO[sel.action!].emoji} {COLORS[color as ColorId].label} set
                      </button>
                    ))}
                  {Object.entries(myTable).filter(([color, g]) =>
                    groupComplete(color, g) && color !== 'rr' && color !== 'util' &&
                    (sel.action === 'house' ? !g.house : g.house && !g.hotel)
                  ).length === 0 && (
                    <div className="text-center font-nunito text-sm text-red-300">
                      {sel.action === 'house' ? 'You need a complete set first (not Railroad/Utility)!' : 'You need a complete set with a House first!'}
                    </div>
                  )}
                  <button onClick={() => { playClick(); setStep('main'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'target' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Pick your target:</div>
                  {opponents.map((id) => {
                    const tt = s.table[id] || {};
                    const slyOk = Object.entries(tt).some(([color, g]) => !groupComplete(color, g) && g.cards.length > 0);
                    const breakOk = Object.entries(tt).some(([color, g]) => groupComplete(color, g));
                    const disabled =
                      ((sel.action === 'sly' || sel.action === 'forced') && !slyOk) ||
                      (sel.action === 'breaker' && !breakOk);
                    return (
                      <button
                        key={id}
                        disabled={disabled}
                        onClick={() => {
                          playClick();
                          setTarget(id);
                          if (sel.action === 'debt') { play({ cardId: sel.id, mode: 'action', target: id }); return; }
                          setStep('prop');
                        }}
                        className={`rounded-2xl py-3 font-fredoka font-bold ${disabled ? 'bg-white/5 text-white/30' : 'bg-white/15 border border-white/30 hover:bg-white/25'}`}
                      >
                        {byId(id).emoji} {byId(id).name}
                        {disabled && <span className="block text-[10px] font-nunito">nothing to take</span>}
                      </button>
                    );
                  })}
                  <button onClick={() => { playClick(); setStep('main'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'prop' && target && sel.action === 'breaker' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Steal which complete set?</div>
                  {Object.entries(s.table[target] || {})
                    .filter(([color, g]) => groupComplete(color, g))
                    .map(([color, g]) => (
                      <button key={color} onClick={() => play({ cardId: sel.id, mode: 'action', target, color })} className={`rounded-2xl py-3 font-fredoka font-bold ${COLORS[color as ColorId].bg} ${COLORS[color as ColorId].text}`}>
                        💥 {COLORS[color as ColorId].label} set {g.house ? '+🏠' : ''}{g.hotel ? '+🏨' : ''}
                      </button>
                    ))}
                  <button onClick={() => { playClick(); setStep('target'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'prop' && target && (sel.action === 'sly' || sel.action === 'forced') && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">{sel.action === 'sly' ? 'Steal which property?' : 'Take which property?'}</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.entries(s.table[target] || {})
                      .filter(([color, g]) => !groupComplete(color, g))
                      .flatMap(([, g]) => g.cards)
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            playClick();
                            if (sel.action === 'sly') { play({ cardId: sel.id, mode: 'action', target, propId: c.id }); return; }
                            setTheirProp(c.id);
                            setStep('myprop');
                          }}
                        >
                          <CardFace c={c} small />
                        </button>
                      ))}
                  </div>
                  <button onClick={() => { playClick(); setStep('target'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'myprop' && target && theirProp !== null && sel.action === 'forced' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Give away which of YOUR properties?</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.entries(myTable)
                      .filter(([color, g]) => !groupComplete(color, g))
                      .flatMap(([, g]) => g.cards)
                      .map((c) => (
                        <button key={c.id} onClick={() => play({ cardId: sel.id, mode: 'action', target, propId: theirProp, myPropId: c.id })}>
                          <CardFace c={c} small />
                        </button>
                      ))}
                  </div>
                  <button onClick={() => { playClick(); setStep('prop'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Wildcard flip modal */}
        {flipCard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4">
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/20 rounded-3xl p-5 max-w-sm w-full">
              <div className="flex justify-center mb-3"><CardFace c={flipCard} /></div>
              <div className="text-center font-fredoka mb-2">Move this wildcard to:</div>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {(flipCard.any ? COLOR_IDS : flipCard.colors || []).map((color) => (
                  <button
                    key={color}
                    onClick={() => { playClick(); send({ t: 'md_flip', cardId: flipCard.id, color }); setFlipCard(null); }}
                    className={`rounded-2xl py-2.5 font-fredoka font-bold ${COLORS[color].bg} ${COLORS[color].text}`}
                  >
                    {COLORS[color].label} ({(myTable[color]?.cards.length || 0)}/{COLORS[color].size})
                  </button>
                ))}
              </div>
              <button onClick={() => { playClick(); setFlipCard(null); }} className="w-full mt-2 rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">Cancel</button>
            </motion.div>
          </motion.div>
        )}

        {/* Just Say No prompt */}
        {myJsnPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-red-900 to-rose-950 border-4 border-red-400 rounded-3xl p-6 max-w-sm w-full text-center">
              <div className="text-5xl mb-2">
                {myJsnPending.targetId === myId ? (myJsnPending.action === 'rent' ? '🧾' : ACTION_INFO[myJsnPending.action as ActionType]?.emoji || '⚡') : '😈'}
              </div>
              <h2 className="font-fredoka font-bold text-xl text-red-300 mb-1">
                {myJsnPending.targetId === myId
                  ? myJsnPending.kind === 'pay'
                    ? `${byId(myJsnPending.actorId).name} demands ${myJsnPending.amount}M from you!`
                    : `${byId(myJsnPending.actorId).name} plays ${ACTION_INFO[myJsnPending.action as ActionType]?.label} on YOU!`
                  : `${byId(myJsnPending.targetId).name} said NO to your action — counter it?!`}
              </h2>
              <p className="font-fredoka text-rose-300 text-sm mb-4">⏱️ {secsLeft(myJsnPending.endsAt)}s · You hold a Just Say No!</p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playCorrect(); send({ t: 'md_jsn', pendingId: myJsnPending.pid, use: true }); }}
                  className="px-6 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-red-500 shadow-xl"
                >
                  🙅 {myJsnPending.targetId === myId ? 'JUST SAY NO!' : 'COUNTER IT!'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); send({ t: 'md_jsn', pendingId: myJsnPending.pid, use: false }); }}
                  className="px-6 py-3 rounded-full font-fredoka font-bold bg-white/15 border border-white/30"
                >
                  😬 {myJsnPending.targetId === myId ? 'Accept it' : 'Let it stand'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Payment picker */}
        {myPayPending && !myJsnPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-amber-400 rounded-3xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto">
              <h2 className="font-fredoka font-bold text-xl text-amber-300 text-center mb-1">
                💸 Pay {byId(myPayPending.actorId).name} {myPayPending.amount}M!
              </h2>
              <p className="font-nunito text-xs text-white/60 text-center mb-3">
                Choose cards from your table (no change given!) · ⏱️ {secsLeft(myPayPending.endsAt)}s · selected:{' '}
                <span className={`font-bold ${payOk ? 'text-emerald-300' : 'text-red-300'}`}>{paySelTotal}M</span>
              </p>
              <div className="font-fredoka text-xs text-emerald-300 mb-1">💰 Your bank:</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {(s?.bank[myId] || []).map((c) => (
                  <button key={c.id} onClick={() => togglePay(c.id)} className={`rounded-xl ${paySel.includes(c.id) ? 'ring-4 ring-amber-400 scale-105' : 'opacity-80'}`}>
                    <CardFace c={c} small />
                  </button>
                ))}
                {(s?.bank[myId] || []).length === 0 && <span className="font-nunito text-xs text-white/40">empty bank!</span>}
              </div>
              <div className="font-fredoka text-xs text-emerald-300 mb-1">🏠 Your properties (go to their table!):</div>
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.values(myTable).flatMap((g) => g.cards.filter((c) => c.value > 0)).map((c) => (
                  <button key={c.id} onClick={() => togglePay(c.id)} className={`rounded-xl ${paySel.includes(c.id) ? 'ring-4 ring-amber-400 scale-105' : 'opacity-80'}`}>
                    <CardFace c={c} small />
                  </button>
                ))}
              </div>
              <button
                disabled={!payOk}
                onClick={() => { playCoin(); send({ t: 'md_pay', pendingId: myPayPending.pid, cardIds: paySel }); }}
                className={`w-full py-3 rounded-full font-fredoka font-bold ${payOk ? 'bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl' : 'bg-gray-600/50 text-gray-400'}`}
              >
                {payOk ? `Hand it over (${paySelTotal}M) 💸` : `Select at least ${myPayPending.amount}M`}
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Discard down to 7 */}
        {mustDiscard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-red-400 rounded-3xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto">
              <h2 className="font-fredoka font-bold text-xl text-red-300 text-center mb-1">
                🗑️ Too many cards! Discard {mustDiscard.need}
              </h2>
              <p className="font-nunito text-xs text-white/60 text-center mb-3">
                Hand limit is {HAND_LIMIT} at the end of your turn · ⏱️ {secsLeft(mustDiscard.endsAt)}s
              </p>
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {myHand.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      playClick();
                      setDiscardSel((cur) =>
                        cur.includes(c.id) ? cur.filter((x) => x !== c.id) : cur.length < mustDiscard.need ? [...cur, c.id] : cur
                      );
                    }}
                    className={`rounded-xl ${discardSel.includes(c.id) ? 'ring-4 ring-red-400 scale-105' : 'opacity-80'}`}
                  >
                    <CardFace c={c} small />
                  </button>
                ))}
              </div>
              <button
                disabled={discardSel.length !== mustDiscard.need}
                onClick={() => { playClick(); send({ t: 'md_discard', cardIds: discardSel }); }}
                className={`w-full py-3 rounded-full font-fredoka font-bold ${discardSel.length === mustDiscard.need ? 'bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl' : 'bg-gray-600/50 text-gray-400'}`}
              >
                Discard {discardSel.length}/{mustDiscard.need} 🗑️
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Winner */}
        {s?.winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <ConfettiBurst count={90} durationMs={4500} />
            <motion.div
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              className="bg-gradient-to-br from-emerald-800 to-teal-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-md w-full"
            >
              <div className="text-7xl mb-3">🏆</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
                {byId(s.winner).emoji} {byId(s.winner).name} WINS!
              </h2>
              <p className="font-nunito text-emerald-200 mb-3">{SETS_TO_WIN} complete property sets — what a mogul!</p>
              <div className="flex justify-center mb-4"><TableGroups table={s.table[s.winner] || {}} owner={s.winner} /></div>
              <p className="font-fredoka text-green-300 mb-6">+{s.winner === myId ? 50 : 15} XP</p>
              {isHost ? (
                <button
                  onClick={() => { playClick(); send({ t: 'to_lobby' }); }}
                  className="px-8 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-pink-500 shadow-xl"
                >
                  Back to Lobby 🏠
                </button>
              ) : (
                <div className="font-nunito text-emerald-300">Waiting for the host…</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MonopolyDeal;
