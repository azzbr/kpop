import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Club } from '../../store';
import type { ClubMember } from '../../online/clubLogic';
import { openRooms, memberAction, STATUS_TEXT } from '../../online/clubLogic';
import { parseClubCode } from '../../data/clubWords';
import { playClick, playUnlock } from '../../utils/sounds';
import TypeBox from './TypeBox';

// The "Club" part of Friends Arena: who from my club is online, their open rooms ("🙋 Ask to
// join"), and inviting free friends into my room. Joining a club needs the code a grown-up or
// teacher shares (FOX-RAINBOW-27); club names come from the code, so nothing is typed.

interface Props {
  clubs: Club[];
  active: Club | null;
  setActive: (code: string) => void;
  onJoinClub: (c: Club) => void;
  onLeaveClub: (code: string) => void;
  members: ClubMember[];
  connected: boolean;
  gameTitle: (id?: string) => string | undefined;
  myRoom: string | null;
  isHost: boolean;
  /** Returns false if it was sent too recently. */
  onKnock: (m: ClubMember) => boolean;
  onInvite: (m: ClubMember) => boolean;
  /** Who I've knocked on / invited (shown as "asked"). */
  pending: Record<string, 'knock' | 'invite'>;
}

export default function ClubPanel(p: Props) {
  const [adding, setAdding] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (adding || !p.clubs.length) {
    return adding ? (
      <TypeBox label="🏕️ Club code (from your grown-up or teacher)" placeholder="FOX RAINBOW 27" max={20} space digits code
        enterLabel="Join ✓"
        onCancel={() => setAdding(false)}
        onDone={(t) => {
          const c = parseClubCode(t);
          if (!c) return "Hmm, that's not a club code — check it with your grown-up! 🔍";
          playUnlock();
          p.onJoinClub(c);
          setAdding(false);
          return null;
        }} />
    ) : (
      <div className="rounded-3xl bg-white/10 border border-white/20 p-5 text-center">
        <div className="text-4xl mb-2">🏕️</div>
        <div className="font-fredoka text-xl mb-1">Join your club</div>
        <p className="font-nunito text-lg text-teal-100 mb-4">In a club you can see which friends are online and join their rooms — no code needed! Your grown-up or teacher has the club code.</p>
        <button type="button" onClick={() => { playClick(); setAdding(true); }}
          className="min-h-[52px] px-6 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 font-fredoka text-lg">🔑 I have a club code</button>
      </div>
    );
  }

  const club = p.active ?? p.clubs[0];
  const rooms = openRooms(p.members, p.myRoom);

  return (
    <div className="rounded-3xl bg-white/10 border border-white/20 p-4" aria-label="Club">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {p.clubs.map(c => (
          <button key={c.code} type="button" onClick={() => { playClick(); p.setActive(c.code); }}
            className={`min-h-[48px] px-4 rounded-full font-fredoka text-lg ${c.code === club.code ? 'bg-amber-400 text-stone-900' : 'bg-white/10'}`}>
            {c.emoji} {c.name}
          </button>
        ))}
        <button type="button" aria-label="Join another club" onClick={() => { playClick(); setAdding(true); }}
          className="min-h-[48px] px-4 rounded-full bg-white/10 font-fredoka text-lg">➕</button>
      </div>

      {rooms.length > 0 && (
        <div className="mb-4">
          <div className="font-fredoka text-lg mb-2">🏠 Rooms in {club.name}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {rooms.map(r => {
              const asked = p.pending[r.host.id] === 'knock';
              return (
                <div key={r.code} className="rounded-2xl bg-black/20 p-3 flex items-center gap-3">
                  <span className="text-3xl">{r.host.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-fredoka text-lg truncate">{r.host.name}'s room {r.locked && '🔒'}</div>
                    <div className="font-nunito text-base text-teal-200 truncate">
                      {r.players} {r.players === 1 ? 'player' : 'players'}{r.game ? ` · playing ${p.gameTitle(r.game) ?? 'a game'}` : ' · in the lobby'}
                    </div>
                  </div>
                  <button type="button" disabled={asked} onClick={() => { playClick(); p.onKnock(r.host); }}
                    className={`min-h-[48px] px-4 rounded-full font-fredoka text-base ${asked ? 'bg-white/10 text-teal-200' : 'bg-emerald-500'}`}>
                    {asked ? '⏳ Asked' : '🙋 Ask to join'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="font-fredoka text-lg mb-2">👋 Online in {club.name} {p.connected ? `(${p.members.length})` : '…'}</div>
      {p.connected && p.members.length === 0 && (
        <p className="font-nunito text-lg text-teal-100">Nobody else is here right now. Make a room — club friends will see it!</p>
      )}
      <div className="flex flex-wrap gap-2">
        {p.members.map(m => {
          const act = memberAction(m, { roomCode: p.myRoom, isHost: p.isHost });
          const pend = p.pending[m.id];
          const label = act === 'invite' ? (pend === 'invite' ? '✉️ Invited' : '✉️ Invite') : act === 'knock' ? (pend === 'knock' ? '⏳ Asked' : '🙋 Ask to join') : null;
          return (
            <motion.button key={m.id} type="button" layout initial={{ scale: 0 }} animate={{ scale: 1 }}
              disabled={!label || !!pend}
              onClick={() => { playClick(); if (act === 'invite') p.onInvite(m); else if (act === 'knock') p.onKnock(m); }}
              className={`min-h-[56px] flex items-center gap-2 rounded-2xl px-3 py-2 text-left ${label && !pend ? 'bg-white/15 border-2 border-emerald-400/60' : 'bg-white/5 border-2 border-transparent'}`}>
              <span className="text-3xl">{m.emoji}</span>
              <span>
                <span className="block font-fredoka text-lg leading-tight">{m.name}{m.role === 'teacher' && ' 🍎'}</span>
                <span className="block font-nunito text-base text-teal-200 leading-tight">
                  {act === 'same_room' ? 'in your room' : m.status === 'playing' && m.room?.game ? `playing ${p.gameTitle(m.room.game) ?? 'a game'}` : STATUS_TEXT[m.status]}
                </span>
              </span>
              {label && <span className="ml-1 rounded-full bg-emerald-500/30 px-2 py-1 font-fredoka text-sm">{label}</span>}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 text-right">
        <button type="button" onClick={() => {
          if (confirmLeave) { setConfirmLeave(false); p.onLeaveClub(club.code); return; }
          playClick(); setConfirmLeave(true); window.setTimeout(() => setConfirmLeave(false), 3000);
        }} className={`min-h-[48px] px-4 rounded-full font-fredoka text-base ${confirmLeave ? 'bg-red-600' : 'bg-white/10'}`}>
          {confirmLeave ? 'Tap again to leave the club' : '🚪 Leave club'}
        </button>
      </div>
    </div>
  );
}
