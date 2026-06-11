import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import type { RoomApi } from '../../online/useRoom';
import { playClick, playCorrect, playWrong, playWin, playCoin, playPop } from '../../utils/sounds';
import ConfettiBurst from './../ConfettiBurst';

const SETS_TO_WIN = 3;
const PLAYS_PER_TURN = 3;
const TURN_MS = 75000;
const JSN_MS = 12000;
// Rent charged per rival, by how many cards of that colour you own (1 / 2 / full set)
const RENT_LADDER = [1, 2, 4];

type ActionType = 'pass_go' | 'rent' | 'birthday' | 'debt' | 'sly_deal' | 'deal_breaker' | 'jsn';

interface Card {
  id: number;
  kind: 'property' | 'money' | 'action';
  value: number;
  color?: string;
  city?: string;
  action?: ActionType;
}

const SET_COLORS: Record<string, { label: string; bg: string; cities: [string, string, string] }> = {
  red: { label: 'Red', bg: 'bg-red-500', cities: ['Seoul', 'Tokyo', 'Beijing'] },
  blue: { label: 'Blue', bg: 'bg-blue-500', cities: ['London', 'Paris', 'Berlin'] },
  green: { label: 'Green', bg: 'bg-emerald-500', cities: ['Cairo', 'Nairobi', 'Cape Town'] },
  yellow: { label: 'Yellow', bg: 'bg-amber-400', cities: ['Sydney', 'Auckland', 'Suva'] },
  purple: { label: 'Purple', bg: 'bg-purple-500', cities: ['New York', 'Toronto', 'Chicago'] },
  orange: { label: 'Orange', bg: 'bg-orange-500', cities: ['Rio', 'Lima', 'Mexico City'] },
  pink: { label: 'Pink', bg: 'bg-pink-500', cities: ['Madrid', 'Lisbon', 'Rome'] },
  cyan: { label: 'Cyan', bg: 'bg-cyan-500', cities: ['Mumbai', 'Dubai', 'Bangkok'] },
};

const ACTION_INFO: Record<ActionType, { label: string; emoji: string; desc: string }> = {
  pass_go: { label: 'Pass GO', emoji: '🎁', desc: 'Draw 2 extra cards' },
  rent: { label: 'Rent', emoji: '🧾', desc: 'Pick a colour you own — rivals pay 1/2/4M by set size' },
  birthday: { label: 'Birthday', emoji: '🎂', desc: 'Every rival pays you 1M' },
  debt: { label: 'Debt Collector', emoji: '💼', desc: 'One rival pays you 3M' },
  sly_deal: { label: 'Sly Deal', emoji: '🦊', desc: 'Steal a property (not from a full set)' },
  deal_breaker: { label: 'Deal Breaker', emoji: '💥', desc: 'Steal a complete set!' },
  jsn: { label: 'Just Say No', emoji: '🙅', desc: 'Blocks an action played against you (kept in hand)' },
};

const MONEY_STYLE: Record<number, string> = {
  1: 'from-stone-100 to-stone-300 text-stone-700',
  2: 'from-rose-100 to-rose-300 text-rose-700',
  3: 'from-sky-100 to-sky-300 text-sky-700',
  4: 'from-violet-100 to-violet-300 text-violet-700',
  5: 'from-amber-100 to-amber-300 text-amber-700',
};

function buildDeck(): Card[] {
  let id = 0;
  const deck: Card[] = [];
  Object.entries(SET_COLORS).forEach(([color, info]) => {
    info.cities.forEach((city) => deck.push({ id: id++, kind: 'property', value: 2, color, city }));
  });
  const money: [number, number][] = [[1, 6], [2, 5], [3, 4], [4, 3], [5, 2]];
  money.forEach(([v, n]) => {
    for (let i = 0; i < n; i++) deck.push({ id: id++, kind: 'money', value: v });
  });
  const actions: [ActionType, number, number][] = [
    ['pass_go', 5, 1], ['rent', 4, 1], ['birthday', 2, 2], ['debt', 3, 2],
    ['sly_deal', 3, 3], ['deal_breaker', 2, 5], ['jsn', 3, 4],
  ];
  actions.forEach(([a, n, v]) => {
    for (let i = 0; i < n; i++) deck.push({ id: id++, kind: 'action', value: v, action: a });
  });
  return deck.sort(() => Math.random() - 0.5);
}

interface Pending {
  action: ActionType;
  actorId: string;
  targetId: string;
  color?: string;
  cardId?: number;
  endsAt: number;
}

interface MDState {
  order: string[];
  turn: string;
  playsLeft: number;
  hands: Record<string, Card[]>;
  bank: Record<string, Card[]>;
  props: Record<string, Record<string, Card[]>>;
  deckCount: number;
  discardTop: Card | null;
  feed: string[];
  pending: Pending | null;
  winner: string | null;
}

const bankTotal = (cards: Card[]) => cards.reduce((s, c) => s + c.value, 0);
const fullSetCount = (props: Record<string, Card[]>) =>
  Object.values(props).filter((cards) => cards.length >= 3).length;

// ---------- Card visuals ----------

const CardBack: React.FC<{ small?: boolean }> = ({ small }) => (
  <div
    className={`${small ? 'w-10 h-14 text-base' : 'w-14 h-20 text-xl'} rounded-lg bg-gradient-to-br from-indigo-600 via-purple-700 to-fuchsia-800 border-2 border-white/70 shadow-lg flex flex-col items-center justify-center text-white font-fredoka`}
  >
    <span>🃏</span>
    {!small && <span className="text-[9px] font-bold tracking-widest">DEAL</span>}
  </div>
);

const CardFace: React.FC<{ c: Card; small?: boolean }> = ({ c, small }) => {
  const base = small ? 'w-16 h-24' : 'w-28 h-40';
  if (c.kind === 'property' && c.color) {
    const sc = SET_COLORS[c.color];
    return (
      <div className={`${base} relative rounded-xl bg-white text-gray-800 shadow-xl overflow-hidden flex flex-col border border-gray-300`}>
        <div className={`${small ? 'h-5' : 'h-8'} ${sc.bg} flex items-center justify-center text-white font-fredoka font-bold ${small ? 'text-[9px]' : 'text-xs'} tracking-wide shrink-0`}>
          {sc.label.toUpperCase()}
        </div>
        <div className={`flex items-center justify-center font-nunito font-bold text-center px-1 ${small ? 'text-[10px] flex-1' : 'text-sm h-10'}`}>
          {c.city}
        </div>
        {!small && (
          <div className="px-1.5 pb-1 space-y-0.5 mt-auto">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`flex justify-between rounded px-1.5 py-px text-[9px] font-nunito ${
                  n === 3 ? 'bg-amber-200 text-amber-800 font-bold' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span>{n === 3 ? '★ FULL SET' : `${n} card${n > 1 ? 's' : ''}`}</span>
                <span>rent {RENT_LADDER[n - 1]}M</span>
              </div>
            ))}
          </div>
        )}
        <span className={`absolute top-0.5 right-1 font-fredoka font-bold text-white drop-shadow ${small ? 'text-[8px]' : 'text-[10px]'}`}>
          {c.value}M
        </span>
      </div>
    );
  }
  if (c.kind === 'money') {
    return (
      <div className={`${base} relative rounded-xl bg-gradient-to-br ${MONEY_STYLE[c.value] || MONEY_STYLE[1]} shadow-xl border-4 border-double border-white/80 flex flex-col items-center justify-center font-fredoka`}>
        <span className={small ? 'text-xl' : 'text-4xl'}>💵</span>
        <span className={`font-bold ${small ? 'text-sm' : 'text-2xl'}`}>{c.value}M</span>
        {!small && <span className="text-[9px] font-nunito font-bold tracking-widest mt-1 opacity-70">MONEY</span>}
        <span className={`absolute top-1 left-1.5 font-bold ${small ? 'text-[8px]' : 'text-[10px]'} opacity-60`}>{c.value}</span>
        <span className={`absolute bottom-1 right-1.5 font-bold ${small ? 'text-[8px]' : 'text-[10px]'} opacity-60 rotate-180`}>{c.value}</span>
      </div>
    );
  }
  const info = ACTION_INFO[c.action!];
  return (
    <div className={`${base} relative rounded-xl bg-gradient-to-br from-indigo-100 to-violet-200 text-indigo-900 shadow-xl border border-indigo-300 flex flex-col items-center justify-center font-fredoka px-1 text-center`}>
      <span className={small ? 'text-xl' : 'text-4xl'}>{info.emoji}</span>
      <span className={`font-bold leading-tight ${small ? 'text-[9px]' : 'text-sm'}`}>{info.label}</span>
      {!small && <span className="text-[9px] font-nunito leading-tight mt-1 text-indigo-700 px-1">{info.desc}</span>}
      <span className={`absolute top-0.5 right-1 font-bold ${small ? 'text-[8px]' : 'text-[10px]'} text-indigo-500`}>{c.value}M</span>
    </div>
  );
};

const MonopolyDeal: React.FC<{ room: RoomApi }> = ({ room }) => {
  const { players, isHost, myId, send, onMessage } = room;
  const { addXP } = useGameStore();

  const [s, setS] = useState<MDState | null>(null);
  const [sel, setSel] = useState<Card | null>(null);
  const [step, setStep] = useState<'main' | 'target' | 'color' | 'prop'>('main');
  const [target, setTarget] = useState<string | null>(null);
  const [jsnLeft, setJsnLeft] = useState(12);
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
    props: {} as Record<string, Record<string, Card[]>>,
    feed: [] as string[],
    pending: null as Pending | null,
    winner: null as string | null,
    timer: 0,
    turnTimer: 0,
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
      h.props[id] = {};
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
          props: h.props,
          deckCount: h.deck.length,
          discardTop: h.discard[h.discard.length - 1] || null,
          feed: h.feed,
          pending: h.pending,
          winner: h.winner,
        })
      );
      send({ t: 'md_state', s: snapshot });
    };

    const winCheckAll = () => {
      if (h.winner) return;
      for (const id of h.order) {
        if (fullSetCount(h.props[id]) >= SETS_TO_WIN) {
          h.winner = id;
          pushFeed(`🏆 ${hostName(id)} collected ${SETS_TO_WIN} full sets!`);
          window.clearTimeout(h.turnTimer);
          return;
        }
      }
    };

    const autoPay = (fromId: string, toId: string, amount: number): string => {
      let remaining = amount;
      const parts: string[] = [];
      const bankSorted = [...h.bank[fromId]].sort((a, b) => b.value - a.value);
      for (const c of bankSorted) {
        if (remaining <= 0) break;
        h.bank[fromId] = h.bank[fromId].filter((x) => x.id !== c.id);
        h.bank[toId].push(c);
        remaining -= c.value;
        parts.push(`${c.value}M`);
      }
      if (remaining > 0) {
        const propCards: { color: string; card: Card }[] = [];
        Object.entries(h.props[fromId]).forEach(([color, cards]) =>
          cards.forEach((card) => propCards.push({ color, card }))
        );
        propCards.sort((a, b) => {
          const af = h.props[fromId][a.color].length >= 3 ? 1 : 0;
          const bf = h.props[fromId][b.color].length >= 3 ? 1 : 0;
          return af - bf;
        });
        for (const { color, card } of propCards) {
          if (remaining <= 0) break;
          h.props[fromId][color] = h.props[fromId][color].filter((x) => x.id !== card.id);
          if (h.props[fromId][color].length === 0) delete h.props[fromId][color];
          if (!h.props[toId][color]) h.props[toId][color] = [];
          h.props[toId][color].push(card);
          remaining -= card.value;
          parts.push(card.city || 'property');
        }
      }
      return parts.length ? parts.join(' + ') : 'nothing — broke! 😅';
    };

    const afterPlay = () => {
      winCheckAll();
      if (!h.winner && !h.pending && h.playsLeft <= 0) {
        h.timer = window.setTimeout(endTurn, 1600);
      }
      broadcast();
    };

    const startTurn = () => {
      if (h.winner) return;
      const pid = h.order[h.turnIdx];
      draw(pid, 2);
      h.playsLeft = PLAYS_PER_TURN;
      h.pending = null;
      pushFeed(`▶️ ${hostName(pid)}'s turn — drew 2 cards`);
      broadcast();
      window.clearTimeout(h.turnTimer);
      h.turnTimer = window.setTimeout(() => {
        if (h.pending) {
          h.turnTimer = window.setTimeout(endTurn, 5000);
        } else {
          pushFeed(`⏰ ${hostName(pid)} ran out of time`);
          endTurn();
        }
      }, TURN_MS);
    };

    const endTurn = () => {
      if (h.winner) return;
      window.clearTimeout(h.timer);
      h.turnIdx = (h.turnIdx + 1) % h.order.length;
      startTurn();
    };

    const applyPending = () => {
      const p = h.pending;
      if (!p) return;
      const actor = p.actorId;
      const tgt = p.targetId;
      if (p.action === 'debt') {
        const paid = autoPay(tgt, actor, 3);
        pushFeed(`💼 ${hostName(tgt)} paid: ${paid}`);
      } else if (p.action === 'sly_deal' && p.cardId !== undefined) {
        for (const [color, cards] of Object.entries(h.props[tgt])) {
          const card = cards.find((c) => c.id === p.cardId);
          if (card) {
            h.props[tgt][color] = cards.filter((c) => c.id !== p.cardId);
            if (h.props[tgt][color].length === 0) delete h.props[tgt][color];
            if (!h.props[actor][color]) h.props[actor][color] = [];
            h.props[actor][color].push(card);
            pushFeed(`🦊 ${hostName(actor)} stole ${card.city}!`);
            break;
          }
        }
      } else if (p.action === 'deal_breaker' && p.color) {
        const cards = h.props[tgt][p.color];
        if (cards && cards.length >= 3) {
          delete h.props[tgt][p.color];
          if (!h.props[actor][p.color]) h.props[actor][p.color] = [];
          h.props[actor][p.color].push(...cards);
          pushFeed(`💥 ${hostName(actor)} stole the whole ${SET_COLORS[p.color].label} set!`);
        }
      }
      h.pending = null;
    };

    const resolveJsn = (use: boolean) => {
      const p = h.pending;
      if (!p) return;
      window.clearTimeout(h.timer);
      if (use) {
        const jsnCard = h.hands[p.targetId].find((c) => c.action === 'jsn');
        if (jsnCard) {
          h.hands[p.targetId] = h.hands[p.targetId].filter((c) => c.id !== jsnCard.id);
          h.discard.push(jsnCard);
          pushFeed(`🙅 ${hostName(p.targetId)} said JUST SAY NO!`);
          h.pending = null;
        } else {
          applyPending();
        }
      } else {
        applyPending();
      }
      afterPlay();
    };

    const offMsg = onMessage((raw) => {
      const m = raw as any;
      if (h.winner) return;
      const currentPid = h.order[h.turnIdx];

      if (m.t === 'md_jsn' && h.pending && m.from === h.pending.targetId) {
        resolveJsn(!!m.use);
        return;
      }

      if (m.from !== currentPid || h.pending) return;

      if (m.t === 'md_end') {
        pushFeed(`⏭️ ${hostName(currentPid)} ended their turn`);
        endTurn();
        return;
      }

      if (m.t !== 'md_play' || h.playsLeft <= 0) return;
      const hand = h.hands[currentPid];
      const card = hand.find((c) => c.id === m.cardId);
      if (!card) return;

      const removeFromHand = () => {
        h.hands[currentPid] = hand.filter((c) => c.id !== card.id);
      };

      if (m.mode === 'money' && card.kind !== 'property') {
        removeFromHand();
        h.bank[currentPid].push(card);
        h.playsLeft -= 1;
        pushFeed(`💰 ${hostName(currentPid)} banked ${card.value}M`);
        afterPlay();
        return;
      }

      if (m.mode === 'property' && card.kind === 'property' && card.color) {
        removeFromHand();
        if (!h.props[currentPid][card.color]) h.props[currentPid][card.color] = [];
        h.props[currentPid][card.color].push(card);
        h.playsLeft -= 1;
        pushFeed(`🏠 ${hostName(currentPid)} played ${card.city}`);
        afterPlay();
        return;
      }

      if (m.mode === 'action' && card.kind === 'action' && card.action && card.action !== 'jsn') {
        const opponents = h.order.filter((id) => id !== currentPid);

        if (card.action === 'pass_go') {
          removeFromHand();
          h.discard.push(card);
          draw(currentPid, 2);
          h.playsLeft -= 1;
          pushFeed(`🎁 ${hostName(currentPid)} passed GO — drew 2`);
          afterPlay();
          return;
        }
        if (card.action === 'rent') {
          const color = String(m.color || '');
          const owned = h.props[currentPid][color];
          if (!owned || owned.length === 0) return;
          removeFromHand();
          h.discard.push(card);
          h.playsLeft -= 1;
          const amount = RENT_LADDER[Math.min(3, owned.length) - 1];
          pushFeed(`🧾 ${hostName(currentPid)} charges ${amount}M ${SET_COLORS[color].label} rent!`);
          opponents.forEach((opp) => {
            const paid = autoPay(opp, currentPid, amount);
            pushFeed(`🧾 ${hostName(opp)} paid: ${paid}`);
          });
          afterPlay();
          return;
        }
        if (card.action === 'birthday') {
          removeFromHand();
          h.discard.push(card);
          h.playsLeft -= 1;
          opponents.forEach((opp) => {
            const paid = autoPay(opp, currentPid, 1);
            pushFeed(`🎂 ${hostName(opp)} paid: ${paid}`);
          });
          afterPlay();
          return;
        }

        // Single-target actions (can be blocked by Just Say No)
        const tgt = String(m.target || '');
        if (!opponents.includes(tgt)) return;

        if (card.action === 'debt' || card.action === 'sly_deal' || card.action === 'deal_breaker') {
          if (card.action === 'sly_deal') {
            const pCardId = Number(m.propId);
            const okSteal = Object.entries(h.props[tgt]).some(
              ([, cards]) => cards.length < 3 && cards.some((c) => c.id === pCardId)
            );
            if (!okSteal) return;
          }
          if (card.action === 'deal_breaker') {
            const color = String(m.color || '');
            if (!h.props[tgt][color] || h.props[tgt][color].length < 3) return;
          }
          removeFromHand();
          h.discard.push(card);
          h.playsLeft -= 1;
          const pend: Pending = {
            action: card.action,
            actorId: currentPid,
            targetId: tgt,
            color: m.color ? String(m.color) : undefined,
            cardId: card.action === 'sly_deal' ? Number(m.propId) : undefined,
            endsAt: Date.now() + JSN_MS,
          };
          const targetHasJsn = h.hands[tgt].some((c) => c.action === 'jsn');
          if (targetHasJsn) {
            h.pending = pend;
            pushFeed(`⚡ ${hostName(currentPid)} played ${ACTION_INFO[card.action].label} on ${hostName(tgt)}!`);
            broadcast();
            h.timer = window.setTimeout(() => resolveJsn(false), JSN_MS + 400);
          } else {
            h.pending = pend;
            applyPending();
            afterPlay();
          }
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
          // First state = the deal — play the dealing animation
          setDealing(true);
          [200, 500, 800, 1100, 1400].forEach((d) => window.setTimeout(() => playPop(), d));
          window.setTimeout(() => setDealing(false), 2400);
        }
        if (st.pending && st.pending.targetId === myId && (!prev || !prev.pending)) playWrong();
        if (st.winner && (!prev || !prev.winner)) {
          if (!xpGiven.current) {
            xpGiven.current = true;
            addXP(st.winner === myId ? 50 : 15);
          }
          if (st.winner === myId) playWin();
        }
        return st;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // JSN countdown
  useEffect(() => {
    if (!s?.pending) return;
    const ends = s.pending.endsAt;
    const iv = window.setInterval(() => {
      setJsnLeft(Math.max(0, Math.ceil((ends - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(iv);
  }, [s?.pending]);

  const myHand = s?.hands[myId] || [];
  const isMyTurn = s?.turn === myId;
  const inGame = s ? s.order.includes(myId) : true;
  const opponents = s ? s.order.filter((id) => id !== myId) : [];

  const closeModal = () => {
    setSel(null);
    setStep('main');
    setTarget(null);
  };

  const play = (payload: Record<string, unknown>) => {
    playClick();
    send({ t: 'md_play', ...payload });
    closeModal();
  };

  const myColors = s ? Object.keys(s.props[myId] || {}) : [];

  const PropStacks: React.FC<{ pr: Record<string, Card[]>; mine?: boolean }> = ({ pr, mine }) => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(pr).map(([color, cards]) => (
        <div
          key={color}
          className={`rounded-xl p-1.5 ${cards.length >= 3 ? 'bg-amber-400/25 ring-2 ring-amber-300 shadow-lg' : 'bg-black/20'}`}
        >
          <div className="flex">
            {cards.map((c, i) => (
              <div key={c.id} className={i > 0 ? '-ml-10' : ''}>
                <CardFace c={c} small />
              </div>
            ))}
          </div>
          <div className={`text-center text-[9px] font-fredoka mt-1 ${cards.length >= 3 ? 'text-amber-300 font-bold' : 'text-white/70'}`}>
            {cards.length >= 3 ? '⭐ FULL SET!' : `${cards.length}/3 · rent ${RENT_LADDER[Math.min(3, cards.length) - 1]}M`}
          </div>
        </div>
      ))}
      {Object.keys(pr).length === 0 && (
        <span className="text-[10px] font-nunito text-white/40 py-2">{mine ? 'Play property cards here to build sets!' : 'no properties yet'}</span>
      )}
    </div>
  );

  return (
    <div
      className="min-h-screen text-white px-3 py-6"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #166534 0%, #14532d 45%, #052e16 100%)' }}
    >
      <div className="max-w-3xl mx-auto pt-6 pb-52">
        <h1 className="text-center font-fredoka font-bold text-2xl md:text-4xl mb-1 drop-shadow-lg">🃏 Monopoly Deal</h1>
        <p className="text-center font-nunito text-emerald-200 text-sm mb-4">
          Collect {SETS_TO_WIN} full colour sets to win — but watch out for sly deals!
        </p>

        {!s && (
          <div className="text-center font-fredoka text-xl bg-black/30 rounded-3xl p-8 border border-white/10">
            🃏 Shuffling the deck…
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
                    <span className="font-fredoka text-xs text-amber-300">⭐{fullSetCount(s.props[id] || {})}/{SETS_TO_WIN}</span>
                  </div>
                  <div className="flex items-center gap-2 font-nunito text-xs text-emerald-200 mb-1.5">
                    <span className="bg-emerald-900/60 rounded-full px-2 py-0.5">💰 {bankTotal(s.bank[id] || [])}M</span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: Math.min(7, (s.hands[id] || []).length) }).map((_, i) => (
                        <span key={i} className="inline-block w-2.5 h-4 rounded-sm bg-gradient-to-b from-indigo-500 to-purple-700 border border-white/50 -ml-1 first:ml-0" />
                      ))}
                      <span className="ml-1">{(s.hands[id] || []).length}</span>
                    </span>
                  </div>
                  <PropStacks pr={s.props[id] || {}} />
                </div>
              ))}
            </div>

            {/* Table centre: deck, feed, discard */}
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
                {/* Draw pile */}
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
                {/* Feed */}
                <div className="flex-1 min-w-0">
                  {s.feed.map((line, i) => (
                    <div key={`${i}-${line}`} className={`font-nunito text-xs truncate ${i === 0 ? 'text-white font-bold' : 'text-white/45'}`}>
                      {line}
                    </div>
                  ))}
                </div>
                {/* Discard pile */}
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
                    <span className="text-amber-300">⭐ {fullSetCount(s.props[myId] || {})}/{SETS_TO_WIN} sets</span>
                  </span>
                  {isMyTurn && !s.winner && (
                    <button
                      onClick={() => { playClick(); send({ t: 'md_end' }); }}
                      className="rounded-full px-4 py-1 font-fredoka text-xs bg-white/15 border border-white/30 hover:bg-white/25"
                    >
                      End turn ⏭️
                    </button>
                  )}
                </div>
                <PropStacks pr={s.props[myId] || {}} mine />
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
              ✋ Your hand ({myHand.length}){isMyTurn && s.playsLeft > 0 && !s.pending ? ' — tap a card to play it!' : ''}
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
                      if (!isMyTurn || s.playsLeft <= 0 || s.pending) return;
                      playClick();
                      setSel(c);
                      setStep('main');
                    }}
                    className={`shrink-0 ${isMyTurn && s.playsLeft > 0 && !s.pending ? 'cursor-pointer' : 'opacity-60'}`}
                  >
                    <CardFace c={c} />
                  </motion.button>
                ))}
              </AnimatePresence>
              {myHand.length === 0 && <span className="font-nunito text-white/40 text-sm py-6">No cards — draw next turn!</span>}
            </div>
          </div>
        </div>
      )}

      {/* Dealing animation */}
      <AnimatePresence>
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
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/20 rounded-3xl p-5 max-w-sm w-full max-h-[85vh] overflow-y-auto">
              <div className="flex justify-center mb-3"><CardFace c={sel} /></div>

              {step === 'main' && (
                <div className="grid gap-2">
                  {sel.kind === 'property' && (
                    <button onClick={() => play({ cardId: sel.id, mode: 'property' })} className="rounded-2xl py-3 font-fredoka font-bold bg-gradient-to-r from-emerald-400 to-green-500">
                      🏠 Add to my properties
                    </button>
                  )}
                  {sel.kind === 'action' && sel.action !== 'jsn' && (
                    <button
                      onClick={() => {
                        if (sel.action === 'pass_go') { play({ cardId: sel.id, mode: 'action' }); return; }
                        if (sel.action === 'birthday') { play({ cardId: sel.id, mode: 'action' }); return; }
                        if (sel.action === 'rent') { playClick(); setStep('color'); return; }
                        playClick(); setStep('target');
                      }}
                      className="rounded-2xl py-3 font-fredoka font-bold bg-gradient-to-r from-violet-400 to-purple-500"
                    >
                      {ACTION_INFO[sel.action!].emoji} {ACTION_INFO[sel.action!].desc}
                    </button>
                  )}
                  {sel.kind !== 'property' && (
                    <button onClick={() => play({ cardId: sel.id, mode: 'money' })} className="rounded-2xl py-3 font-fredoka font-bold bg-gradient-to-r from-amber-400 to-orange-500">
                      💰 Bank it ({sel.value}M)
                    </button>
                  )}
                  {sel.action === 'jsn' && (
                    <div className="text-center font-nunito text-xs text-white/60">
                      🙅 Keep it in your hand to block attacks — or bank it for {sel.value}M
                    </div>
                  )}
                  <button onClick={() => { playClick(); closeModal(); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">
                    Cancel
                  </button>
                </div>
              )}

              {step === 'color' && sel.action === 'rent' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Charge rent for which colour?</div>
                  {myColors.length === 0 && (
                    <div className="text-center font-nunito text-sm text-red-300">You don't own any properties yet!</div>
                  )}
                  {myColors.map((color) => {
                    const cnt = (s.props[myId][color] || []).length;
                    const amt = RENT_LADDER[Math.min(3, cnt) - 1];
                    return (
                      <button key={color} onClick={() => play({ cardId: sel.id, mode: 'action', color })} className={`rounded-2xl py-3 font-fredoka font-bold text-white ${SET_COLORS[color].bg}`}>
                        {SET_COLORS[color].label} ({cnt} card{cnt === 1 ? '' : 's'}) — rivals pay {amt}M
                      </button>
                    );
                  })}
                  <button onClick={() => { playClick(); setStep('main'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'target' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Pick your target:</div>
                  {opponents.map((id) => {
                    const tgtProps = s.props[id] || {};
                    const slyOk = Object.values(tgtProps).some((cards) => cards.length > 0 && cards.length < 3);
                    const breakOk = Object.values(tgtProps).some((cards) => cards.length >= 3);
                    const disabled =
                      (sel.action === 'sly_deal' && !slyOk) || (sel.action === 'deal_breaker' && !breakOk);
                    return (
                      <button
                        key={id}
                        disabled={disabled}
                        onClick={() => {
                          playClick();
                          setTarget(id);
                          if (sel.action === 'debt') { play({ cardId: sel.id, mode: 'action', target: id }); return; }
                          setStep(sel.action === 'sly_deal' ? 'prop' : 'color');
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

              {step === 'prop' && target && sel.action === 'sly_deal' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Steal which property?</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Object.entries(s.props[target] || {})
                      .filter(([, cards]) => cards.length < 3)
                      .flatMap(([, cards]) => cards)
                      .map((c) => (
                        <button key={c.id} onClick={() => play({ cardId: sel.id, mode: 'action', target, propId: c.id })}>
                          <CardFace c={c} small />
                        </button>
                      ))}
                  </div>
                  <button onClick={() => { playClick(); setStep('target'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}

              {step === 'color' && target && sel.action === 'deal_breaker' && (
                <div className="grid gap-2">
                  <div className="text-center font-fredoka mb-1">Steal which complete set?</div>
                  {Object.entries(s.props[target] || {})
                    .filter(([, cards]) => cards.length >= 3)
                    .map(([color]) => (
                      <button key={color} onClick={() => play({ cardId: sel.id, mode: 'action', target, color })} className={`rounded-2xl py-3 font-fredoka font-bold text-white ${SET_COLORS[color].bg}`}>
                        💥 The {SET_COLORS[color].label} set!
                      </button>
                    ))}
                  <button onClick={() => { playClick(); setStep('target'); }} className="rounded-2xl py-2 font-fredoka bg-white/10 border border-white/20">← Back</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Just Say No prompt */}
        {s?.pending && s.pending.targetId === myId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
            <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="bg-gradient-to-br from-red-900 to-rose-950 border-4 border-red-400 rounded-3xl p-6 max-w-sm w-full text-center">
              <div className="text-5xl mb-2">{ACTION_INFO[s.pending.action].emoji}</div>
              <h2 className="font-fredoka font-bold text-2xl text-red-300 mb-1">
                {byId(s.pending.actorId).name} played {ACTION_INFO[s.pending.action].label} on YOU!
              </h2>
              <p className="font-nunito text-rose-200 mb-1">{ACTION_INFO[s.pending.action].desc}</p>
              <p className="font-fredoka text-rose-300 text-sm mb-4">⏱️ {jsnLeft}s to decide</p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playCorrect(); send({ t: 'md_jsn', use: true }); }}
                  className="px-6 py-3 rounded-full font-fredoka font-bold bg-gradient-to-r from-amber-400 to-red-500 shadow-xl"
                >
                  🙅 JUST SAY NO!
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { playClick(); send({ t: 'md_jsn', use: false }); }}
                  className="px-6 py-3 rounded-full font-fredoka font-bold bg-white/15 border border-white/30"
                >
                  😬 Accept it
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Attack banner for everyone else */}
        {s?.pending && s.pending.targetId !== myId && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 rounded-full px-5 py-2 font-fredoka text-sm shadow-xl">
            ⚡ {byId(s.pending.actorId).name} attacks {byId(s.pending.targetId).name} — will they say no?!
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
              className="bg-gradient-to-br from-emerald-800 to-teal-900 border-4 border-amber-400 rounded-3xl p-8 text-center max-w-sm w-full"
            >
              <div className="text-7xl mb-3">🏆</div>
              <h2 className="font-fredoka font-bold text-3xl text-amber-300 mb-2">
                {byId(s.winner).emoji} {byId(s.winner).name} WINS!
              </h2>
              <p className="font-nunito text-emerald-200 mb-3">{SETS_TO_WIN} complete property sets — what a mogul!</p>
              <div className="flex justify-center mb-4"><PropStacks pr={s.props[s.winner] || {}} /></div>
              <p className="font-fredoka text-green-300 mb-6">+{s.winner === myId ? 50 : 15} XP</p>
              {isHost ? (
                <button
                  onClick={() => { playClick(); playCoin(); send({ t: 'to_lobby' }); }}
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
