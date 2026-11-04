// 🤖 Robo Quest levels — 30 original levels in 3 worlds. Level ids are saved in progress
// (robo_stars, robo_code): never rename one. Every level has a reference solution whose size is
// the ⭐⭐⭐ target; data/roboLevels.test.ts checks each one docks, and that no shorter program
// exists as far as the exhaustive search can look (world 1: always; worlds 2–3: up to 5 / 4 blocks).
// Grids: '#' wall, ' ' nothing, '.' path, 'S' start, 'G' dock 🔋, '*' battery ⚡. dir: 0 up, 1 right, 2 down, 3 left.
import type { BlockKind, Program, RoboLevelDef, SensorDir, Stmt } from '../components/games/roboLogic';

const F: Stmt = { t: 'forward' };
const L: Stmt = { t: 'left' };
const R: Stmt = { t: 'right' };
const rep = (n: number, ...body: Stmt[]): Stmt => ({ t: 'repeat', n, body });
const until = (...body: Stmt[]): Stmt => ({ t: 'until', body });
const when = (dir: SensorDir, ...body: Stmt[]): Stmt => ({ t: 'if', dir, body });
const either = (dir: SensorDir, body: Stmt[], other: Stmt[]): Stmt => ({ t: 'if', dir, body, else: other });

const MOVES: BlockKind[] = ['forward', 'left', 'right'];
const LOOPS: BlockKind[] = [...MOVES, 'repeat'];
const ALL: BlockKind[] = [...LOOPS, 'until', 'if', 'ifelse'];

/** Follow a winding tunnel: forward while you can, else turn towards the open side. */
const SNAKE: Program = [until(either('ahead', [F], [either('left', [L], [R])]))];
/** The wall trick: keep your right hand on the wall. */
const WALL: Program = [until(when('right', R), either('ahead', [F], [L]))];

export const WORLDS = [
  { world: 1, name: 'Garden', emoji: '🌻', wall: '🌳', colour: '#16a34a', intro: 'Forward and turns' },
  { world: 2, name: 'Factory', emoji: '🏭', wall: '📦', colour: '#ea580c', intro: 'Repeat loops' },
  { world: 3, name: 'Space', emoji: '🚀', wall: '🪨', colour: '#7c3aed', intro: 'Sensors: if and until' },
] as const;

export const ROBO_LEVELS: RoboLevelDef[] = [
  // 🌻 Garden — forward, turn left, turn right
  { id: 'g01', world: 1, n: 1, title: 'Hello, Robo!', dir: 1, blocks: MOVES, target: 3, solution: [F, F, F],
    hint: 'Tap ⬆️ forward three times, then press ▶ Run.',
    grid: ['######', '#S..G#', '######'] },
  { id: 'g02', world: 1, n: 2, title: 'Round the corner', dir: 1, blocks: MOVES, target: 4, solution: [F, R, F, F],
    hint: 'Go forward, then turn right ↪️ at the corner.',
    grid: ['####', '#S.#', '##.#', ' #G#', ' ###'] },
  { id: 'g03', world: 1, n: 3, title: 'Left turn', dir: 1, blocks: MOVES, target: 4, solution: [F, L, F, F],
    hint: 'This time the path bends to the left ↩️.',
    grid: [' ###', ' #G#', '##.#', '#S.#', '####'] },
  { id: 'g04', world: 1, n: 4, title: 'Battery snack', dir: 1, blocks: MOVES, target: 3, solution: [F, F, F],
    hint: 'Roll over the ⚡ battery — the robot picks it up all by itself.',
    grid: ['######', '#S*.G#', '######'] },
  { id: 'g05', world: 1, n: 5, title: 'Zigzag', dir: 1, blocks: MOVES, target: 7, solution: [F, R, F, L, F, R, F],
    hint: 'Right, left, right… follow the zigzag one square at a time.',
    grid: ['####', '#S.##', '##..#', ' ##G#', '  ###'] },
  { id: 'g06', world: 1, n: 6, title: 'U-turn', dir: 1, blocks: MOVES, target: 8, solution: [F, F, R, F, F, R, F, F],
    hint: 'Two right turns make a U-turn.',
    grid: ['#####', '#S..#', '###.#', '#G..#', '#####'] },
  { id: 'g07', world: 1, n: 7, title: 'Up and over', dir: 0, blocks: MOVES, target: 6, solution: [F, R, F, F, R, F],
    hint: 'The robot is facing up. Go up, across the top, then down to the dock.',
    grid: ['#####', '#.*.#', '#S#G#', '#####'] },
  { id: 'g08', world: 1, n: 8, title: 'Wrong way round', dir: 1, blocks: MOVES, target: 5, solution: [L, L, F, F, F],
    hint: 'The robot is facing the wrong way — two turns spin it right round.',
    grid: ['######', '#G..S#', '######'] },
  { id: 'g09', world: 1, n: 9, title: 'Two batteries', dir: 0, blocks: MOVES, target: 8, solution: [F, F, R, F, F, R, F, F],
    hint: 'Grab both ⚡ before you go to the dock.',
    grid: ['#####', '#*.*#', '#.#.#', '#S#G#', '#####'] },
  { id: 'g10', world: 1, n: 10, title: 'Garden maze', dir: 1, blocks: MOVES, target: 10, solution: [F, R, F, F, L, F, F, L, F, F],
    hint: 'One corner at a time. Press 👣 Step to watch each move.',
    grid: ['######', '#S.#G#', '##.#.#', ' #*..#', ' #####'] },

  // 🏭 Factory — adds 🔁 repeat
  { id: 'f11', world: 2, n: 1, title: 'Loop it!', dir: 1, blocks: LOOPS, target: 2, solution: [rep(7, F)],
    hint: 'Put ⬆️ forward inside 🔁 repeat, then pick how many times.',
    grid: ['##########', '#S......G#', '##########'] },
  { id: 'f12', world: 2, n: 2, title: 'Loop the corner', dir: 1, blocks: LOOPS, target: 4, solution: [rep(2, rep(5, F), R)],
    hint: 'Long, turn, long… can one loop do the straight part AND the turn?',
    grid: ['########', '#S.....#', '######.#', '     #.#', '     #.#', '     #G#', '     ###'] },
  { id: 'f13', world: 2, n: 3, title: 'Staircase', dir: 1, blocks: LOOPS, target: 5, solution: [rep(4, F, R, F, L)],
    hint: 'Every step is the same: forward, right, forward, left.',
    grid: ['####', '#S.##', '##..##', ' ##..##', '  ##.G#', '   ####'] },
  { id: 'f14', world: 2, n: 4, title: 'Square dance', dir: 0, blocks: LOOPS, target: 4, solution: [rep(4, rep(3, F), R)],
    hint: 'Three forward and a right turn… four times round!',
    grid: ['######', '#*..*#', '#.##.#', '#.##.#', '#SG.*#', '######'] },
  { id: 'f15', world: 2, n: 5, title: 'The long way', dir: 1, blocks: LOOPS, target: 7, solution: [rep(2, rep(6, F), R, F, F, R)],
    hint: 'The way there and the way back look the same — loop the whole trip.',
    grid: ['#########', '#S......#', '#######.#', '#G......#', '#########'] },
  { id: 'f16', world: 2, n: 6, title: 'Spiral', dir: 1, blocks: LOOPS, target: 8, solution: [rep(3, rep(4, F), R), rep(2, rep(2, F), R)],
    hint: 'Three long sides first, then the short ones in the middle.',
    grid: ['#######', '#S....#', '#####.#', '#..G#.#', '#.###.#', '#.....#', '#######'] },
  { id: 'f17', world: 2, n: 7, title: 'Big steps', dir: 1, blocks: LOOPS, target: 7, solution: [rep(3, rep(2, F), L, rep(2, F), R)],
    hint: 'Each big step: two forward, turn left, two forward, turn right.',
    grid: ['      ###', '      #G#', '    ###.#', '    #*..#', '  ###.###', '  #*..#', '###.###', '#S..#', '#####'] },
  { id: 'f18', world: 2, n: 8, title: 'Down the stairs', dir: 2, blocks: LOOPS, target: 5, solution: [rep(5, F, R, F, L)],
    hint: 'The robot is facing down. Find the pattern and loop it.',
    grid: ['    ###', '   ##S#', '  ##*.#', ' ##*.##', '##*.##', '#*.##', '#G##', '###'] },
  { id: 'f19', world: 2, n: 9, title: 'Round the block', dir: 1, blocks: LOOPS, target: 7, solution: [rep(2, rep(6, F), R, rep(2, F), R)],
    hint: 'A long side, a short side… and again. Loops can go inside loops!',
    grid: ['#########', '#S.....*#', '#G#####.#', '#*.....*#', '#########'] },
  { id: 'f20', world: 2, n: 10, title: 'Factory finale', dir: 1, blocks: LOOPS, target: 8, solution: [rep(2, rep(2, F, R, F, L), F, F)],
    hint: 'Two little steps, then a flat bit — and the whole thing twice.',
    grid: ['####', '#S.##', '##..####', ' ##..*.##', '  ####..###', '     ##..G#', '      #####'] },

  // 🚀 Space — adds 🔁 repeat until 🔋 and ❓ if (path ahead / left / right)
  { id: 's21', world: 3, n: 1, title: 'Until you dock', dir: 1, blocks: [...LOOPS, 'until'], target: 2, solution: [until(F)],
    hint: '🔁 repeat until 🔋 keeps going until the robot is home — no counting needed!',
    grid: ['############', '#S........G#', '############'] },
  { id: 's22', world: 3, n: 2, title: 'Corner sensor', dir: 1, blocks: [...MOVES, 'until', 'if'], target: 4, solution: [until(F, when('right', R))],
    hint: 'Move forward — and IF there is a path to the right, turn right.',
    grid: ['#########', '#S......#', '#######.#', '  #..G#.#', '  #.###.#', '  #.....#', '  #######'] },
  { id: 's23', world: 3, n: 3, title: 'Both ways', dir: 1, blocks: [...MOVES, 'until', 'if'], target: 6, solution: [until(when('left', L), when('right', R), F)],
    hint: 'Check the left, check the right, then go forward.',
    grid: ['   ######', '   #....#', '####.##.####', '#S...##...G#', '############'] },
  { id: 's24', world: 3, n: 4, title: 'If or else', dir: 0, blocks: [...MOVES, 'until', 'ifelse'], target: 4, solution: [until(either('ahead', [F], [L]))],
    hint: 'IF the path ahead is clear, go forward — ELSE turn left.',
    grid: ['#######', '#.....#', '#.###.#', '#.#G#.#', '#.#.#.#', '#...#.#', '#####S#', '    ###'] },
  { id: 's25', world: 3, n: 5, title: 'Battery zigzag', dir: 1, blocks: ALL, target: 6, solution: SNAKE,
    hint: 'When the way ahead is blocked, look left — else turn right. An if / else can go inside another one!',
    grid: ['#########', '#S..#...#', '###.#*#.#', '  #*#.#*#', '  #...#G#', '  #######'] },
  { id: 's26', world: 3, n: 6, title: 'Long tunnel', dir: 2, blocks: ALL, target: 6, solution: SNAKE,
    hint: 'The same sensor program works on any winding tunnel.',
    grid: ['#######', '#S#*..#', '#.#.#.#', '#.#.#.#', '#*#.#.###', '#...#*.G#', '#########'] },
  { id: 's27', world: 3, n: 7, title: 'Space station', dir: 1, blocks: ALL, target: 6, solution: SNAKE,
    hint: 'A long trip — let the sensors do the steering.',
    grid: ['########', '#S....*#', '######.#', '   ###.#', '   #*..#', '   #.####', '   #...*#', '   ####.#', '      #.#', '      #.#', '      #G#', '      ###'] },
  { id: 's28', world: 3, n: 8, title: 'Dead end!', dir: 1, blocks: ALL, target: 6, solution: WALL,
    hint: 'The wall trick: IF there is a path on the right, turn right. Then go forward if you can, else turn left.',
    grid: ['#######', '#S...G#', '###.###', '###*###', '#######'] },
  { id: 's29', world: 3, n: 9, title: 'Little maze', dir: 2, blocks: ALL, target: 6, solution: WALL,
    hint: 'Keep your right hand on the wall and you will visit every corner.',
    grid: ['#######', '#S..#*#', '#.#.#.#', '#.#...#', '#*#.#.#', '#...#G#', '#######'] },
  { id: 's30', world: 3, n: 10, title: "Robo's big day", dir: 1, blocks: ALL, target: 6, solution: WALL,
    hint: 'Use the wall trick to explore every corridor and grab all three ⚡.',
    grid: ['#########', '#S..#...#', '#.#.#.#.#', '#.#...#*#', '#.#####.#', '#*..#...#', '###.#.###', '#*..#..G#', '#########'] },
];

export const roboLevel = (id: string) => ROBO_LEVELS.find(l => l.id === id);
