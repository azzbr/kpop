// Battleship rules (pure). A 7×7 grid, cells numbered row * N + col.
export const BS_N = 7;
export const BS_SHIPS = [4, 3, 2, 2];

export interface Ship { cells: number[]; hits: number[] }

/** A random fleet with no overlaps. `rand` returns [0, 1). */
export function randomFleet(rand: () => number = Math.random): number[][] {
  const N = BS_N;
  for (let attempt = 0; attempt < 50; attempt++) {
    const occupied = new Set<number>();
    const ships: number[][] = [];
    for (const size of BS_SHIPS) {
      for (let guard = 0; guard < 400; guard++) {
        const horiz = rand() < 0.5;
        const r = Math.floor(rand() * (horiz ? N : N - size + 1));
        const c = Math.floor(rand() * (horiz ? N - size + 1 : N));
        const cells = Array.from({ length: size }, (_, k) => (horiz ? r * N + c + k : (r + k) * N + c));
        if (cells.every((x) => !occupied.has(x))) {
          cells.forEach((x) => occupied.add(x));
          ships.push(cells);
          break;
        }
      }
    }
    if (ships.length === BS_SHIPS.length) return ships;
  }
  return [[0, 1, 2, 3], [14, 15, 16], [28, 29], [42, 43]];
}

/** A fleet sent by a player is valid: right ship sizes, straight lines, in the grid, no overlaps. */
export function validFleet(ships: unknown): ships is number[][] {
  if (!Array.isArray(ships) || ships.length !== BS_SHIPS.length) return false;
  const sizes = ships.map((s) => (Array.isArray(s) ? s.length : -1)).sort((a, b) => b - a);
  const want = [...BS_SHIPS].sort((a, b) => b - a);
  if (sizes.some((s, i) => s !== want[i])) return false;
  const seen = new Set<number>();
  for (const s of ships as unknown[][]) {
    if (!s.every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < BS_N * BS_N)) return false;
    const cells = [...(s as number[])].sort((a, b) => a - b);
    const horiz = cells.every((x, i) => i === 0 || (x === cells[i - 1] + 1 && Math.floor(x / BS_N) === Math.floor(cells[0] / BS_N)));
    const vert = cells.every((x, i) => i === 0 || x === cells[i - 1] + BS_N);
    if (!horiz && !vert) return false;
    for (const x of cells) {
      if (seen.has(x)) return false;
      seen.add(x);
    }
  }
  return true;
}

/** Fires at a fleet. Returns hit / sunk / allSunk, or null if that cell was already tried. */
export function fireAt(fleet: Ship[], shots: Map<number, boolean>, cell: number): { hit: boolean; sunk: boolean; allSunk: boolean } | null {
  if (shots.has(cell) || !Number.isInteger(cell) || cell < 0 || cell >= BS_N * BS_N) return null;
  let hit = false;
  let sunk = false;
  for (const s of fleet) {
    if (s.cells.includes(cell)) {
      hit = true;
      s.hits.push(cell);
      sunk = s.hits.length === s.cells.length;
      break;
    }
  }
  shots.set(cell, hit);
  return { hit, sunk, allSunk: fleet.every((s) => s.hits.length === s.cells.length) };
}

export const shipsLeft = (fleet: Ship[]) => fleet.filter((s) => s.hits.length < s.cells.length).length;

/**
 * What one player may see. mine: 0 water, 1 ship, 2 hit, 3 miss. enemy: 0 unknown, 2 hit,
 * 3 miss, 4 sunk ship (an enemy ship is only shown once it's sunk).
 */
export function playerView(myFleet: Ship[], shotsAtMe: Map<number, boolean>, enemyFleet: Ship[], shotsAtEnemy: Map<number, boolean>) {
  const N2 = BS_N * BS_N;
  const mine = Array(N2).fill(0);
  myFleet.forEach((s) => s.cells.forEach((c) => (mine[c] = 1)));
  shotsAtMe.forEach((hit, c) => (mine[c] = hit ? 2 : 3));
  const enemy = Array(N2).fill(0);
  shotsAtEnemy.forEach((hit, c) => (enemy[c] = hit ? 2 : 3));
  enemyFleet.forEach((s) => {
    if (s.hits.length === s.cells.length) s.cells.forEach((c) => (enemy[c] = 4));
  });
  return { mine, enemy, meLeft: shipsLeft(myFleet), enemyLeft: shipsLeft(enemyFleet) };
}
