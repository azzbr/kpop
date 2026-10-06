// Property Dash — a 2–4 player property card game (pure rules, no React).
// Collect 3 complete colour sets to win (only on your own turn). 106 cards: 28 properties,
// 11 wildcards, 34 actions, 13 rent cards and 20 money cards. The host runs one
// PropertyDashGame and broadcasts snapshot() after every change.
import { rankByScore } from './boardSync';

export const SETS_TO_WIN = 3;
export const PLAYS_PER_TURN = 3;
export const HAND_LIMIT = 7;
export const TURN_MS = 90000;
export const JSN_MS = 12000;
export const PAY_MS = 25000;
export const DISCARD_MS = 20000;
const TURN_GRACE_MS = 8000;

export type ColorId = 'galaxy' | 'sky' | 'flamingo' | 'sunset' | 'ruby' | 'sunshine' | 'jungle' | 'ocean' | 'station' | 'power';
export type ActionType = 'lucky' | 'noway' | 'swipe' | 'swap' | 'snatch' | 'payup' | 'birthday' | 'double_rent' | 'house' | 'hotel';

export const COLOR_IDS: ColorId[] = ['galaxy', 'sky', 'flamingo', 'sunset', 'ruby', 'sunshine', 'jungle', 'ocean', 'station', 'power'];

/** No house or hotel on these two sets. */
export const NO_BUILD: ColorId[] = ['station', 'power'];

export const COLORS: Record<ColorId, { label: string; emoji: string; size: number; rent: number[]; value: number; bg: string; text: string; streets: string[] }> = {
  galaxy: { label: 'Galaxy', emoji: '🌌', size: 2, rent: [1, 2], value: 1, bg: 'bg-purple-700', text: 'text-white', streets: ['Comet Close', 'Meteor Mews'] },
  sky: { label: 'Sky', emoji: '☁️', size: 3, rent: [1, 2, 3], value: 1, bg: 'bg-sky-400', text: 'text-sky-950', streets: ['Rainbow Road', 'Cloud Crescent', 'Kite Corner'] },
  flamingo: { label: 'Flamingo', emoji: '🦩', size: 3, rent: [1, 2, 4], value: 2, bg: 'bg-pink-500', text: 'text-white', streets: ['Flamingo Way', 'Butterfly Bend', 'Petal Park'] },
  sunset: { label: 'Sunset', emoji: '🌅', size: 3, rent: [1, 3, 5], value: 2, bg: 'bg-orange-500', text: 'text-white', streets: ['Lantern Lane', 'Firefly Field', 'Glow Grove'] },
  ruby: { label: 'Ruby', emoji: '💎', size: 3, rent: [2, 3, 6], value: 3, bg: 'bg-red-600', text: 'text-white', streets: ['Dragon Drive', 'Phoenix Place', 'Volcano View'] },
  sunshine: { label: 'Sunshine', emoji: '🌻', size: 3, rent: [2, 4, 6], value: 3, bg: 'bg-yellow-400', text: 'text-yellow-950', streets: ['Sunflower Street', 'Honeybee Hill', 'Starlight Square'] },
  jungle: { label: 'Jungle', emoji: '🌴', size: 3, rent: [2, 4, 7], value: 4, bg: 'bg-green-600', text: 'text-white', streets: ['Jungle Junction', 'Parrot Path', 'Treetop Terrace'] },
  ocean: { label: 'Ocean', emoji: '🐬', size: 2, rent: [3, 8], value: 4, bg: 'bg-blue-800', text: 'text-white', streets: ['Mermaid Marina', 'Pirate Pier'] },
  station: { label: 'Station', emoji: '🚂', size: 4, rent: [1, 2, 3, 4], value: 2, bg: 'bg-gray-800', text: 'text-white', streets: ['North Star Station', 'Moonbeam Station', 'Thunder Station', 'Whistle Stop'] },
  power: { label: 'Power', emoji: '⚡', size: 2, rent: [1, 2], value: 2, bg: 'bg-lime-500', text: 'text-lime-950', streets: ['Solar Farm', 'Wind Farm'] },
};

export const ACTION_INFO: Record<ActionType, { label: string; emoji: string; desc: string }> = {
  lucky: { label: 'Lucky Draw', emoji: '🎁', desc: 'Draw 2 extra cards' },
  noway: { label: 'No Way!', emoji: '🙅', desc: 'Blocks an action played against you. Keep it in your hand (worth 0).' },
  swipe: { label: 'Sneaky Swipe', emoji: '🦊', desc: 'Take one property from a rival — not from a complete set' },
  swap: { label: 'Swap Shop', emoji: '🔁', desc: "Swap one of your properties with a rival's — no complete sets" },
  snatch: { label: 'Set Snatcher', emoji: '💥', desc: 'Take a rival’s COMPLETE set (house & hotel too!)' },
  payup: { label: 'Pay Up!', emoji: '💼', desc: 'One rival pays you 5M' },
  birthday: { label: "It's My Birthday", emoji: '🎂', desc: 'Every rival pays you 2M' },
  double_rent: { label: 'Double Rent', emoji: '✖️', desc: 'Play with a Rent card to double it (uses a play)' },
  house: { label: 'House', emoji: '🏠', desc: '+3M rent on a complete set (not Station/Power)' },
  hotel: { label: 'Hotel', emoji: '🏨', desc: '+4M rent on a set that has a House' },
};

export interface Card {
  id: number;
  kind: 'property' | 'wild' | 'money' | 'action' | 'rent';
  value: number;
  color?: ColorId;
  name?: string;
  colors?: ColorId[]; // two-colour wild / two-colour rent
  any?: boolean; // rainbow wild / rainbow rent
  action?: ActionType;
}

export interface Group {
  cards: Card[];
  house: Card | null;
  hotel: Card | null;
}
export type Table = Record<string, Group>; // keyed by ColorId

export interface Pending {
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
  jsnDecider: string | null; // who may currently play No Way!
  phase: 'jsn' | 'pay';
  endsAt: number;
}

export interface PDState {
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
  ranked: (string | string[])[] | null;
  dealt: boolean;
}

/** A move a player sends to the host. */
export type PDMove =
  | { t: 'pd_jsn'; pendingId: number; use: boolean }
  | { t: 'pd_pay'; pendingId: number; cardIds: number[] }
  | { t: 'pd_discard'; cardIds: number[] }
  | { t: 'pd_flip'; cardId: number; color: string }
  | { t: 'pd_end' }
  | {
      t: 'pd_play';
      cardId: number;
      mode: 'money' | 'property' | 'rent' | 'action';
      color?: string;
      doubleId?: number | null;
      target?: string;
      propId?: number;
      myPropId?: number;
    };

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDeck(rand: () => number = Math.random): Card[] {
  let id = 0;
  const deck: Card[] = [];
  // 28 properties
  COLOR_IDS.forEach((color) => {
    COLORS[color].streets.forEach((name) => {
      deck.push({ id: id++, kind: 'property', value: COLORS[color].value, color, name });
    });
  });
  // 11 wildcards: 9 two-colour + 2 rainbow
  const duals: [ColorId, ColorId, number, number][] = [
    ['sky', 'galaxy', 1, 1], ['sky', 'station', 4, 1], ['flamingo', 'sunset', 2, 2],
    ['ruby', 'sunshine', 3, 2], ['ocean', 'jungle', 4, 1], ['jungle', 'station', 4, 1], ['station', 'power', 2, 1],
  ];
  duals.forEach(([a, b, v, n]) => {
    for (let i = 0; i < n; i++) deck.push({ id: id++, kind: 'wild', value: v, colors: [a, b] });
  });
  for (let i = 0; i < 2; i++) deck.push({ id: id++, kind: 'wild', value: 0, any: true });
  // 34 actions
  const actions: [ActionType, number, number][] = [
    ['lucky', 10, 1], ['noway', 3, 0], ['swipe', 3, 3], ['swap', 3, 3], ['snatch', 2, 5],
    ['payup', 3, 3], ['birthday', 3, 2], ['double_rent', 2, 1], ['house', 3, 3], ['hotel', 2, 4],
  ];
  actions.forEach(([a, n, v]) => {
    for (let i = 0; i < n; i++) deck.push({ id: id++, kind: 'action', value: v, action: a });
  });
  // 13 rent: 10 two-colour + 3 rainbow
  const rentPairs: [ColorId, ColorId][] = [
    ['sky', 'galaxy'], ['flamingo', 'sunset'], ['ruby', 'sunshine'], ['ocean', 'jungle'], ['station', 'power'],
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
  return shuffle(deck, rand);
}

export const bankTotal = (cards: Card[]) => cards.reduce((s, c) => s + c.value, 0);
export const groupComplete = (color: string, g: Group) => g.cards.length >= COLORS[color as ColorId].size;
/** A complete set that counts towards winning needs at least one real property (not only wilds). */
export const groupLegit = (color: string, g: Group) => groupComplete(color, g) && g.cards.some((c) => c.kind === 'property');
export const fullSetCount = (table: Table) => Object.entries(table).filter(([color, g]) => groupLegit(color, g)).length;
export const rentFor = (table: Table, color: string): number => {
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
/** Cards you may pay with: bank cards + table cards worth more than 0 (houses/hotels stay put). */
export const payableCards = (bank: Card[], table: Table): Card[] => [
  ...bank,
  ...Object.values(table).flatMap((g) => g.cards.filter((c) => c.value > 0)),
];
export const canPlayAsColor = (card: Card, color: string) =>
  card.kind === 'wild' && (card.any ? COLOR_IDS.includes(color as ColorId) : (card.colors || []).includes(color as ColorId));

/** Winner first, then everyone else by complete sets, then money in the bank (ties share a place). */
export function finalRanking(order: string[], winner: string, table: Record<string, Table>, bank: Record<string, Card[]>): (string | string[])[] {
  const rest = order.filter((id) => id !== winner);
  return [winner, ...rankByScore(rest, (id) => fullSetCount(table[id] || {}) * 1000 + bankTotal(bank[id] || []))];
}

/** The host's referee. Every entry point takes `now` (ms) so tests can run without timers. */
export class PropertyDashGame {
  deck: Card[];
  discard: Card[] = [];
  order: string[];
  turnIdx = 0;
  playsLeft = 0;
  hands: Record<string, Card[]> = {};
  bank: Record<string, Card[]> = {};
  table: Record<string, Table> = {};
  feed: string[] = [];
  pendings: Pending[] = [];
  discarding: { pid: string; need: number; endsAt: number } | null = null;
  winner: string | null = null;
  ranked: (string | string[])[] | null = null;
  dealt = false;
  turnEndsAt = 0;
  private pidSeq = 1;
  private now = 0;

  private name: (id: string) => string;
  private rand: () => number;

  constructor(order: string[], name: (id: string) => string = (id) => id, rand: () => number = Math.random, deck?: Card[]) {
    this.name = name;
    this.rand = rand;
    this.order = order;
    this.deck = deck ?? buildDeck(rand);
    order.forEach((id) => {
      this.hands[id] = [];
      this.bank[id] = [];
      this.table[id] = {};
    });
  }

  get current() {
    return this.order[this.turnIdx];
  }

  snapshot(): PDState {
    return JSON.parse(
      JSON.stringify({
        order: this.order,
        turn: this.current,
        playsLeft: this.playsLeft,
        hands: this.hands,
        bank: this.bank,
        table: this.table,
        deckCount: this.deck.length,
        discardTop: this.discard[this.discard.length - 1] || null,
        feed: this.feed,
        pendings: this.pendings,
        discarding: this.discarding,
        winner: this.winner,
        ranked: this.ranked,
        dealt: this.dealt,
      }),
    );
  }

  /** Deal 5 cards each and start the first turn. */
  deal(now: number) {
    if (this.dealt) return;
    this.now = now;
    this.dealt = true;
    this.order.forEach((id) => this.draw(id, 5));
    this.pushFeed(`🃏 Cards dealt — collect ${SETS_TO_WIN} full sets to win!`);
    this.startTurn();
  }

  private pushFeed(line: string) {
    this.feed = [line, ...this.feed].slice(0, 4);
  }

  private draw(pid: string, n: number) {
    for (let i = 0; i < n; i++) {
      if (this.deck.length === 0) {
        this.deck = shuffle(this.discard, this.rand);
        this.discard = [];
      }
      const c = this.deck.pop();
      if (c) this.hands[pid].push(c);
    }
  }

  // Rule: you can only win on your own turn
  private winCheck() {
    if (this.winner) return;
    const pid = this.current;
    if (fullSetCount(this.table[pid]) >= SETS_TO_WIN) {
      this.winner = pid;
      this.ranked = finalRanking(this.order, pid, this.table, this.bank);
      this.pushFeed(`🏆 ${this.name(pid)} collected ${SETS_TO_WIN} full sets!`);
      this.pendings = [];
      this.discarding = null;
    }
  }

  private groupOf(pid: string, color: string): Group {
    if (!this.table[pid][color]) this.table[pid][color] = { cards: [], house: null, hotel: null };
    return this.table[pid][color];
  }

  private removeTableCard(pid: string, cardId: number): { card: Card; color: string } | null {
    for (const [color, g] of Object.entries(this.table[pid])) {
      const card = g.cards.find((c) => c.id === cardId);
      if (card) {
        g.cards = g.cards.filter((c) => c.id !== cardId);
        if (g.cards.length === 0 && !g.house && !g.hotel) delete this.table[pid][color];
        return { card, color };
      }
    }
    return null;
  }

  private giveTableCard(pid: string, card: Card, color: string) {
    this.groupOf(pid, color).cards.push(card);
  }

  private moveTo(pid: string, got: { card: Card; color: string }) {
    this.giveTableCard(pid, got.card, got.card.kind === 'property' ? got.card.color! : got.color);
  }

  private transferPayment(from: string, to: string, cardIds: number[]): string {
    const parts: string[] = [];
    cardIds.forEach((cid) => {
      const inBank = this.bank[from].find((c) => c.id === cid);
      if (inBank) {
        this.bank[from] = this.bank[from].filter((c) => c.id !== cid);
        this.bank[to].push(inBank);
        parts.push(`${inBank.value}M`);
        return;
      }
      const fromTable = this.removeTableCard(from, cid);
      if (fromTable && fromTable.card.value > 0) {
        // Paid properties go straight to the receiver's property area
        this.moveTo(to, fromTable);
        parts.push(fromTable.card.name || `${COLORS[fromTable.color as ColorId].label} wild`);
      }
    });
    return parts.length ? parts.join(' + ') : 'nothing';
  }

  /** What the host pays automatically when time runs out: biggest bank notes first, then loose properties. */
  autoPaySelect(from: string, amount: number): number[] {
    let remaining = amount;
    const ids: number[] = [];
    for (const c of [...this.bank[from]].sort((a, b) => b.value - a.value)) {
      if (remaining <= 0) break;
      ids.push(c.id);
      remaining -= c.value;
    }
    if (remaining > 0) {
      const propCards: { card: Card; full: boolean }[] = [];
      Object.entries(this.table[from]).forEach(([color, g]) =>
        g.cards.forEach((card) => {
          if (card.value > 0) propCards.push({ card, full: groupComplete(color, g) });
        }),
      );
      propCards.sort((a, b) => (a.full ? 1 : 0) - (b.full ? 1 : 0));
      for (const { card } of propCards) {
        if (remaining <= 0) break;
        ids.push(card.id);
        remaining -= card.value;
      }
    }
    return ids;
  }

  private resolvePayPending(p: Pending, cardIds: number[]) {
    const paid = this.transferPayment(p.targetId, p.actorId, cardIds);
    this.pushFeed(`${p.reason || '💸'} ${this.name(p.targetId)} paid: ${paid}`);
    this.pendings = this.pendings.filter((x) => x.pid !== p.pid);
  }

  private applySteal(p: Pending) {
    if (p.action === 'swipe' && p.cardId !== undefined) {
      const got = this.removeTableCard(p.targetId, p.cardId);
      if (got) {
        this.moveTo(p.actorId, got);
        this.pushFeed(`🦊 ${this.name(p.actorId)} swiped ${got.card.name || 'a wildcard'}!`);
      }
    } else if (p.action === 'swap' && p.cardId !== undefined && p.myCardId !== undefined) {
      const theirs = this.removeTableCard(p.targetId, p.cardId);
      const mine = this.removeTableCard(p.actorId, p.myCardId);
      if (theirs) this.moveTo(p.actorId, theirs);
      if (mine) this.moveTo(p.targetId, mine);
      this.pushFeed(`🔁 ${this.name(p.actorId)} swapped ${mine?.card.name || 'a card'} for ${theirs?.card.name || 'a card'}!`);
    } else if (p.action === 'snatch' && p.color) {
      const g = this.table[p.targetId][p.color];
      if (g && groupComplete(p.color, g)) {
        delete this.table[p.targetId][p.color];
        const mine = this.groupOf(p.actorId, p.color);
        mine.cards.push(...g.cards);
        // House & hotel travel with the set
        if (g.house && !mine.house) mine.house = g.house;
        else if (g.house) this.discard.push(g.house);
        if (g.hotel && !mine.hotel) mine.hotel = g.hotel;
        else if (g.hotel) this.discard.push(g.hotel);
        this.pushFeed(`💥 ${this.name(p.actorId)} snatched the ${COLORS[p.color as ColorId].label} set!`);
      }
    }
    this.pendings = this.pendings.filter((x) => x.pid !== p.pid);
  }

  private proceedPending(p: Pending) {
    // No (more) No Way! — carry out the action
    if (p.kind === 'steal') {
      this.applySteal(p);
    } else {
      p.phase = 'pay';
      p.jsnDecider = null;
      p.endsAt = this.now + PAY_MS;
    }
  }

  private startTurn() {
    if (this.winner) return;
    const pid = this.current;
    // Sets completed by payments count at the start of your turn
    this.winCheck();
    if (this.winner) return;
    // Empty hand: draw 5 instead of 2
    const n = this.hands[pid].length === 0 ? 5 : 2;
    this.draw(pid, n);
    this.playsLeft = PLAYS_PER_TURN;
    this.pushFeed(`▶️ ${this.name(pid)}'s turn — drew ${n} card${n > 1 ? 's' : ''}`);
    this.turnEndsAt = this.now + TURN_MS;
  }

  private finishEnd() {
    if (this.winner) return;
    this.turnIdx = (this.turnIdx + 1) % this.order.length;
    this.startTurn();
  }

  private requestEnd(auto: boolean) {
    if (this.winner || this.pendings.length > 0) return;
    const pid = this.current;
    this.winCheck();
    if (this.winner) return;
    // Hand limit: at most 7 at the END of your turn
    if (this.hands[pid].length > HAND_LIMIT) {
      this.discarding = { pid, need: this.hands[pid].length - HAND_LIMIT, endsAt: this.now + DISCARD_MS };
      if (!auto) this.pushFeed(`🗑️ ${this.name(pid)} must discard down to ${HAND_LIMIT}`);
      return;
    }
    this.finishEnd();
  }

  private charge(actorId: string, targetId: string, amount: number, reason: string, chainable: boolean) {
    if (amount <= 0) return;
    if (payableCards(this.bank[targetId], this.table[targetId]).length === 0) {
      this.pushFeed(`🫥 ${this.name(targetId)} has nothing to pay with — let off!`);
      return;
    }
    const hasJsn = this.hands[targetId].some((c) => c.action === 'noway');
    this.pendings.push({
      pid: this.pidSeq++,
      kind: 'pay',
      action: 'rent',
      actorId,
      targetId,
      amount,
      reason,
      chainable,
      jsnDecider: hasJsn ? targetId : null,
      phase: hasJsn ? 'jsn' : 'pay',
      endsAt: this.now + (hasJsn ? JSN_MS : PAY_MS),
    });
  }

  /** Resolves expired No Way! windows, payments, discards and turn time. Returns true if anything changed. */
  sweep(now: number): boolean {
    this.now = now;
    if (this.winner || !this.dealt) return false;
    let changed = false;
    [...this.pendings].forEach((p) => {
      if (now < p.endsAt) return;
      changed = true;
      if (p.phase === 'jsn') {
        if (p.jsnDecider === p.actorId) {
          // The actor didn't answer back — the block stands
          this.pushFeed(`🙅 The action was blocked!`);
          this.pendings = this.pendings.filter((x) => x.pid !== p.pid);
        } else {
          this.proceedPending(p);
        }
      } else if (p.kind === 'pay') {
        this.resolvePayPending(p, this.autoPaySelect(p.targetId, p.amount || 0));
      }
    });
    if (this.discarding && now >= this.discarding.endsAt) {
      const { pid, need } = this.discarding;
      const dump = this.hands[pid].slice(-need);
      this.hands[pid] = this.hands[pid].slice(0, this.hands[pid].length - need);
      this.discard.push(...dump);
      this.pushFeed(`🗑️ ${this.name(pid)} auto-discarded ${need}`);
      this.discarding = null;
      this.finishEnd();
      return true;
    }
    if (now >= this.turnEndsAt) {
      if (this.pendings.length > 0 || this.discarding) {
        this.turnEndsAt = now + TURN_GRACE_MS;
      } else {
        this.pushFeed(`⏰ ${this.name(this.current)} ran out of time`);
        this.requestEnd(true);
        changed = true;
      }
    }
    if (changed) this.winCheck();
    return changed;
  }

  /** Applies one player's move. Returns true if the state changed (broadcast it). */
  handle(from: string, m: PDMove, now: number): boolean {
    this.now = now;
    if (this.winner || !this.dealt || !this.order.includes(from)) return false;
    const currentPid = this.current;

    // --- No Way! decisions ---
    if (m.t === 'pd_jsn') {
      const p = this.pendings.find((x) => x.pid === m.pendingId);
      if (!p || p.phase !== 'jsn' || p.jsnDecider !== from) return false;
      if (m.use) {
        const card = this.hands[from].find((c) => c.action === 'noway');
        if (!card) return false;
        this.hands[from] = this.hands[from].filter((c) => c.id !== card.id);
        this.discard.push(card);
        if (from === p.targetId) {
          this.pushFeed(`🙅 ${this.name(p.targetId)} says NO WAY!`);
          // The attacker may answer back with their own No Way!
          if (p.chainable && this.hands[p.actorId].some((c) => c.action === 'noway')) {
            p.jsnDecider = p.actorId;
            p.endsAt = now + JSN_MS;
          } else {
            this.pendings = this.pendings.filter((x) => x.pid !== p.pid);
          }
        } else {
          this.pushFeed(`😮 ${this.name(p.actorId)} answers back with their OWN No Way!`);
          if (this.hands[p.targetId].some((c) => c.action === 'noway')) {
            p.jsnDecider = p.targetId;
            p.endsAt = now + JSN_MS;
          } else {
            this.proceedPending(p);
          }
        }
      } else if (from === p.targetId) {
        this.proceedPending(p);
      } else {
        this.pendings = this.pendings.filter((x) => x.pid !== p.pid); // attacker accepts the block
      }
      this.winCheck();
      return true;
    }

    // --- Paying ---
    if (m.t === 'pd_pay') {
      const p = this.pendings.find((x) => x.pid === m.pendingId);
      if (!p || p.kind !== 'pay' || p.phase !== 'pay' || p.targetId !== from) return false;
      const ids = Array.isArray(m.cardIds) ? m.cardIds : [];
      const eligible = payableCards(this.bank[from], this.table[from]);
      const eligibleIds = new Set(eligible.map((c) => c.id));
      if (!ids.every((id) => eligibleIds.has(id))) return false;
      const total = eligible.filter((c) => ids.includes(c.id)).reduce((sum, c) => sum + c.value, 0);
      const allAssets = new Set(ids).size === eligible.length;
      if (total < (p.amount || 0) && !allAssets) return false;
      this.resolvePayPending(p, [...new Set(ids)]);
      this.winCheck();
      return true;
    }

    // --- End-of-turn discard ---
    if (m.t === 'pd_discard') {
      if (!this.discarding || this.discarding.pid !== from) return false;
      const ids = [...new Set(Array.isArray(m.cardIds) ? m.cardIds : [])];
      if (ids.length !== this.discarding.need) return false;
      const hand = this.hands[from];
      if (!ids.every((id) => hand.some((c) => c.id === id))) return false;
      ids.forEach((id) => this.discard.push(hand.find((x) => x.id === id)!));
      this.hands[from] = hand.filter((c) => !ids.includes(c.id));
      this.discarding = null;
      this.finishEnd();
      return true;
    }

    // --- Moving a wildcard (free, own turn only) ---
    if (m.t === 'pd_flip') {
      if (from !== currentPid || this.pendings.length > 0 || this.discarding) return false;
      const got = this.removeTableCard(from, Number(m.cardId));
      if (!got) return false;
      const toColor = String(m.color);
      const valid = canPlayAsColor(got.card, toColor);
      this.giveTableCard(from, got.card, valid ? toColor : got.color);
      if (valid) this.pushFeed(`↔️ ${this.name(from)} moved a wildcard to ${COLORS[toColor as ColorId].label}`);
      this.winCheck();
      return true;
    }

    if (from !== currentPid || this.pendings.length > 0 || this.discarding) return false;

    if (m.t === 'pd_end') {
      this.requestEnd(false);
      return true;
    }

    if (m.t !== 'pd_play' || this.playsLeft <= 0) return false;
    const hand = this.hands[currentPid];
    const card = hand.find((c) => c.id === m.cardId);
    if (!card) return false;
    const removeFromHand = () => {
      this.hands[currentPid] = this.hands[currentPid].filter((c) => c.id !== card.id);
    };
    const done = () => {
      this.winCheck();
      return true;
    };
    const opponents = this.order.filter((id) => id !== currentPid);

    // Bank it (anything with value except plain properties)
    if (m.mode === 'money') {
      if (card.kind === 'property' || card.value <= 0) return false;
      removeFromHand();
      this.bank[currentPid].push(card);
      this.playsLeft -= 1;
      this.pushFeed(`💰 ${this.name(currentPid)} banked ${card.value}M`);
      return done();
    }

    // Lay out a property or wildcard
    if (m.mode === 'property') {
      let color: string | null = null;
      if (card.kind === 'property') color = card.color!;
      else if (card.kind === 'wild' && canPlayAsColor(card, String(m.color || ''))) color = String(m.color);
      if (!color) return false;
      removeFromHand();
      this.giveTableCard(currentPid, card, color);
      this.playsLeft -= 1;
      this.pushFeed(`🏠 ${this.name(currentPid)} played ${card.name || 'a wildcard'} (${COLORS[color as ColorId].label})`);
      return done();
    }

    // Rent cards
    if (m.mode === 'rent' && card.kind === 'rent') {
      const color = String(m.color || '');
      const okColor = card.any ? COLOR_IDS.includes(color as ColorId) : (card.colors || []).includes(color as ColorId);
      const g = this.table[currentPid][color];
      if (!okColor || !g || g.cards.length === 0) return false;
      if (card.any && !opponents.includes(String(m.target || ''))) return false;
      let mult = 1;
      let doubleCard: Card | undefined;
      if (m.doubleId !== undefined && m.doubleId !== null) {
        doubleCard = hand.find((c) => c.id === Number(m.doubleId) && c.action === 'double_rent');
        if (!doubleCard || this.playsLeft < 2) return false;
        mult = 2;
      }
      removeFromHand();
      this.discard.push(card);
      if (doubleCard) {
        this.hands[currentPid] = this.hands[currentPid].filter((c) => c.id !== doubleCard!.id);
        this.discard.push(doubleCard);
        this.playsLeft -= 2;
      } else {
        this.playsLeft -= 1;
      }
      const amount = rentFor(this.table[currentPid], color) * mult;
      const label = COLORS[color as ColorId].label;
      if (card.any) {
        const tgt = String(m.target);
        this.pushFeed(`🧾 ${this.name(currentPid)} charges ${this.name(tgt)} ${amount}M ${label} rent${mult > 1 ? ' (DOUBLED!)' : ''}!`);
        this.charge(currentPid, tgt, amount, '🧾', true);
      } else {
        this.pushFeed(`🧾 ${this.name(currentPid)} charges EVERYONE ${amount}M ${label} rent${mult > 1 ? ' (DOUBLED!)' : ''}!`);
        opponents.forEach((opp) => this.charge(currentPid, opp, amount, '🧾', false));
      }
      return done();
    }

    // Action cards
    if (m.mode !== 'action' || card.kind !== 'action' || !card.action || card.action === 'noway' || card.action === 'double_rent') return false;

    if (card.action === 'lucky') {
      removeFromHand();
      this.discard.push(card);
      this.draw(currentPid, 2);
      this.playsLeft -= 1;
      this.pushFeed(`🎁 ${this.name(currentPid)} played Lucky Draw — drew 2`);
      return done();
    }
    if (card.action === 'birthday') {
      removeFromHand();
      this.discard.push(card);
      this.playsLeft -= 1;
      this.pushFeed(`🎂 It's ${this.name(currentPid)}'s birthday — everyone pays 2M!`);
      opponents.forEach((opp) => this.charge(currentPid, opp, 2, '🎂', false));
      return done();
    }
    if (card.action === 'house' || card.action === 'hotel') {
      const color = String(m.color || '');
      const g = this.table[currentPid][color];
      if (!g || !groupComplete(color, g) || NO_BUILD.includes(color as ColorId)) return false;
      if (card.action === 'house' && g.house) return false;
      if (card.action === 'hotel' && (!g.house || g.hotel)) return false;
      removeFromHand();
      if (card.action === 'house') g.house = card;
      else g.hotel = card;
      this.playsLeft -= 1;
      this.pushFeed(`${card.action === 'house' ? '🏠' : '🏨'} ${this.name(currentPid)} built on ${COLORS[color as ColorId].label}!`);
      return done();
    }

    const tgt = String(m.target || '');
    if (!opponents.includes(tgt)) return false;

    if (card.action === 'payup') {
      removeFromHand();
      this.discard.push(card);
      this.playsLeft -= 1;
      this.pushFeed(`💼 ${this.name(currentPid)} asks ${this.name(tgt)} for 5M!`);
      this.charge(currentPid, tgt, 5, '💼', true);
      return done();
    }

    // swipe / swap / snatch
    if (card.action === 'swipe' || card.action === 'swap') {
      const pCardId = Number(m.propId);
      const okSteal = Object.entries(this.table[tgt]).some(([color, g]) => !groupComplete(color, g) && g.cards.some((c) => c.id === pCardId));
      if (!okSteal) return false;
    }
    if (card.action === 'swap') {
      const myCardId = Number(m.myPropId);
      const okMine = Object.entries(this.table[currentPid]).some(([color, g]) => !groupComplete(color, g) && g.cards.some((c) => c.id === myCardId));
      if (!okMine) return false;
    }
    if (card.action === 'snatch') {
      const color = String(m.color || '');
      const g = this.table[tgt][color];
      if (!g || !groupComplete(color, g)) return false;
    }
    removeFromHand();
    this.discard.push(card);
    this.playsLeft -= 1;
    const hasJsn = this.hands[tgt].some((c) => c.action === 'noway');
    const pend: Pending = {
      pid: this.pidSeq++,
      kind: 'steal',
      action: card.action,
      actorId: currentPid,
      targetId: tgt,
      color: m.color ? String(m.color) : undefined,
      cardId: card.action === 'snatch' ? undefined : Number(m.propId),
      myCardId: card.action === 'swap' ? Number(m.myPropId) : undefined,
      chainable: true,
      jsnDecider: hasJsn ? tgt : null,
      phase: hasJsn ? 'jsn' : 'pay',
      endsAt: now + JSN_MS,
    };
    this.pendings.push(pend);
    if (hasJsn) this.pushFeed(`⚡ ${this.name(currentPid)} plays ${ACTION_INFO[card.action].label} on ${this.name(tgt)}!`);
    else this.applySteal(pend);
    return done();
  }
}
