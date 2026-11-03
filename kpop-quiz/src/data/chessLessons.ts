// Chess Academy "Learn" lessons: one per piece (star hunts) and Check & Checkmate.
// All levels are original. Star-hunt targets are the optimal move counts (checked against
// bfsMinMoves in chessLessons.test.ts); check positions are checked with chess.js.
// Ids are saved as progress — never rename them.
import type { ChessLesson, ChessLessonLevel } from '../components/games/chessLessonLogic';

export const CHESS_LESSONS: ChessLesson[] = [
  {
    id: 'rook',
    piece: 'r',
    emoji: '♜',
    title: 'The Rook',
    intro: 'The rook slides in straight lines — up, down or sideways — as far as it likes. It can’t jump over anything, so a pawn in the way blocks its path.',
    levels: [
      { kind: 'stars', id: 'rook_1', title: 'Straight lines', piece: 'r', start: 'a1', stars: ['a6', 'f6'], target: 2 },
      { kind: 'stars', id: 'rook_2', title: 'Round the corners', piece: 'r', start: 'd1', stars: ['d5', 'b5', 'b8', 'g8'], target: 4 },
      {
        kind: 'stars', id: 'rook_3', title: 'Pawns in the way', piece: 'r', start: 'a2', stars: ['h2', 'e6', 'h7'],
        blockers: ['d2', 'a5', 'e4'], target: 6,
        tip: 'Your pawns block the rook — find a way round them!',
      },
    ],
  },
  {
    id: 'bishop',
    piece: 'b',
    emoji: '♝',
    title: 'The Bishop',
    intro: 'The bishop slides diagonally as far as it likes, so it always stays on squares of one colour. It can’t jump over anything in its way.',
    levels: [
      { kind: 'stars', id: 'bishop_1', title: 'Diagonal dash', piece: 'b', start: 'c1', stars: ['f4', 'h6'], target: 2 },
      { kind: 'stars', id: 'bishop_2', title: 'Diamond trip', piece: 'b', start: 'f1', stars: ['b5', 'e8', 'h5', 'd1'], target: 4 },
      {
        kind: 'stars', id: 'bishop_3', title: 'Find a way round', piece: 'b', start: 'c1', stars: ['a3', 'h6', 'f8'],
        blockers: ['b2', 'e3'], target: 5,
        tip: 'Both quick diagonals are blocked — zig-zag round your pawns.',
      },
    ],
  },
  {
    id: 'queen',
    piece: 'q',
    emoji: '♛',
    title: 'The Queen',
    intro: 'The queen is the most powerful piece: she slides as far as she likes in straight lines and diagonals, like a rook and a bishop rolled into one!',
    levels: [
      { kind: 'stars', id: 'queen_1', title: 'Both ways', piece: 'q', start: 'd1', stars: ['d6', 'h2'], target: 2 },
      { kind: 'stars', id: 'queen_2', title: 'Corner to corner', piece: 'q', start: 'a1', stars: ['h8', 'h1', 'c6', 'a4'], target: 4 },
      {
        kind: 'stars', id: 'queen_3', title: 'Queen’s maze', piece: 'q', start: 'd4', stars: ['h8', 'a1', 'h4', 'd8'],
        blockers: ['f6', 'b2', 'f4', 'd6'], target: 6,
        tip: 'Every star is behind a pawn. Which order is quickest?',
      },
    ],
  },
  {
    id: 'king',
    piece: 'k',
    emoji: '♚',
    title: 'The King',
    intro: 'The king steps just one square at a time, in any direction — up, down, sideways or diagonally. Slow and steady, but the most important piece of all!',
    levels: [
      { kind: 'stars', id: 'king_1', title: 'One step at a time', piece: 'k', start: 'e1', stars: ['e3', 'f4'], target: 3 },
      {
        kind: 'stars', id: 'king_2', title: 'Over the hill', piece: 'k', start: 'b1', stars: ['d3', 'f1'], target: 4,
        tip: 'Diagonal steps are a shortcut!',
      },
      {
        kind: 'stars', id: 'king_3', title: 'Walk round the wall', piece: 'k', start: 'e1', stars: ['e5'],
        blockers: ['c3', 'd3', 'e3', 'f3', 'g3'], target: 6,
        tip: 'The king can’t climb over the wall — head for the gap.',
      },
    ],
  },
  {
    id: 'knight',
    piece: 'n',
    emoji: '♞',
    title: 'The Knight',
    intro: 'The knight jumps in an L shape: two squares in a straight line, then one square to the side. It’s the only piece that can jump over other pieces!',
    levels: [
      { kind: 'stars', id: 'knight_1', title: 'First hops', piece: 'n', start: 'b1', stars: ['c3', 'e4'], target: 2 },
      { kind: 'stars', id: 'knight_2', title: 'Hop, hop, hop', piece: 'n', start: 'g1', stars: ['f3', 'd4', 'e6'], target: 3 },
      {
        kind: 'stars', id: 'knight_3', title: 'Jump the fence', piece: 'n', start: 'e4', stars: ['e5', 'c6'],
        blockers: ['d3', 'e3', 'f3', 'd4', 'f4', 'd5', 'f5'], target: 4,
        tip: 'Jump right over your pawns. The star next door is the trickiest one!',
      },
    ],
  },
  {
    id: 'pawn',
    piece: 'p',
    emoji: '♟',
    title: 'The Pawn',
    intro: 'The pawn marches forward one square at a time, or two squares when it’s still on its starting row. If it reaches the far side of the board it’s promoted — here it turns into a queen!',
    levels: [
      {
        kind: 'stars', id: 'pawn_1', title: 'Big first step', piece: 'p', start: 'e2', stars: ['e4'], target: 1,
        tip: 'From its starting row a pawn can move two squares.',
      },
      { kind: 'stars', id: 'pawn_2', title: 'One at a time', piece: 'p', start: 'c2', stars: ['c4', 'c7'], target: 4 },
      {
        kind: 'stars', id: 'pawn_3', title: 'Become a queen!', piece: 'p', start: 'd5', stars: ['d7', 'a5'], target: 4,
        tip: 'March to the far side, then your new queen can grab the last star.',
      },
    ],
  },
  {
    id: 'check',
    piece: 'k',
    emoji: '👑',
    title: 'Check & Checkmate',
    intro: 'Check means a king is being attacked, and it must get out of danger straight away. Checkmate is when the king is in check and can’t escape — that wins the game!',
    levels: [
      {
        kind: 'check', id: 'check_1', title: 'Give check', goal: 'check',
        fen: '4k3/8/8/8/8/8/8/R5K1 w - - 0 1',
        tip: 'Move your rook so it attacks the black king. That’s check!',
      },
      {
        kind: 'check', id: 'check_2', title: 'Checkmate in 1', goal: 'mate',
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        tip: 'The black king is stuck behind its own pawns. Find the move that checks it with no way out!',
      },
      {
        kind: 'check', id: 'check_3', title: 'Escape check', goal: 'escape',
        fen: '4r1k1/5ppp/8/8/8/8/5PPP/2B1K3 w - - 0 1',
        tip: 'Your king is in check! Step it to a safe square, or put a piece in the way.',
      },
    ],
  },
];

/** Every level of every lesson, in order. */
export const CHESS_LESSON_LEVELS: ChessLessonLevel[] = CHESS_LESSONS.flatMap(l => l.levels);
