// Word Ladder data: puzzles + the dictionary of words a player may use.
// Every puzzle is checked by src/data/wordLadder.test.ts (solvable, and `steps` is the true shortest path).

export interface LadderPuzzle {
  start: string;
  end: string;
  /** Fewest letter changes needed to get from start to end (the BFS shortest path). */
  steps: number;
}

// Valid words (all lowercase, 3 or 4 letters)
export const VALID_WORDS: ReadonlySet<string> = new Set([
  // 3-letter words
  'cat','bat','hat','mat','rat','sat','fat','pat','tap','top','tip','tin','tan','ran',
  'run','sun','fun','bun','bud','bad','bag','ban','bay','bee','bed','big','bit',
  'box','boy','bug','bus','but','cab','can','cap','car','cob','cod','cog','cop','cot',
  'cow','cry','cub','cup','cut','dab','dam','dip','dog','dot','dry','dug','dye','ear',
  'eat','egg','elf','elk','elm','end','era','eve','ewe','eye','fad','fan','far','fig',
  'fit','fix','fly','fog','for','fox','fry','gap','gas','get','got','gum',
  'gut','guy','ham','has','hay','hen','her','hid','him','hip','his','hit','hob','hog',
  'hop','hot','how','hub','hug','hum','hut','ice','ill','imp','ink','inn','ion','ivy',
  'jab','jag','jam','jar','jaw','jay','jet','jig','job','jog','jot','joy','jug','jut',
  'keg','key','kid','kin','kit','lab','lad','lag','lap','law','lay','led','leg','let',
  'lid','lip','lit','log','lot','low','lug','map','may','men','met','mid','mix','mob',
  'mod','mom','mop','mud','mug','nab','nag','nap','net','nip','nit','nod','nor',
  'not','now','nun','nut','oak','oar','oat','odd','off','oil','old','one','opt','orb',
  'ore','our','out','own','pad','pal','pan','paw','pay','peg','pen','pet','pie','pig',
  'pin','pit','pod','pop','pot','pow','pro','pun','pup','put','rag','ram','rap',
  'raw','ray','red','ref','rep','rib','rid','rig','rim','rip','rob','rod','rot','row',
  'rub','rug','rut','rye','sag','sap','saw','say','sea','set','sew','shy','sip','sir',
  'sit','six','ski','sky','sly','sob','sod','son','sow','soy','spa','spy','sub',
  'sum','tab','tag','tar','tax','tea','ten','the','tie','tom','too','tot','tow',
  'toy','try','tub','tug','two','urn','use','van','vat','via','vow','wag',
  'was','way','web','wed','wet','who','why','wig','win','wit','woe','wok','won','woo',
  'wow','yak','yam','yap','yes','yet','yew','yip','you','zag','zap','zen',
  'zig','zip','zoo','due','hue','sue',
  // 4-letter words
  'star','song','band','beat','love','dare','pink','blue','gold','bold','cool','fire',
  'jump','kick','wild','glow','sing','spin','show','fame','wave','fans','care','fare','hare','mare',
  'pare','rare','bare','ware','barn','born','burn','corn','earn','fern','firm','form','fork','harm',
  'horn','lore','more','norm','port','sort','torn','wore','yarn','cake','fake','lake','make','rake',
  'sake','take','wake','bake','bike','hike','like','pike','time','lime','mime','dime','game','came',
  'dame','name','same','tame','bone','cone','done','gone','lone','none','tone','zone','hone',
  'tune','dune','rune','cute','mute','lute','clue','glue','true','scar','scan','live','line','lane',
  'cane','mane','cold','cord','card','ward','warm','word','lose','lost','list','mist','most','post',
  'past','fast','last','cast','vast','mast','cost','host','nose','rose','hose','pose','note','vote',
  'kite','bite','site','mine','fine','nine','pine','dine','hold','fold','told','sold','mold','bolt',
  'boat','coat','goat','moat','road','load','toad','seat','heat','meat','neat','feat','hire','wire',
  'tire','hide','ride','side','wide','tide','tile','mile','pile','file','mole','hole','pole','role',
  'sole','cart','part','dart','tart','ring','king','wing','long','lung','sung','rung','hung',
  'hand','land','sand','wand','bend','lend','mend','send','tend','pond','fond','bond','stop','step',
  'stem','shop','ship','chip','chop','chin','coin','lord','ford','pork','cork','work','worn','worm',
  'bird','bind','kind','mind','find','wind','mild',
]);

export const PUZZLES: LadderPuzzle[] = [
  { start: 'cat', end: 'dog', steps: 3 },   // cat → cot → dot → dog
  { start: 'hot', end: 'fog', steps: 2 },   // hot → hog → fog
  { start: 'fan', end: 'sun', steps: 2 },   // fan → fun → sun
  { start: 'hat', end: 'bug', steps: 3 },   // hat → bat → but → bug
  { start: 'pin', end: 'log', steps: 4 },   // pin → pen → peg → leg → log
  { start: 'cake', end: 'bike', steps: 2 }, // cake → bake → bike
  { start: 'star', end: 'scan', steps: 2 }, // star → scar → scan
  { start: 'love', end: 'line', steps: 2 }, // love → live → line
  { start: 'cold', end: 'warm', steps: 4 }, // cold → cord → word → ward → warm
  { start: 'pig', end: 'hen', steps: 3 },   // pig → peg → pen → hen
  { start: 'cow', end: 'pig', steps: 4 },   // cow → cog → fog → fig → pig
  { start: 'rose', end: 'pine', steps: 4 }, // rose → lose → lone → line → pine
  { start: 'gold', end: 'coin', steps: 4 }, // gold → cold → cord → corn → coin
  { start: 'note', end: 'song', steps: 4 }, // note → none → lone → long → song
  { start: 'cup', end: 'tea', steps: 5 },   // cup → cap → tap → tan → ten → tea
  { start: 'mud', end: 'pie', steps: 5 },   // mud → bud → bun → pun → pin → pie
  { start: 'lake', end: 'pond', steps: 5 }, // lake → lane → lone → bone → bond → pond
];

/** "cat → ? → ? → dog": one "?" for every in-between word in the shortest ladder. */
export function ladderHint(p: LadderPuzzle): string {
  return [p.start, ...Array(Math.max(0, p.steps - 1)).fill('?'), p.end].join(' → ');
}

export function differsBy1(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diffs = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs++;
    if (diffs > 1) return false;
  }
  return diffs === 1;
}

/** One shortest ladder from `start` to `end` (start and end included), or null when there's none. */
export function shortestLadder(start: string, end: string): string[] | null {
  const words = [...VALID_WORDS].filter(w => w.length === start.length);
  const prev = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const w = queue.shift()!;
    if (w === end) break;
    for (const next of words) {
      if (!prev.has(next) && differsBy1(w, next)) {
        prev.set(next, w);
        queue.push(next);
      }
    }
  }
  if (!prev.has(end)) return null;
  const path: string[] = [];
  for (let w: string | null = end; w; w = prev.get(w) ?? null) path.unshift(w);
  return path;
}

export type StepProblem = 'length' | 'used' | 'notOneLetter' | 'unknown';

/** Why `word` can't be the next rung (or null when it can). */
export function checkStep(chain: string[], word: string, p: LadderPuzzle): StepProblem | null {
  if (word.length !== p.start.length) return 'length';
  if (chain.includes(word)) return 'used';
  if (!differsBy1(chain[chain.length - 1], word)) return 'notOneLetter';
  if (!VALID_WORDS.has(word)) return 'unknown';
  return null;
}

/** Kind messages for each problem. */
export const STEP_MESSAGES: Record<StepProblem, (p: LadderPuzzle) => string> = {
  length: p => `Use ${p.start.length} letters 🙂`,
  used: () => 'You already used that word — try a new one!',
  notOneLetter: () => 'Change exactly one letter 🔁',
  unknown: () => "Hmm, that word isn't in our list — try another!",
};

export const HINT_COST = 15;
/** 100 for the shortest ladder, 10 off for every extra step and 15 per hint — never below 10. */
export function ladderScore(p: LadderPuzzle, stepsUsed: number, hints: number): number {
  return Math.max(10, 100 - 10 * Math.max(0, stepsUsed - p.steps) - HINT_COST * hints);
}
