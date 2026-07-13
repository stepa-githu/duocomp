'use client';

import { useMemo } from 'react';

type CelebrationMode = 'quiz' | 'level';

export function CelebrationOverlay({
  show,
  mode,
}: {
  show: boolean;
  mode: CelebrationMode;
}) {
  const confetti = useMemo(
    () =>
      Array.from({ length: mode === 'level' ? 24 : 14 }, (_, i) => ({
        id: i,
        left: `${4 + (i * 91) % 92}%`,
        delay: `${(i % 8) * 0.08}s`,
        duration: `${2.4 + (i % 5) * 0.25}s`,
        rotation: `${(i % 2 === 0 ? 1 : -1) * (15 + i * 6)}deg`,
      })),
    [mode]
  );

  const fireworks = useMemo(
    () =>
      mode === 'level'
        ? [
            { top: '20%', left: '18%', delay: '0s' },
            { top: '16%', left: '78%', delay: '0.35s' },
            { top: '30%', left: '62%', delay: '0.15s' },
          ]
        : [{ top: '22%', left: '72%', delay: '0s' }],
    [mode]
  );

  if (!show) return null;

  return (
    <div className="celebration-layer" aria-hidden="true">
      <div className={`celebration-center celebration-center-${mode}`}>
        <div className="celebration-glow" />
        <div className="celebration-emoji">{mode === 'level' ? '🏆' : '✨'}</div>
      </div>

      {confetti.map((piece) => (
        <span
          key={piece.id}
          className={`confetti confetti-${piece.id % 6}`}
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            rotate: piece.rotation,
          }}
        />
      ))}

      {fireworks.map((firework, index) => (
        <span
          key={`${firework.left}-${index}`}
          className={`firework firework-${mode}`}
          style={{
            top: firework.top,
            left: firework.left,
            animationDelay: firework.delay,
          }}
        />
      ))}
    </div>
  );
}