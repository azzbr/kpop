import { useState } from 'react';
import { playClick } from '../../utils/sounds';

/** A 4-digit PIN pad (dots, not digits). `onSubmit` returns false to shake and clear. */
export default function PinPad({ label, onSubmit, okLabel = 'OK' }: { label: string; onSubmit: (pin: string) => boolean | Promise<boolean>; okLabel?: string }) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const press = (d: string) => { playClick(); setWrong(false); setPin(p => (p.length < 4 ? p + d : p)); };
  const ok = async () => {
    if (pin.length !== 4) return;
    if (!(await onSubmit(pin))) { setWrong(true); setPin(''); }
  };
  return (
    <div className="max-w-xs mx-auto text-center">
      <p className="font-fredoka text-xl mb-2">{label}</p>
      <div className="flex justify-center gap-3 mb-3" aria-label={`${pin.length} of 4 digits`}>
        {[0, 1, 2, 3].map(i => <span key={i} className={`w-5 h-5 rounded-full ${i < pin.length ? 'bg-white' : 'bg-white/20'}`} />)}
      </div>
      {wrong && <p className="font-nunito text-lg text-amber-300 mb-2" role="alert">That's not it — try again.</p>}
      <div className="grid grid-cols-3 gap-2">
        {'123456789'.split('').map(d => <button key={d} type="button" aria-label={`Digit ${d}`} onClick={() => press(d)} className="min-h-[56px] rounded-xl bg-white/15 font-fredoka text-2xl">{d}</button>)}
        <button type="button" onClick={() => setPin('')} className="min-h-[56px] rounded-xl bg-white/10 font-fredoka text-lg">Clear</button>
        <button type="button" aria-label="Digit 0" onClick={() => press('0')} className="min-h-[56px] rounded-xl bg-white/15 font-fredoka text-2xl">0</button>
        <button type="button" onClick={ok} className="min-h-[56px] rounded-xl bg-fuchsia-500 font-fredoka text-lg">{okLabel}</button>
      </div>
    </div>
  );
}
