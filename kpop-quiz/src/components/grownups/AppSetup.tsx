// Grown-ups corner → "📲 Get the app" and "🔁 Move progress".
// Install: the browser's own dialog where there is one (Android, Chrome/Edge), picture steps on
// iPhone/iPad. Move progress: a save code (utils/saveTransfer.ts) copied or shared here and pasted
// in the app or on the new device — on iPhone/iPad the Home Screen app starts with empty storage.
import { useEffect, useMemo, useState } from 'react';
import { useGameStore, SAVE_VERSION } from '../../store';
import { playClick, playWin } from '../../utils/sounds';
import { promptInstall, useInstallState } from '../../utils/appInstall';
import { applySave, collectKeys, decodeSave, encodeSave, SaveCodeError, summarize } from '../../utils/saveTransfer';
import type { SaveBundle, SaveSummary } from '../../utils/saveTransfer';

const btn = 'min-h-[52px] px-5 rounded-full font-fredoka text-lg';

function Summary({ s }: { s: SaveSummary }) {
  return (
    <span className="font-nunito text-lg">
      <b>{s.name}</b> · {s.xp.toLocaleString()} XP · {s.coins.toLocaleString()} 🪙 · {s.badges} {s.badges === 1 ? 'badge' : 'badges'} · {s.days} {s.days === 1 ? 'day' : 'days'} played
    </span>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span className="shrink-0 w-9 h-9 rounded-full bg-fuchsia-500 font-fredoka text-lg flex items-center justify-center">{n}</span>
      <span className="font-nunito text-lg pt-1">{children}</span>
    </li>
  );
}

function InstallPart() {
  const inst = useInstallState();
  const [answer, setAnswer] = useState<'' | 'dismissed'>('');

  if (inst.asApp) {
    return <p className="font-nunito text-lg">✅ You're using the Fun Quest app. It works offline and the progress on this device is kept safe.</p>;
  }
  if (inst.justInstalled) {
    return <p className="font-nunito text-lg">✅ Installed! Open <b>Fun Quest</b> from the Home Screen or the app list.</p>;
  }
  if (inst.canPrompt) {
    return (
      <div className="space-y-2">
        <button
          onClick={async () => { playClick(); const r = await promptInstall(); setAnswer(r === 'dismissed' ? 'dismissed' : ''); }}
          className={`${btn} bg-gradient-to-r from-fuchsia-500 to-orange-400 text-xl`}>
          📲 Install Fun Quest
        </button>
        {answer === 'dismissed' && <p className="font-nunito text-violet-200">No problem — you can install it any time from the browser menu.</p>}
      </div>
    );
  }
  if (inst.platform === 'ios') {
    return (
      <ol className="space-y-3">
        <Step n={1}>Tap the <b>Share</b> button <span aria-hidden>⬆️</span> — on iPad at the top right, on iPhone at the bottom (on iOS 26, tap <b>•••</b> first).</Step>
        <Step n={2}>Choose <b>Add to Home Screen</b> <span aria-hidden>➕</span>. Can't see it? Scroll down or tap <b>More</b>.</Step>
        <Step n={3}>Keep <b>Open as Web App</b> switched on, then tap <b>Add</b>.</Step>
        <Step n={4}>Open <b>Fun Quest</b> from the Home Screen.</Step>
      </ol>
    );
  }
  if (inst.platform === 'android') {
    return (
      <ol className="space-y-3">
        <Step n={1}>Open this page in <b>Chrome</b>.</Step>
        <Step n={2}>Tap the menu <b>⋮</b> at the top right.</Step>
        <Step n={3}>Tap <b>Install app</b> (or <b>Add to Home screen</b>, then <b>Install</b>).</Step>
      </ol>
    );
  }
  return <p className="font-nunito text-lg">In Chrome or Edge, click the install button at the right end of the address bar. In Safari on a Mac: <b>File → Add to Dock</b>.</p>;
}

function MoveProgress() {
  const inst = useInstallState();
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<'' | 'copied' | 'shared' | 'show'>('');
  const [pasted, setPasted] = useState('');
  const [incoming, setIncoming] = useState<{ bundle: SaveBundle; summary: SaveSummary } | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const current = useMemo(() => { try { return summarize(collectKeys(localStorage)); } catch { return null; } }, []);

  // Made ahead of the tap: Safari only lets a page copy straight after a tap, with nothing awaited first.
  useEffect(() => {
    let live = true;
    try { encodeSave(collectKeys(localStorage)).then(c => { if (live) setCode(c); }, () => {}); } catch { /* storage blocked */ }
    return () => { live = false; };
  }, []);

  const copy = () => {
    playClick();
    if (!code) return;
    if (!navigator.clipboard?.writeText) { setSent('show'); return; }
    navigator.clipboard.writeText(code).then(() => setSent('copied'), () => setSent('show'));
  };
  const share = () => {
    playClick();
    navigator.share?.({ title: 'Fun Quest save code', text: code }).then(() => setSent('shared'), () => { /* closed */ });
  };

  const read = async (text: string) => {
    setError(''); setIncoming(null); setConfirm(false);
    if (!text.trim()) return;
    try {
      const bundle = await decodeSave(text);
      const summary = summarize(bundle.keys);
      if (!summary) throw new SaveCodeError('This code has no saved progress in it.');
      if (summary.version > SAVE_VERSION) throw new SaveCodeError('This code comes from a newer Fun Quest. Close the app, open it again to update, then try again.');
      setIncoming({ bundle, summary });
    } catch (e) {
      setError(e instanceof SaveCodeError ? e.message : "That code couldn't be read. Copy the whole code and try again.");
    }
  };
  const pasteFromClipboard = async () => {
    playClick();
    try {
      const text = await navigator.clipboard.readText();
      setPasted(text);
      await read(text);
    } catch {
      setError('Tap the box, choose Paste, then tap Load.');
    }
  };
  const apply = async () => {
    playClick();
    if (!incoming) return;
    if (!confirm) { setConfirm(true); return; }
    try {
      applySave(localStorage, incoming.bundle.keys);
      // Load it into the running app at once, so nothing writes the old progress back before the reload.
      await useGameStore.persist.rehydrate();
      setDone(true);
      playWin();
      window.setTimeout(() => location.reload(), 1500);
    } catch {
      setError('This device ran out of space, so nothing was changed.');
    }
  };

  if (done) {
    return <p className="font-fredoka text-2xl text-green-300 text-center py-4">🎉 Progress moved! Restarting…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-fredoka text-xl mb-1">📤 Take progress from this device</h3>
        {current && <p className="text-violet-100 mb-2"><Summary s={current} /></p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} disabled={!code} className={`${btn} bg-sky-500 disabled:opacity-50`}>📋 Copy progress</button>
          {typeof navigator.share === 'function' && (
            <button onClick={share} disabled={!code} className={`${btn} bg-white/15 disabled:opacity-50`}>📨 Send to another device</button>
          )}
          <button onClick={() => { playClick(); setSent(s => (s === 'show' ? '' : 'show')); }} className={`${btn} bg-white/10 text-base`}>
            {sent === 'show' ? 'Hide the code' : 'Show the code'}
          </button>
        </div>
        {sent === 'copied' && (
          <p className="font-nunito text-green-300 mt-2">
            ✅ Copied! {inst.platform === 'ios' && !inst.asApp ? 'Now add Fun Quest to the Home Screen, open it, go to 👪 Grown-ups and tap 📥 Paste progress.' : 'Paste it in 👪 Grown-ups on the other device.'}
          </p>
        )}
        {sent === 'shared' && <p className="font-nunito text-green-300 mt-2">✅ Sent! On the other device, copy the code and paste it in 👪 Grown-ups.</p>}
        {sent === 'show' && (
          <textarea readOnly value={code} rows={4} aria-label="Save code" data-testid="save-code"
            onFocus={e => e.currentTarget.select()}
            className="mt-2 w-full rounded-xl bg-black/30 p-3 font-mono text-sm text-violet-100 break-all" />
        )}
      </div>

      <div>
        <h3 className="font-fredoka text-xl mb-1">📥 Bring progress to this device</h3>
        <p className="font-nunito text-violet-200 mb-2">Paste a save code from Safari or from another tablet or phone.</p>
        <textarea value={pasted} onChange={e => { setPasted(e.target.value); setIncoming(null); setError(''); setConfirm(false); }}
          rows={3} placeholder="Paste the save code here" aria-label="Paste a save code"
          autoCapitalize="off" autoCorrect="off" spellCheck={false}
          className="w-full rounded-xl bg-black/30 p-3 font-mono text-sm text-white placeholder:text-violet-300" />
        <div className="flex flex-wrap gap-2 mt-2">
          {typeof navigator.clipboard?.readText === 'function' && (
            <button onClick={pasteFromClipboard} className={`${btn} bg-sky-500`}>📥 Paste progress</button>
          )}
          <button onClick={() => { playClick(); void read(pasted); }} disabled={!pasted.trim()} className={`${btn} bg-white/15 disabled:opacity-50`}>Load</button>
        </div>
        {error && <p className="font-nunito text-amber-300 mt-2">{error}</p>}
        {incoming && (
          <div className="mt-3 rounded-2xl bg-black/25 p-4 space-y-2">
            <p className="text-violet-100">In the code: <Summary s={incoming.summary} /></p>
            {current && <p className="text-violet-300">On this device now: <Summary s={current} /></p>}
            <button onClick={apply} className={`${btn} ${confirm ? 'bg-red-600' : 'bg-green-600'}`}>
              {confirm ? 'Tap again to replace this device’s progress' : '✅ Use this progress here'}
            </button>
            <p className="font-nunito text-sm text-violet-300">Doodle Pad pictures stay on the old device.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppSetup() {
  const inst = useInstallState();
  return (
    <>
      <section className="rounded-3xl bg-white/10 p-5" data-testid="get-the-app">
        <h2 className="font-fredoka text-2xl mb-1">📲 Get the app</h2>
        {!inst.asApp && (
          <p className="font-nunito text-violet-200 mb-4">
            Fun Quest installs like an app, with no app store: it opens full-screen, works offline (car trips!), and phones and tablets never clear the progress of an installed app.
          </p>
        )}
        <InstallPart />
        {inst.platform === 'ios' && !inst.asApp && (
          <p className="mt-4 rounded-2xl bg-amber-400/15 border border-amber-300/50 p-3 font-nunito text-lg">
            ⚠️ On iPhone and iPad the Home Screen app keeps its <b>own</b> progress, separate from Safari, so it starts empty.
            First tap <b>📋 Copy progress</b> below. Then, in the app, open 👪 Grown-ups and tap <b>📥 Paste progress</b>.
          </p>
        )}
      </section>

      <section className="rounded-3xl bg-white/10 p-5">
        <h2 className="font-fredoka text-2xl mb-3">🔁 Move progress</h2>
        <MoveProgress />
      </section>
    </>
  );
}
