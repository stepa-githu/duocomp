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
  is_current?: boolean;
  is_completed?: boolean;
};

export function PathMap({ levels }: { levels: Level[] }) {
  return (
    <div className="path duolingo-path">
      {levels.map((level) => {
        const total = level.quiz_count ?? 0;
        const done = level.completed_quizzes ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const statusClass = level.is_locked
          ? 'locked'
          : level.is_completed
            ? 'completed'
            : level.is_current
              ? 'current'
              : 'available';

        return (
          <div className={`path-level ${statusClass}`} key={level.id}>
            <div className="path-rail-dot" />
            <div className={`path-node duolingo-node ${statusClass}`}>
              <div className={`path-node-icon ${statusClass}`}>
                {level.is_completed ? '✓' : level.is_current ? '★' : level.is_locked ? '🔒' : level.sort_order}
              </div>

              <div className="path-node-main">
                <div className="row mb-8">
                  <span className="badge">Livello {level.sort_order}</span>
                  <span className="badge">{level.difficulty}</span>
                  {level.is_current ? <span className="badge badge-next">Prossimo</span> : null}
                  {level.is_completed ? <span className="badge badge-done">Completato</span> : null}
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

              <div className="path-node-action">
                {level.is_locked ? (
                  <button className="button button-outline" disabled>
                    Bloccato
                  </button>
                ) : (
                  <Link className={`button ${level.is_current ? 'button-primary' : 'button-outline'}`} href={`/livello/${level.slug}`}>
                    {level.is_completed ? 'Ripassa' : level.is_current ? 'Continua' : 'Apri'}
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