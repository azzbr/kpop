// 🤖 Robo Quest — the Blockly side: our own blocks (Zelos renderer: big and round), the kid theme,
// the per-level flyout, tap-to-add, and converting between the workspace and a roboLogic Program.
// Blockly (Apache-2.0) only ever loads its media from /blockly-media/ (bundled, precached) —
// never from blockly.com — and its sounds are off (the game plays its own).
import * as Blockly from 'blockly/core';
import * as EnGb from 'blockly/msg/en-gb';
import type { BlockKind, Program, SensorDir, Stmt } from './roboLogic';
import { REPEAT_MAX, REPEAT_MIN } from './roboLogic';

Blockly.setLocale(EnGb as unknown as Record<string, string>);

export const START = 'robo_start';
const TYPE: Record<BlockKind, string> = {
  forward: 'robo_forward', left: 'robo_left', right: 'robo_right',
  repeat: 'robo_repeat', until: 'robo_until', if: 'robo_if', ifelse: 'robo_ifelse',
};
const CONTAINERS = new Set(['robo_repeat', 'robo_until', 'robo_if', 'robo_ifelse']);
const MOVE = '#3b82f6';
const LOOP = '#f59e0b';
const SENSE = '#a855f7';
const DIRS: [string, SensorDir][] = [['ahead ⬆️', 'ahead'], ['left ⬅️', 'left'], ['right ➡️', 'right']];
const COUNTS = Array.from({ length: REPEAT_MAX - REPEAT_MIN + 1 }, (_, i) => String(i + REPEAT_MIN)).map(n => [n, n]);

/** Zelos (big, round, Scratch-like) with taller blocks: 56 px at full size, ≥ 44 px at the
 *  phone scale of 0.8 — comfortable finger targets. */
class RoboConstants extends Blockly.zelos.ConstantProvider {
  constructor() {
    super();
    this.MIN_BLOCK_HEIGHT = 14 * this.GRID_UNIT;
  }
}
class RoboRenderer extends Blockly.zelos.Renderer {
  protected override makeConstants_() { return new RoboConstants(); }
}

let defined = false;
function defineBlocks() {
  if (defined) return;
  defined = true;
  Blockly.blockRendering.register('robo', RoboRenderer);
  Blockly.Blocks[START] = {
    init(this: Blockly.BlockSvg) {
      this.appendDummyInput().appendField('▶ When Run');
      this.setNextStatement(true);
      this.setColour('#16a34a');
      this.setDeletable(false);
      this.setTooltip('Put blocks under here — they run from top to bottom.');
      (this as unknown as { hat: string }).hat = 'cap';
    },
  };
  const stmt = { previousStatement: null, nextStatement: null };
  Blockly.defineBlocksWithJsonArray([
    { type: TYPE.forward, message0: '⬆️ forward', colour: MOVE, tooltip: 'Move one square forward.', ...stmt },
    { type: TYPE.left, message0: '↩️ turn left', colour: MOVE, tooltip: 'Turn a quarter turn to the left.', ...stmt },
    { type: TYPE.right, message0: '↪️ turn right', colour: MOVE, tooltip: 'Turn a quarter turn to the right.', ...stmt },
    {
      type: TYPE.repeat, message0: '🔁 repeat %1 times', args0: [{ type: 'field_dropdown', name: 'N', options: COUNTS }],
      message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], colour: LOOP, tooltip: 'Do the blocks inside again and again.', ...stmt,
    },
    {
      type: TYPE.until, message0: '🔁 repeat until 🔋', message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }],
      colour: LOOP, tooltip: 'Keep doing the blocks inside until the robot is home.', ...stmt,
    },
    {
      type: TYPE.if, message0: '❓ if path %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }],
      message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }], colour: SENSE, tooltip: 'Only if that way is clear.', ...stmt,
    },
    {
      type: TYPE.ifelse, message0: '❓ if path %1', args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRS }],
      message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }],
      message2: 'else %1', args2: [{ type: 'input_statement', name: 'ELSE' }], colour: SENSE, tooltip: 'If that way is clear do the top part, else the bottom part.', ...stmt,
    },
  ]);
}

let theme: Blockly.Theme | null = null;
function roboTheme() {
  theme ??= Blockly.Theme.defineTheme('robo', {
    name: 'robo',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#1e1b4b',
      flyoutBackgroundColour: '#312e81',
      flyoutForegroundColour: '#e0e7ff',
      flyoutOpacity: 1,
      scrollbarColour: '#a78bfa',
      scrollbarOpacity: 0.6,
      insertionMarkerColour: '#fde047',
      insertionMarkerOpacity: 0.5,
    },
    fontStyle: { family: 'Nunito, sans-serif', weight: '800', size: 15 },
  });
  return theme;
}

/** Dropdown menus above the game frame (GameShell is fixed with z-40). */
function addCss() {
  if (document.getElementById('robo-blockly-css')) return;
  const s = document.createElement('style');
  s.id = 'robo-blockly-css';
  s.textContent = '.blocklyDropDownDiv, .blocklyWidgetDiv, .blocklyTooltipDiv { z-index: 9999 !important; }'
    + ' .blocklyDropDownDiv .blocklyMenuItem { min-height: 44px; display: flex; align-items: center; font-size: 18px; }';
  document.head.appendChild(s);
}

export function toolboxFor(kinds: readonly BlockKind[]): Blockly.utils.toolbox.ToolboxInfo {
  return { kind: 'flyoutToolbox', contents: kinds.map(k => ({ kind: 'block', type: TYPE[k] })) };
}

export interface RoboWorkspace {
  ws: Blockly.WorkspaceSvg;
  dispose: () => void;
}

/** Puts a Blockly workspace in `div` with the level's blocks. `onChange` runs after every edit. */
export function createWorkspace(div: HTMLElement, kinds: readonly BlockKind[], small: boolean, onChange: () => void): RoboWorkspace {
  defineBlocks();
  addCss();
  const ws = Blockly.inject(div, {
    toolbox: toolboxFor(kinds),
    renderer: 'robo',
    theme: roboTheme(),
    media: '/blockly-media/',
    sounds: false,
    trashcan: false,
    zoom: { controls: false, wheel: false, pinch: false, startScale: small ? 0.8 : 1 },
    move: { scrollbars: true, drag: true, wheel: true },
    grid: { spacing: 40, length: 3, colour: 'rgba(255,255,255,0.08)', snap: false },
  });
  // Blocks that aren't under ▶ When Run are greyed out (and don't count).
  ws.addChangeListener(Blockly.Events.disableOrphans);
  ws.addChangeListener(e => { if (!e.isUiEvent) onChange(); });
  // Tap a block in the flyout to add it (the always-open flyout fires a click instead of making a block).
  const flyoutWs = ws.getFlyout()?.getWorkspace();
  const onFlyoutClick = (e: Blockly.Events.Abstract) => {
    if (e.type !== Blockly.Events.CLICK) return;
    const click = e as Blockly.Events.Click;
    if (click.targetType !== 'block' || !click.blockId) return;
    const src = flyoutWs?.getBlockById(click.blockId);
    if (src) tapToAdd(ws, src.type);
  };
  flyoutWs?.addChangeListener(onFlyoutClick);
  return { ws, dispose: () => { flyoutWs?.removeChangeListener(onFlyoutClick); ws.dispose(); } };
}

const startBlock = (ws: Blockly.Workspace) => ws.getTopBlocks(false).find(b => b.type === START) ?? null;

/** Is the block connected under ▶ When Run? */
function underStart(b: Blockly.Block | null): boolean {
  for (let p = b; p; p = p.getParent()) if (p.type === START) return true;
  return false;
}

/**
 * Smart tap-to-add: a new block goes after the block she selected (if it's part of the program),
 * else at the end of the ▶ When Run chain — and into the empty "mouth" of a loop or if first,
 * so whole loops can be built by tapping.
 */
export function tapToAdd(ws: Blockly.WorkspaceSvg, type: string): Blockly.BlockSvg | null {
  const start = startBlock(ws) as Blockly.BlockSvg | null;
  if (!start) return null;
  const selected = Blockly.getSelected();
  let anchor: Blockly.Block = start;
  if (selected instanceof Blockly.BlockSvg && selected.workspace === ws && underStart(selected)) anchor = selected;
  else for (let b = start.getNextBlock(); b; b = b.getNextBlock()) anchor = b;

  Blockly.Events.setGroup(true);
  try {
    const block = ws.newBlock(type);
    block.initSvg();
    block.render();
    const mouth = CONTAINERS.has(anchor.type) ? anchor.getInput('DO')?.connection : null;
    const target = mouth && !mouth.targetBlock() ? mouth : anchor.nextConnection;
    if (target && block.previousConnection) target.connect(block.previousConnection);
    block.scheduleSnapAndBump();
    return block;
  } finally {
    Blockly.Events.setGroup(false);
  }
}

function blockToStmts(first: Blockly.Block | null): Stmt[] {
  const out: Stmt[] = [];
  for (let b = first; b; b = b.getNextBlock()) {
    if (!b.isEnabled()) continue;
    const id = b.id;
    const body = () => blockToStmts(b!.getInputTargetBlock('DO'));
    switch (b.type) {
      case TYPE.forward: out.push({ t: 'forward', id }); break;
      case TYPE.left: out.push({ t: 'left', id }); break;
      case TYPE.right: out.push({ t: 'right', id }); break;
      case TYPE.repeat: out.push({ t: 'repeat', n: Number(b.getFieldValue('N')) || REPEAT_MIN, body: body(), id }); break;
      case TYPE.until: out.push({ t: 'until', body: body(), id }); break;
      case TYPE.if: out.push({ t: 'if', dir: b.getFieldValue('DIR') as SensorDir, body: body(), id }); break;
      case TYPE.ifelse: out.push({ t: 'if', dir: b.getFieldValue('DIR') as SensorDir, body: body(), else: blockToStmts(b.getInputTargetBlock('ELSE')), id }); break;
    }
  }
  return out;
}

/** The program under ▶ When Run (blocks elsewhere on the canvas don't count). */
export function workspaceToProgram(ws: Blockly.Workspace): Program {
  const start = startBlock(ws);
  return start ? blockToStmts(start.getNextBlock()) : [];
}

type BlockState = { type: string; fields?: Record<string, string>; inputs?: Record<string, { block: BlockState }>; next?: { block: BlockState } };

function chainState(list: Stmt[]): { block: BlockState } | undefined {
  let next: { block: BlockState } | undefined;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    const st: BlockState = { type: s.t === 'if' ? (s.else ? TYPE.ifelse : TYPE.if) : TYPE[s.t] };
    if (s.t === 'repeat') st.fields = { N: String(s.n) };
    if (s.t === 'if') st.fields = { DIR: s.dir };
    if (s.t === 'repeat' || s.t === 'until' || s.t === 'if') {
      const inputs: Record<string, { block: BlockState }> = {};
      const body = chainState(s.body);
      if (body) inputs.DO = body;
      if (s.t === 'if' && s.else) { const other = chainState(s.else); if (other) inputs.ELSE = other; }
      if (Object.keys(inputs).length) st.inputs = inputs;
    }
    if (next) st.next = next;
    next = { block: st };
  }
  return next;
}

/** Replaces the workspace with ▶ When Run + this program (restoring saves, ?debug load / solve). */
export function programToWorkspace(ws: Blockly.WorkspaceSvg, prog: Program) {
  const start: BlockState & { x: number; y: number; deletable: boolean } = { type: START, x: 24, y: 24, deletable: false };
  const chain = chainState(prog);
  if (chain) start.next = chain;
  Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [start] } }, ws);
}

export function highlight(ws: Blockly.WorkspaceSvg, id: string | null) {
  ws.highlightBlock(id);
}

export function resize(ws: Blockly.WorkspaceSvg) {
  Blockly.svgResize(ws);
}
