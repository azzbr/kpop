// Connect 4 rules (pure). The board is a flat array, row 0 at the top: 0 empty, 1 red, 2 yellow.
export const C4_ROWS = 6;
export const C4_COLS = 7;

export const emptyBoard = (): number[] => Array(C4_ROWS * C4_COLS).fill(0);

/** Drops a disc into a column. ok = false when the column is full or out of range. */
export function applyDrop(board: number[], col: number, disc: number): { board: number[]; ok: boolean } {
  if (!Number.isInteger(col) || col < 0 || col >= C4_COLS) return { board, ok: false };
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (board[r * C4_COLS + col] === 0) {
      const nb = [...board];
      nb[r * C4_COLS + col] = disc;
      return { board: nb, ok: true };
    }
  }
  return { board, ok: false };
}

/** The four cells of a winning line for this disc, or null. */
export function findWin(board: number[], disc: number): number[] | null {
  const at = (r: number, c: number) => (r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLS ? board[r * C4_COLS + c] : -1);
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      if (at(r, c) !== disc) continue;
      for (const [dr, dc] of dirs) {
        const line = [r * C4_COLS + c];
        let rr = r + dr;
        let cc = c + dc;
        while (at(rr, cc) === disc && line.length < 4) {
          line.push(rr * C4_COLS + cc);
          rr += dr;
          cc += dc;
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

export interface C4Result { board: number[]; winner: number; winLine: number[]; turn: number }

/** One move: 0 winner = still playing, 1/2 = that disc won, 3 = draw (board full). null = illegal. */
export function playMove(board: number[], col: number, disc: number): C4Result | null {
  const res = applyDrop(board, col, disc);
  if (!res.ok) return null;
  const line = findWin(res.board, disc);
  if (line) return { board: res.board, winner: disc, winLine: line, turn: disc };
  if (res.board.every((x) => x !== 0)) return { board: res.board, winner: 3, winLine: [], turn: disc };
  return { board: res.board, winner: 0, winLine: [], turn: disc === 1 ? 2 : 1 };
}
