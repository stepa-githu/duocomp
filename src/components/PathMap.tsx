'use client';

import Link from 'next/link';

type Level = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string;
  sort_order: number;
  quiz_count?: number;
  completed_quizzes?: number;
  is_locked?: boolean;
};

export function PathMap({ levels }: { levels: Level[] }) {
  return (
    <div className="path">
      {levels.map((level) => {
        const total = level.quiz_count ?? 0;
        const done = level.completed_quizzes ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div className="path-level" key={level.id}>
            <div className={`path-node ${level.is_locked ? 'locked' : ''}`}>
              <div style={{ flex: 1 }}>
                <div className="row mb-8">
                  <span className="badge">Livello {level.sort_order}</span>
                  <span className="badge">{level.difficulty}</span>
                </div>
                <h3 style={{ margin: '0 0 6px' }}>{level.title}</h3>
                <p className="muted" style={{ margin: '0 0 12px' }}>
                  {level.description ?? 'Descrizione livello'}
                </p>
                <div className="progress-wrap">
                  <div className="progress-bar" style={{ width: `${pct}%` }} />
                </div>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  {done}/{total} quiz completati
                </p>
              </div>
              <div>
                {level.is_locked ? (
                  <button className="button button-outline" disabled>
                    Bloccato
                  </button>
                ) : (
                  <Link className="button button-primary" href={`/livello/${level.slug}`}>
                    Continua
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
