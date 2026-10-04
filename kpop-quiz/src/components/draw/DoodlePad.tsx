import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store';
import { LOCKER_ITEMS } from '../../data/lockerItems';
import { playClick, playUnlock } from '../../utils/sounds';
import DoodleCanvas, { type DoodleHandle } from './DoodleCanvas';
import { BACKGROUNDS } from './doodleLogic';
import { listDoodles, getDoodle, saveDoodle, deleteDoodle, MURAL_ID, MAX_DOODLES, type SavedDoodle } from './doodleStore';

// Doodle Pad (Secret Club) and the Sticker Board (tap the F on the welcome screen).
// Both use DoodleCanvas. The pad saves to a gallery; the board autosaves one big picture.

const newId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function DoodlePad({ mode = 'pad' }: { mode?: 'pad' | 'mural' }) {
  const { inventory, leaveSecret, incrementDrawingsCreated } = useGameStore();
  const canvas = useRef<DoodleHandle>(null);
  const [bg, setBg] = useState(mode === 'mural' ? BACKGROUNDS[4].color : BACKGROUNDS[0].color);
  const [current, setCurrent] = useState<{ id: string | null; image: Blob | null; key: number }>({ id: mode === 'mural' ? MURAL_ID : null, image: null, key: 0 });
  const [gallery, setGallery] = useState<SavedDoodle[] | null>(null);
  const [showBg, setShowBg] = useState(false);
  const [toast, setToast] = useState('');
  const [edited, setEdited] = useState(false);
  const autosave = useRef<number | undefined>(undefined);
  const ownedStickers = useMemo(
    () => LOCKER_ITEMS.filter(i => i.kind === 'sticker' && inventory.includes(i.id)).map(i => i.value),
    [inventory],
  );

  const say = (text: string) => { setToast(text); window.setTimeout(() => setToast(''), 2200); };

  // The sticker board picks up where it was left.
  useEffect(() => {
    if (mode !== 'mural') return;
    getDoodle(MURAL_ID).then(d => {
      if (!d) return;
      setBg(d.background);
      setCurrent({ id: MURAL_ID, image: d.image, key: 1 });
    });
  }, [mode]);

  const save = useCallback(async (quiet = false) => {
    const c = canvas.current;
    if (!c) return;
    const image = await c.toBlob();
    if (!image) return;
    const id = current.id ?? newId();
    const now = Date.now();
    const ok = await saveDoodle({ id, created: now, updated: now, background: bg, image, thumb: c.thumbnail() });
    if (!ok) { if (!quiet) say("Couldn't save on this device 😕"); return; }
    if (!current.id) incrementDrawingsCreated();
    setCurrent(cur => ({ ...cur, id }));
    setEdited(false);
    if (!quiet) { playUnlock(); say('Saved to your gallery! 🖼️'); }
  }, [bg, current.id, incrementDrawingsCreated]);

  const onEdit = useCallback(() => {
    setEdited(true);
    if (mode !== 'mural') return;
    window.clearTimeout(autosave.current);
    autosave.current = window.setTimeout(() => { void save(true); }, 1200);
  }, [mode, save]);

  useEffect(() => () => window.clearTimeout(autosave.current), []);

  const back = async () => {
    playClick();
    if (mode === 'mural' && edited) await save(true);
    leaveSecret();
  };

  const openGallery = async () => { playClick(); setGallery(await listDoodles()); };
  const openDoodle = (d: SavedDoodle) => {
    playClick();
    setBg(d.background);
    setCurrent({ id: d.id, image: d.image, key: Date.now() });
    setGallery(null);
    setEdited(false);
  };
  const startNew = () => {
    playClick();
    setCurrent({ id: null, image: null, key: Date.now() });
    setEdited(false);
  };

  const pill = 'min-h-[48px] px-4 rounded-full font-fredoka text-lg text-white';

  return (
    <div className="arcade-bg min-h-screen-d h-[100dvh] flex flex-col text-white px-3 pb-3"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button onClick={back} className={`${pill} bg-white/15`}>← Back</button>
        <h1 className="font-fredoka text-2xl md:text-3xl mr-auto">{mode === 'mural' ? '🖼️ Sticker Board' : '🎨 Doodle Pad'}</h1>
        <button onClick={() => { playClick(); setShowBg(v => !v); }} className={`${pill} bg-white/15`} aria-expanded={showBg}>🎨 Paper</button>
        {mode === 'pad' && (
          <>
            <button onClick={startNew} className={`${pill} bg-white/15`}>✨ New</button>
            <button onClick={openGallery} className={`${pill} bg-white/15`}>🖼️ Gallery</button>
            <button onClick={() => { playClick(); void save(); }} className={`${pill} bg-gradient-to-r from-fuchsia-500 to-orange-400`}>💾 Save</button>
          </>
        )}
        {mode === 'mural' && <span className="font-nunito text-sm text-violet-200">Saves by itself ✓</span>}
      </div>

      {showBg && (
        <div className="flex flex-wrap gap-2 mb-2" aria-label="Paper colour">
          {BACKGROUNDS.map(b => (
            <button key={b.id} onClick={() => { playClick(); setBg(b.color); setShowBg(false); onEdit(); }}
              className={`min-h-[48px] px-4 rounded-xl font-fredoka text-base border-4 ${bg === b.color ? 'border-fuchsia-400' : 'border-transparent'}`}
              style={{ background: b.color, color: b.id === 'night' ? '#fff' : '#1e1b4b' }}>{b.label}</button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0">
        <DoodleCanvas key={current.key} ref={canvas} background={bg} initialImage={current.image}
          initialTool={mode === 'mural' ? 'sticker' : 'pen'} extraStickers={ownedStickers} onEdit={onEdit} />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-white text-violet-900 font-fredoka text-xl px-6 py-3 shadow-xl" role="status">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gallery && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4" onClick={() => setGallery(null)}>
            <div className="w-full max-w-3xl max-h-[85dvh] overflow-y-auto rounded-3xl bg-indigo-950 p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center mb-3">
                <h2 className="font-fredoka text-2xl mr-auto">🖼️ My gallery <span className="text-violet-300 text-lg">({gallery.length}/{MAX_DOODLES})</span></h2>
                <button onClick={() => setGallery(null)} className={`${pill} bg-white/15`}>Close</button>
              </div>
              {gallery.length === 0 && <p className="font-nunito text-lg text-violet-200">No saved doodles yet — draw something and tap 💾 Save!</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gallery.map(d => (
                  <div key={d.id} className="relative">
                    <button onClick={() => openDoodle(d)} className="block w-full rounded-2xl overflow-hidden border-4 border-white/10" aria-label="Open doodle">
                      <img src={d.thumb} alt="" className="w-full aspect-[4/3] object-cover" />
                    </button>
                    <button aria-label="Delete doodle"
                      onClick={async () => { playClick(); await deleteDoodle(d.id); setGallery(await listDoodles()); if (current.id === d.id) setCurrent(c => ({ ...c, id: null })); }}
                      className="absolute top-1 right-1 w-11 h-11 rounded-full bg-black/60 text-xl">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
