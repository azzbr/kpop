// Chess Academy's own piece set: chunky, rounded SVG pieces drawn for this game (not copied from any
// chess font or piece set). Each piece is one merged silhouette with a thick outline — dark on the cream
// pieces, light on the plum ones — so both read on light and dark squares, plus a few inner details
// (collars, a door on the rook, a mane and an eye on the knight, a gem on the queen and king).
import { useId } from 'react';
import type { ReactNode } from 'react';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

interface Palette {
  top: string;
  bottom: string;
  outline: string;
  /** Inner detail lines (collars, door, eye). */
  detail: string;
  /** Second tone: the knight's mane, bands. */
  accent: string;
  shine: string;
  shineOpacity: number;
  gem: string;
  /** A thin dark rim outside the light outline (plum pieces), so they keep their size on light squares. */
  rim?: string;
}

const PALETTE: Record<PieceColor, Palette> = {
  w: {
    top: '#fffaf0', bottom: '#f0d7a6', outline: '#3b2148', detail: '#3b2148', accent: '#e8c27c',
    shine: '#ffffff', shineOpacity: 0.95, gem: '#f472b6',
  },
  b: {
    top: '#7a4aa6', bottom: '#33194f', outline: '#f6eeff', detail: '#f1e4ff', accent: '#9b6bd1',
    shine: '#e9d5ff', shineOpacity: 0.55, gem: '#fbbf24', rim: '#2a1245',
  },
};

/** Outline width in viewBox units (100 × 100). */
const OUT = 4.6;
/** Inner line width. */
const LINE = 3.2;

/** Shared foot: a wide rounded plinth with a band on top. */
const base = (wide = true) => (
  <>
    <rect x={wide ? 20 : 24} y={77} width={wide ? 60 : 52} height={13} rx={6.5} />
    <rect x={wide ? 27 : 30} y={70} width={wide ? 46 : 40} height={11} rx={5.5} />
  </>
);

interface Drawing {
  /** The filled shapes; drawn once as the outline and once as the fill, so it reads as one silhouette. */
  body: ReactNode;
  /** Inner lines and bands drawn on top (palette passed in). */
  details?: (p: Palette) => ReactNode;
  /** Highlight strokes (upper left). */
  shine: string;
}

const DRAWINGS: Record<PieceType, Drawing> = {
  p: {
    body: (
      <>
        <circle cx={50} cy={28} r={13.5} />
        <rect x={34} y={42} width={32} height={9} rx={4.5} />
        <path d="M40 49 C40 58 35 65 31 73 L69 73 C65 65 60 58 60 49 Z" />
        {base(false)}
      </>
    ),
    details: p => (
      <>
        <path d="M35 50.5 H65" stroke={p.detail} />
        <path d="M31.5 72.5 H68.5" stroke={p.detail} />
      </>
    ),
    shine: 'M42 22 Q45 17.5 50 17',
  },
  r: {
    body: (
      <>
        <path d="M25 40 V20 Q25 16 29 16 H34 Q38 16 38 20 V25 H44 V20 Q44 16 48 16 H52 Q56 16 56 20 V25 H62 V20 Q62 16 66 16 H71 Q75 16 75 20 V40 Z" />
        <rect x={23} y={36} width={54} height={9} rx={4} />
        <path d="M33 44 L31 71 L69 71 L67 44 Z" />
        {base()}
      </>
    ),
    details: p => (
      <>
        <path d="M24 44.5 H76" stroke={p.detail} />
        <path d="M28 70.5 H72" stroke={p.detail} />
        <path d="M44 70 V61 Q44 55 50 55 Q56 55 56 61 V70" fill={p.accent} stroke={p.detail} />
      </>
    ),
    shine: 'M30 22 V34',
  },
  b: {
    body: (
      <>
        <circle cx={50} cy={12.5} r={6.5} />
        <path d="M50 18 C61 25 68 35 65 45 C63 51 57 54.5 50 54.5 C43 54.5 37 51 35 45 C32 35 39 25 50 18 Z" />
        <rect x={35} y={52} width={30} height={9} rx={4.5} />
        <path d="M41.5 60 C41.5 65 37 69 32 72 L68 72 C63 69 58.5 65 58.5 60 Z" />
        {base()}
      </>
    ),
    details: p => (
      <>
        <path d="M58.5 29 L48.5 40" stroke={p.detail} strokeWidth={LINE + 0.8} />
        <path d="M36 60.5 H64" stroke={p.detail} />
        <path d="M28 71.5 H72" stroke={p.detail} />
      </>
    ),
    shine: 'M40 38 Q40 30 46 24',
  },
  n: {
    body: (
      <>
        <path d="M31 72 C31 64 37 59 44 55 C38 57.5 31 60.5 25 60 C19 59.5 15.5 54 18.5 48.5 L32 28 C35 23 39 19.5 44 17 L49 7.5 C53 11 55.5 14 57 18 C70 23.5 77 39 75 55 C74.5 62 73 67 71.5 72 Z" />
        {base()}
      </>
    ),
    details: p => (
      <>
        {/* mane: soft bumps down the back of the neck */}
        <path
          d="M56.5 17.5 C70 23.5 77 39 75 55 C74.6 59 74 62 73.4 65 C69 64 66.5 60.5 68 56.5 C64 54.5 63 50 65.5 46.5 C61.5 44 61 39.5 63.5 36 C59.5 33.5 59 29 61.5 26 C58 24.5 56 21 56.5 17.5 Z"
          fill={p.accent} stroke={p.detail} strokeWidth={LINE}
        />
        <circle cx={39} cy={33} r={3.6} fill={p.detail} stroke="none" />
        <circle cx={38} cy={31.8} r={1.2} fill={p === PALETTE.w ? '#ffffff' : '#33194f'} stroke="none" />
        <ellipse cx={23.5} cy={53} rx={2} ry={1.5} fill={p.detail} stroke="none" />
        <path d="M28 71.5 H72" stroke={p.detail} />
      </>
    ),
    shine: 'M26 47 L36 32',
  },
  q: {
    body: (
      <>
        <path d="M32 54 L22 26 L31.5 40 L35 19 L43 37.5 L50 14 L57 37.5 L65 19 L68.5 40 L78 26 L68 54 Z" />
        <circle cx={22} cy={25} r={5.5} />
        <circle cx={35} cy={18} r={5.5} />
        <circle cx={50} cy={12.5} r={6} />
        <circle cx={65} cy={18} r={5.5} />
        <circle cx={78} cy={25} r={5.5} />
        <rect x={30} y={50} width={40} height={9} rx={4.5} />
        <path d="M38 58 C38 64 33 68.5 28 72 L72 72 C67 68.5 62 64 62 58 Z" />
        {base()}
      </>
    ),
    details: p => (
      <>
        <path d="M31 50.5 H69" stroke={p.detail} />
        <path d="M31 58.5 H69" stroke={p.detail} />
        <circle cx={50} cy={54.5} r={3} fill={p.gem} stroke={p.outline} strokeWidth={1.8} />
        <path d="M28 71.5 H72" stroke={p.detail} />
      </>
    ),
    shine: 'M30 46 L26 33',
  },
  k: {
    body: (
      <>
        <rect x={45} y={3} width={10} height={23} rx={3.5} />
        <rect x={38.5} y={8.5} width={23} height={9} rx={3.5} />
        <path d="M27 28 Q50 20 73 28 L65 53 L35 53 Z" />
        <rect x={31} y={49} width={38} height={9} rx={4.5} />
        <path d="M38 57 C38 63.5 33 68.5 28 72 L72 72 C67 68.5 62 63.5 62 57 Z" />
        {base()}
      </>
    ),
    details: p => (
      <>
        <path d="M30 31.5 Q50 25 70 31.5" stroke={p.detail} />
        <path d="M32 49.5 H68" stroke={p.detail} />
        <path d="M32 57.5 H68" stroke={p.detail} />
        <circle cx={50} cy={40} r={4} fill={p.gem} stroke={p.outline} strokeWidth={1.8} />
        <path d="M28 71.5 H72" stroke={p.detail} />
      </>
    ),
    shine: 'M33 35 L37 47',
  },
};

const NAMES: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

interface ChessPieceProps {
  type: PieceType;
  color: PieceColor;
  /** Width and height: pixels, or any CSS length ('100%'). Default 48. */
  size?: number | string;
  /** A soft shadow under the piece. Default true. */
  shadow?: boolean;
  /** Read out the piece's name ("white knight"). Off by default: the board square carries the label. */
  labelled?: boolean;
  className?: string;
}

/** One chess piece as an SVG. */
export function ChessPiece({ type, color, size = 48, shadow = true, labelled = false, className }: ChessPieceProps) {
  const gid = `cp${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const p = PALETTE[color];
  const d = DRAWINGS[type];
  const label = `${color === 'w' ? 'white' : 'black'} ${NAMES[type]}`;
  return (
    <svg
      viewBox="0 0 100 100" width={size} height={size} className={className}
      role={labelled ? 'img' : undefined} aria-label={labelled ? label : undefined} aria-hidden={labelled ? undefined : true}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gid} x1="0.2" y1="0" x2="0.55" y2="1">
          <stop offset="0" stopColor={p.top} />
          <stop offset="1" stopColor={p.bottom} />
        </linearGradient>
      </defs>
      {shadow && <ellipse cx={50} cy={91.5} rx={27} ry={3.5} fill="rgba(20, 6, 40, 0.22)" />}
      {p.rim && <g fill={p.rim} stroke={p.rim} strokeWidth={OUT * 2 + 2.2} strokeLinejoin="round" strokeLinecap="round">{d.body}</g>}
      <g fill={p.outline} stroke={p.outline} strokeWidth={OUT * 2} strokeLinejoin="round" strokeLinecap="round">{d.body}</g>
      <g fill={`url(#${gid})`}>{d.body}</g>
      <g fill="none" stroke={p.detail} strokeWidth={LINE} strokeLinecap="round" strokeLinejoin="round">{d.details?.(p)}</g>
      <path d={d.shine} fill="none" stroke={p.shine} strokeOpacity={p.shineOpacity} strokeWidth={3.6} strokeLinecap="round" />
    </svg>
  );
}

export default ChessPiece;
