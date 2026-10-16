import { useState } from 'react';
import { useGameStore } from '../../store';
import { safeName } from '../../online/names';
import { hashPin } from '../../utils/pin';
import PinPad from '../ui/PinPad';
import { playClick, playUnlock } from '../../utils/sounds';

// Grown-ups corner → Teacher setup: the teacher's display name and a 4-digit PIN for this device.
// Teacher mode then turns on from the 🍎 Teacher button under the game grid.
export default function TeacherSetup() {
  const teacher = useGameStore(s => s.teacher);
  const setTeacher = useGameStore(s => s.setTeacher);
  const [name, setName] = useState(teacher?.name ?? '');
  const [step, setStep] = useState<'view' | 'name' | 'pin' | 'again'>(teacher ? 'view' : 'name');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <section className="rounded-3xl bg-white/10 p-5">
      <h2 className="font-fredoka text-2xl mb-1">🍎 Teacher setup</h2>
      <p className="font-nunito text-base text-violet-100 mb-3">
        For a teacher using this device in class. Teacher mode opens the Teacher's Lounge and gives classroom powers in Friends Arena (always host, big screen, lock the room, “Eyes on me”, teams, gold stars). The PIN is only a lock against curious kids — it isn't real security.
      </p>
      {step === 'view' && teacher && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-fredoka text-2xl flex-1">{teacher.name}</span>
          <button type="button" onClick={() => { playClick(); setStep('name'); }} className="min-h-[48px] px-4 rounded-full bg-white/15 font-fredoka text-lg">✏️ Change</button>
          <button type="button" onClick={() => {
            if (confirmRemove) { setTeacher(null); setName(''); setStep('name'); setConfirmRemove(false); return; }
            playClick(); setConfirmRemove(true);
          }} className={`min-h-[48px] px-4 rounded-full font-fredoka text-lg ${confirmRemove ? 'bg-red-600' : 'bg-white/15'}`}>
            {confirmRemove ? 'Tap again to remove' : 'Remove teacher'}
          </button>
        </div>
      )}
      {step === 'name' && (
        <form onSubmit={(e) => {
          e.preventDefault();
          const n = safeName(name);
          if (!n) { setError('Please use a short name like “Ms Patel” (letters only).'); return; }
          setName(n); setError(''); setStep('pin');
        }} className="flex flex-wrap gap-2 items-center">
          <label htmlFor="teacher-name" className="font-fredoka text-lg w-full">Name the class will see</label>
          <input id="teacher-name" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="Ms Patel"
            className="flex-1 min-w-[12rem] min-h-[52px] rounded-2xl px-4 text-gray-900 font-nunito text-xl" />
          <button type="submit" className="min-h-[52px] px-6 rounded-full bg-fuchsia-500 font-fredoka text-lg">Next →</button>
          {error && <p className="w-full font-nunito text-amber-300" role="alert">{error}</p>}
        </form>
      )}
      {step === 'pin' && <PinPad label={`Choose a 4-digit PIN for ${name}`} okLabel="Next" onSubmit={(p) => { setFirst(p); setStep('again'); return true; }} />}
      {step === 'again' && (
        <PinPad label="Type the PIN again" okLabel="Save" onSubmit={async (p) => {
          if (p !== first) { setStep('pin'); setError("The PINs didn't match — choose it again."); return false; }
          setTeacher({ name, pinHash: await hashPin(p) });
          playUnlock();
          setError('');
          setStep('view');
          return true;
        }} />
      )}
      {(step === 'pin' || step === 'again') && error && <p className="font-nunito text-amber-300 mt-2 text-center" role="alert">{error}</p>}
    </section>
  );
}
