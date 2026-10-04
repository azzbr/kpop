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
  'run','sun','gun','fun','bun','bud','bad','bag','ban','bay','bee','bed','big','bit',
  'box','boy','bug','bus','but','cab','can','cap','car','cob','cod','cog','cop','cot',
  'cow','cry','cub','cup','cut','dab','dam','dip','dog','dot','dry','dug','dye','ear',
  'eat','egg','elf','elk','elm','end','era','eve','ewe','eye','fad','fan','far','fig',
  'fit','fix','fly','fog','for','fox','fry','gap','gas','get','gob','god','got','gum',
  'gut','guy','ham','has','hay','hen','her','hid','him','hip','his','hit','hob','hog',
  'hop','hot','how','hub','hug','hum','hut','ice','ill','imp','ink','inn','ion','ivy',
  'jab','jag','jam','jar','jaw','jay','jet','jig','job','jog','jot','joy','jug','jut',
  'keg','key','kid','kin','kit','lab','lad','lag','lap','law','lay','led','leg','let',
  'lid','lip','lit','log','lot','low','lug','map','may','men','met','mid','mix','mob',
  'mod','mom','mop','mud','mug','nab','nag','nap','net','nip','nit','nob','nod','nor',
  'not','now','nun','nut','oak','oar','oat','odd','off','oil','old','one','opt','orb',
  'ore','our','out','own','pad','pal','pan','paw','pay','peg','pen','pet','pie','pig',
  'pin','pit','pod','pop','pot','pow','pro','pub','pun','pup','put','rag','ram','rap',
  'raw','ray','red','ref','rep','rib','rid','rig','rim','rip','rob','rod','rot','row',
  'rub','rug','rut','rye','sag','sap','saw','say','sea','set','sew','shy','sip','sir',
  'sit','six','ski','sky','sly','sob','sod','son','sop','sow','soy','spa','spy','sub',
  'sum','sup','tab','tag','tar','tax','tea','ten','the','tie','tom','too','tot','tow',
  'toy','try','tub','tug','two','urn','use','van','vat','via','vim','vow','wag','war',
  'was','way','web','wed','wet','who','why','wig','win','wit','woe','wok','won','woo',
  'wow','yak','yam','yap','yaw','yes','yet','yew','yip','you','yow','zag','zap','zen',
  'zig','zip','zoo','due','hue','sue',
  // 4-letter words
  'star','kpop','idol','song','band','beat','love','dare','pink','blue','gold','bold','cool','fire',
  'jump','kick','wild','glow','sing','spin','show','fame','wave','fans','care','fare','hare','mare',
  'pare','rare','bare','ware','barn','born','burn','corn','earn','fern','firm','form','fork','harm',
  'horn','lore','more','norm','port','sort','torn','wore','yarn','cake','fake','lake','make','rake',
  'sake','take','wake','bake','bike','hike','like','pike','time','lime','mime','dime','game','came',
  'dame','lame','name','same','tame','bone','cone','done','gone','lone','none','tone','zone','hone',
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
