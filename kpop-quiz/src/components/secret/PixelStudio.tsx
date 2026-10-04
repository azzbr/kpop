import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MAX_PIXEL_ART, useGameStore } from '../../store';
import type { PixelArt } from '../../store';
import { playClick, playPop, playUnlock } from '../../utils/sounds';
import { isClean } from '../../utils/cleanText';
import OnScreenKeyboard from '../ui/OnScreenKeyboard';
import {
  GRID, PALETTE, brushIndices, cellAt, drawPixelArt, emptyPixels, floodFill, isEmptyArt,
  lineCells, makeArt, newArtId, nextPresetName, paintCells, pushUndo,
} from './pixelLogic';

type Tool = 'paint' | 'erase' | 'fill';
const MAX_NAME = 16;

/** Grid side in px: big and square, leaving room for the controls. */
function useGridSize(): number {
  const calc = () => {
    if (typeof window === 'undefined') return 320;
    const w = window.innerWidth, h = window.innerHeight;
    const landscape = w >= 1000 && w > h;
    const size = landscape ? Math.min(h - 200, w * 0.58) : Math.min(w - 32, h - 400, 800);
    return Math.max(260, Math.floor(size / GRID) * GRID);
  };
  const [size, setSize] = useState(calc);
  useEffect(() => {
    const on = () => setSize(calc());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return size;
}

function Thumb({ art, size = 56 }: { art: PixelArt; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    ctx.clearRect(0, 0, c.width, c.height);
    drawPixelArt(ctx, art, 0, 0, size * dpr);
  }, [art, size]);
  return <canvas ref={ref} style={{ width: size, height: size, imageRendering: 'pixelated' }} className="rounded-md bg-slate-800/80" aria-hidden />;
}

export default function PixelStudio() {
  const leaveSecret = useGameStore(s => s.leaveSecret);
  const gallery = useGameStore(s => s.pixelArt);
  const savePixelArt = useGameStore(s => s.savePixelArt);
  const deletePixelArt = useGameStore(s => s.deletePixelArt);
  const equip = useGameStore(s => s.equip);
  const wornSkin = useGameStore(s => s.equipped.skin);

  const [pixels, setPixels] = useState<string[]>(() => emptyPixels());
  const [undo, setUndo] = useState<string[][]>([]);
  const [tool, setTool] = useState<Tool>('paint');
  const [color, setColor] = useState<string>(PALETTE[4]);
  const [mirror, setMirror] = useState(false);
  const [artId, setArtId] = useState<string | null>(null);
  const [name, setName] = useState(() => nextPresetName(useGameStore.getState().pixelArt.map(a => a.name)));
  const [dirty, setDirty] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);

  const gridSize = useGridSize();
  const gridRef = useRef<HTMLDivElement>(null);
  const pixelsRef = useRef(pixels);
  const stroke = useRef<{ pointerId: number; last: number; before: string[] } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => { pixelsRef.current = pixels; }, [pixels]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!clearArmed) return;
    const t = window.setTimeout(() => setClearArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [clearArmed]);
  useEffect(() => {
    if (!deleteArmed) return;
    const t = window.setTimeout(() => setDeleteArmed(null), 3000);
    return () => window.clearTimeout(t);
  }, [deleteArmed]);

  const showToast = useCallback((text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const commit = (next: string[]) => {
    pixelsRef.current = next;
    setPixels(next);
  };

  // ---- Painting -------------------------------------------------------------
  const applyBrush = (cells: number[]) => {
    const c = tool === 'erase' ? '' : color;
    const idx = cells.flatMap(i => brushIndices(i, mirror));
    const next = paintCells(pixelsRef.current, idx, c);
    if (next !== pixelsRef.current) commit(next);
  };

  const cellFromEvent = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = gridRef.current;
    if (!el) return -1;
    return cellAt(e.clientX, e.clientY, el.getBoundingClientRect());
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stroke.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cell = cellFromEvent(e);
    if (cell < 0) return;
    e.preventDefault();
    setClearArmed(false);
    if (tool === 'fill') {
      const before = pixelsRef.current;
      const next = floodFill(before, cell, color);
      if (next !== before) {
        setUndo(u => pushUndo(u, before));
        commit(next);
        setDirty(true);
        playPop();
      }
      return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old Safari */ }
    stroke.current = { pointerId: e.pointerId, last: cell, before: pixelsRef.current };
    applyBrush([cell]);
    playPop();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const cell = cellFromEvent(e);
    if (cell < 0 || cell === s.last) return;
    applyBrush(lineCells(s.last, cell));
    s.last = cell;
  };

  const endStroke = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.pointerId !== e.pointerId) return;
    stroke.current = null;
    if (pixelsRef.current !== s.before) {
      setUndo(u => pushUndo(u, s.before));
      setDirty(true);
    }
  };

  // ---- Tools ----------------------------------------------------------------
  const pickTool = (t: Tool) => { playClick(); setTool(t); };
  const pickColor = (c: string) => { playClick(); setColor(c); if (tool === 'erase') setTool('paint'); };

  const doUndo = () => {
    if (!undo.length) return;
    playClick();
    commit(undo[undo.length - 1]);
    setUndo(undo.slice(0, -1));
    setDirty(true);
  };

  const doClear = () => {
    if (isEmptyArt(pixels)) return;
    if (!clearArmed) { playClick(); setClearArmed(true); return; }
    setUndo(u => pushUndo(u, pixelsRef.current));
    commit(emptyPixels());
    setClearArmed(false);
    setDirty(true);
    playPop();
  };

  // ---- Saving & gallery -----------------------------------------------------
  const doSave = (): string | null => {
    if (isEmptyArt(pixels)) { showToast('Draw something first! 🎨'); return null; }
    const isNew = !artId;
    if (isNew && gallery.length >= MAX_PIXEL_ART) {
      showToast(`Your gallery is full (${MAX_PIXEL_ART}). Delete one to make room! 🖼️`);
      return null;
    }
    const id = artId ?? newArtId();
    savePixelArt(makeArt(id, name, pixels));
    if (isNew) useGameStore.getState().incrementPatternsCreated();
    setArtId(id);
    setDirty(false);
    playUnlock();
    showToast(isNew ? `Saved "${name}"! ✨` : `Saved! ✨`);
    return id;
  };

  const doNew = () => {
    playClick();
    setPixels(emptyPixels());
    pixelsRef.current = emptyPixels();
    setUndo([]);
    setArtId(null);
    setDirty(false);
    setClearArmed(false);
    setName(nextPresetName(gallery.map(a => a.name)));
  };

  const loadArt = (art: PixelArt) => {
    playClick();
    const px = makeArt(art.id, art.name, art.pixels).pixels;
    commit(px);
    setUndo([]);
    setArtId(art.id);
    setName(art.name);
    setDirty(false);
    setClearArmed(false);
  };

  const doDelete = (art: PixelArt) => {
    if (deleteArmed !== art.id) { playClick(); setDeleteArmed(art.id); return; }
    deletePixelArt(art.id);
    setDeleteArmed(null);
    if (art.id === artId) { setArtId(null); setDirty(!isEmptyArt(pixelsRef.current)); }
    playPop();
    showToast('Deleted 🗑️');
  };

  const isWorn = !!artId && wornSkin === artId;
  const doWear = () => {
    if (!artId) return;
    if (isWorn) {
      playClick();
      equip({ skin: '' });
      showToast('Skin taken off 👕');
      return;
    }
    const id = dirty ? doSave() : artId;
    if (!id) return;
    equip({ skin: id });
    playUnlock();
    showToast("You'll wear it in Paper Clash! 🗺️");
  };

  // ---- Rename ---------------------------------------------------------------
  const openRename = () => { playClick(); setDraftName(name); setRenaming(true); };
  const onKey = useCallback((k: string) => setDraftName(d => (d.length >= MAX_NAME ? d : (d + k).replace(/^\s+/, '').replace(/\s{2,}/g, ' '))), []);
  const onBackspace = useCallback(() => setDraftName(d => d.slice(0, -1)), []);
  const onEnter = useCallback(() => {
    const n = draftName.trim();
    if (!n) { setRenaming(false); return; }
    if (!isClean(n)) { showToast("Let's pick a different name 🙂"); return; }
    const pretty = n.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
    setName(pretty);
    setDirty(true);
    setRenaming(false);
    playClick();
  }, [draftName, showToast]);

  // ---- UI ---------------------------------------------------------------------
  const toolBtn = (t: Tool, icon: string, label: string) => (
    <button
      type="button"
      onClick={() => pickTool(t)}
      aria-pressed={tool === t}
      aria-label={label}
      className={`min-w-[56px] min-h-[56px] px-2 rounded-2xl flex flex-col items-center justify-center text-2xl transition-colors ${tool === t ? 'bg-fuchsia-500 ring-4 ring-white/70' : 'bg-white/15 active:bg-white/25'}`}
    >
      <span aria-hidden>{icon}</span>
      <span className="text-xs font-nunito font-bold">{label}</span>
    </button>
  );

  const actionBtn = 'min-h-[48px] px-4 rounded-2xl font-fredoka text-lg disabled:opacity-40 active:scale-95 transition-transform';

  return (
    <div
      className="arcade-bg min-h-screen-d text-white font-nunito"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      <div className="flex items-center gap-3 mb-1">
        <button type="button" onClick={() => { playClick(); leaveSecret(); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">← Back</button>
        <h1 className="font-fredoka text-3xl md:text-4xl">👾 Pixel Studio</h1>
      </div>
      <p className="text-lg text-white/80 mb-3">Drag to paint. Your art can be your Paper Clash skin!</p>

      <div className="flex flex-col lg:flex-row gap-4 items-center lg:items-start">
        {/* Canvas */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 w-full justify-between" style={{ maxWidth: gridSize }}>
            <button type="button" onClick={renaming ? () => setRenaming(false) : openRename} className="min-h-[44px] px-3 rounded-xl bg-white/10 font-fredoka text-xl truncate" aria-label="Rename">
              {name} <span aria-hidden className="text-base">✏️</span>
            </button>
            <span className="text-base text-white/70 shrink-0">
              {isWorn ? '👕 Wearing' : dirty ? 'Not saved yet' : artId ? 'Saved ✓' : ''}
            </span>
          </div>
          <div
            ref={gridRef}
            data-testid="pixel-grid"
            className="game-surface grid rounded-xl overflow-hidden shadow-2xl ring-4 ring-white/20 bg-slate-900"
            style={{
              width: gridSize, height: gridSize, touchAction: 'none',
              gridTemplateColumns: `repeat(${GRID}, 1fr)`, gap: 1,
              cursor: tool === 'fill' ? 'cell' : 'crosshair',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onLostPointerCapture={endStroke}
            onContextMenu={e => e.preventDefault()}
          >
            {pixels.map((p, i) => {
              const r = Math.floor(i / GRID), c = i % GRID;
              const mirrorLine = mirror && c === GRID / 2;
              return (
                <div
                  key={i}
                  data-cell={i}
                  style={{
                    background: p || ((r + c) % 2 ? '#334155' : '#3f4b5f'),
                    boxShadow: mirrorLine ? 'inset 2px 0 0 rgba(250,204,21,0.9)' : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 w-full" style={{ maxWidth: Math.max(gridSize, 340) }}>
          {renaming ? (
            <div className="rounded-2xl bg-black/30 p-3 space-y-2">
              <div className="font-fredoka text-2xl text-center min-h-[40px] bg-white/10 rounded-xl py-1">{draftName || <span className="text-white/40">Type a name</span>}<span className="animate-pulse">|</span></div>
              <OnScreenKeyboard onKey={onKey} onBackspace={onBackspace} onEnter={onEnter} space digits enterLabel="OK" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 justify-center" role="toolbar" aria-label="Tools">
                {toolBtn('paint', '✏️', 'Paint')}
                {toolBtn('erase', '🧽', 'Erase')}
                {toolBtn('fill', '🪣', 'Fill')}
                <button
                  type="button"
                  onClick={() => { playClick(); setMirror(m => !m); }}
                  aria-pressed={mirror}
                  aria-label="Mirror"
                  className={`min-w-[56px] min-h-[56px] px-2 rounded-2xl flex flex-col items-center justify-center text-2xl ${mirror ? 'bg-yellow-500 text-slate-900 ring-4 ring-white/70' : 'bg-white/15'}`}
                >
                  <span aria-hidden>🪞</span><span className="text-xs font-bold">Mirror</span>
                </button>
                <button type="button" onClick={doUndo} disabled={!undo.length} aria-label="Undo" className="min-w-[56px] min-h-[56px] px-2 rounded-2xl flex flex-col items-center justify-center text-2xl bg-white/15 disabled:opacity-40">
                  <span aria-hidden>↩️</span><span className="text-xs font-bold">Undo</span>
                </button>
                <button type="button" onClick={doClear} disabled={isEmptyArt(pixels)} aria-label={clearArmed ? 'Tap again to clear' : 'Clear'} className={`min-w-[56px] min-h-[56px] px-2 rounded-2xl flex flex-col items-center justify-center text-2xl disabled:opacity-40 ${clearArmed ? 'bg-red-500 ring-4 ring-white/70' : 'bg-white/15'}`}>
                  <span aria-hidden>🗑️</span><span className="text-xs font-bold">{clearArmed ? 'Sure?' : 'Clear'}</span>
                </button>
              </div>

              <div className="grid grid-cols-8 gap-2 mx-auto" role="radiogroup" aria-label="Colours">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c && tool !== 'erase'}
                    aria-label={`Colour ${c}`}
                    onClick={() => pickColor(c)}
                    className={`w-11 h-11 md:w-12 md:h-12 rounded-xl border-2 border-white/30 transition-transform ${color === c && tool !== 'erase' ? 'ring-4 ring-white scale-110' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 justify-center">
            <button type="button" onClick={doNew} className={`${actionBtn} bg-white/15`}>🆕 New</button>
            <button type="button" onClick={() => doSave()} className={`${actionBtn} bg-green-500 text-white`}>💾 Save</button>
            <button type="button" onClick={doWear} disabled={!artId} className={`${actionBtn} ${isWorn ? 'bg-white/20' : 'bg-fuchsia-600'}`}>
              {isWorn ? '👕 Take off' : '👕 Wear in Paper Clash'}
            </button>
          </div>

          <div>
            <h2 className="font-fredoka text-xl mb-1">🖼️ My Art <span className="text-base text-white/60">({gallery.length}/{MAX_PIXEL_ART})</span></h2>
            {gallery.length === 0 ? (
              <p className="text-base text-white/60">Saved pictures show up here.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                {gallery.map(art => (
                  <div key={art.id} className={`shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl ${art.id === artId ? 'bg-fuchsia-500/40 ring-2 ring-fuchsia-300' : 'bg-white/10'}`}>
                    <button type="button" onClick={() => loadArt(art)} aria-label={`Open ${art.name}`} className="relative">
                      <Thumb art={art} />
                      {wornSkin === art.id && <span className="absolute -top-2 -right-2 text-lg" aria-label="Wearing">👕</span>}
                    </button>
                    <span className="text-sm max-w-[80px] truncate">{art.name}</span>
                    <button
                      type="button"
                      onClick={() => doDelete(art)}
                      aria-label={deleteArmed === art.id ? `Tap again to delete ${art.name}` : `Delete ${art.name}`}
                      className={`min-w-[44px] min-h-[44px] rounded-xl text-lg ${deleteArmed === art.id ? 'bg-red-500 px-2 text-sm font-bold' : 'bg-white/10'}`}
                    >
                      {deleteArmed === art.id ? 'Sure?' : '🗑️'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            role="status"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900/95 ring-2 ring-fuchsia-400 font-fredoka text-xl shadow-2xl text-center"
            style={{ bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))', x: '-50%' }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
