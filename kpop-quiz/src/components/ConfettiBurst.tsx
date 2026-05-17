import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface Props {
  count?: number;
  durationMs?: number;
}

const COLORS = ['#FF4FA3', '#FFD53E', '#46C2FF', '#7CDC54', '#B57BFF', '#FF8A3D'];
const EMOJIS = ['🎉', '⭐', '✨', '💖', '🎊', '🌟'];

export default function ConfettiBurst({ count = 40, durationMs = 2500 }: Props) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: (durationMs / 1000) * (0.7 + Math.random() * 0.6),
        rotate: Math.random() * 720 - 360,
        size: 14 + Math.random() * 14,
        color: COLORS[i % COLORS.length],
        emoji: Math.random() < 0.3 ? EMOJIS[i % EMOJIS.length] : null,
        drift: (Math.random() - 0.5) * 80,
      })),
    [count, durationMs]
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -40, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', x: p.drift, opacity: 0, rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          className="absolute"
          style={{
            left: `${p.left}%`,
            fontSize: p.emoji ? p.size + 4 : undefined,
            width: p.emoji ? undefined : p.size,
            height: p.emoji ? undefined : p.size,
            background: p.emoji ? undefined : p.color,
            borderRadius: p.emoji ? undefined : 3,
          }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}
