// The chess ideas the puzzles teach, in kid words (shown after a puzzle and as hints).
// Standard chess terms; the short explanations are checked against how the ideas are usually taught.

export type PuzzleTheme =
  | 'mateIn1' | 'mateIn2' | 'backRankMate' | 'fork' | 'hangingPiece' | 'pin' | 'skewer' | 'discoveredAttack' | 'promotion';

export const PUZZLE_THEMES: Record<PuzzleTheme, { name: string; emoji: string; tip: string }> = {
  mateIn1: { name: 'Mate in 1', emoji: '👑', tip: 'Find the one move that checkmates the king!' },
  mateIn2: { name: 'Mate in 2', emoji: '👑', tip: 'Two moves to checkmate — the first move sets the trap.' },
  backRankMate: { name: 'Back-row mate', emoji: '🧱', tip: "The king is stuck behind its own pawns — a rook or queen on the back row wins!" },
  fork: { name: 'Fork', emoji: '🍴', tip: 'One piece attacks two things at once — they can’t both get away.' },
  hangingPiece: { name: 'Free piece', emoji: '🎁', tip: 'Something isn’t protected — you can take it for free!' },
  pin: { name: 'Pin', emoji: '📌', tip: 'A piece can’t move without leaving something more valuable behind it open to attack.' },
  skewer: { name: 'Skewer', emoji: '🍢', tip: 'Attack a big piece — when it moves away, take the piece behind it.' },
  discoveredAttack: { name: 'Surprise attack', emoji: '🎭', tip: 'Move one piece out of the way to uncover an attack from the piece behind it.' },
  promotion: { name: 'Promotion', emoji: '⬆️', tip: 'Get a pawn to the last row and it turns into a queen (or any piece you like)!' },
};

/** Order used to pick a puzzle's main idea when Lichess tags several. */
export const THEME_PRIORITY: PuzzleTheme[] = ['mateIn1', 'mateIn2', 'backRankMate', 'promotion', 'fork', 'skewer', 'pin', 'discoveredAttack', 'hangingPiece'];
