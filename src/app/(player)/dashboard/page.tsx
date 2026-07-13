'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PathMap } from '@/components/PathMap';

type Profile = {
  id: string;
  email: string;
  role: 'admin' | 'student';
  display_name: string | null;
  total_xp: number;
  current_streak: number;
};

type Level = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string;
  sort_order: number;
};

type Progress = {
  level_id: string;
  completed_quizzes: number;
  is_completed: boolean;
};

type UserBadge = {
  id: string;
  badges: {
    title: string;
    icon: string | null;
  }[] | null;
};

type MappedLevel = Level & {
  quiz_count: number;
  completed_quizzes: number;
  is_locked: boolean;
  is_completed: boolean;
  is_current: boolean;
  completion_pct: number;
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [badges, setBadges] = useState<UserBadge[]>([]);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push('/login');
        return;
      }

      const [{ data: profileRow }, { data: levelsRows }, { data: progressRows }, { data: badgeRows }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('levels').select('*').eq('is_published', true).order('sort_order'),
          supabase
            .from('user_level_progress')
            .select('level_id, completed_quizzes, is_completed')
            .eq('user_id', user.id),
          supabase
            .from('user_badges')
            .select('id, badges(title, icon)')
            .eq('user_id', user.id)
        ]);

      setProfile(profileRow as Profile);
      setLevels((levelsRows ?? []) as Level[]);
      setProgress((progressRows ?? []) as Progress[]);
      setBadges((badgeRows ?? []) as UserBadge[]);
      setLoading(false);
    }

    load();
  }, [router, supabase]);

  const mappedLevels = useMemo<MappedLevel[]>(() => {
    const baseLevels = levels.map((level, index) => {
      const item = progress.find((p) => p.level_id === level.id);
      const previous = levels[index - 1];
      const previousProgress = previous ? progress.find((p) => p.level_id === previous.id) : null;
      const isLocked = previous ? !previousProgress?.is_completed : false;
      const completedQuizzes = item?.completed_quizzes ?? 0;
      const quizCount = 5;
      const completionPct = Math.round((completedQuizzes / quizCount) * 100);

      return {
        ...level,
        quiz_count: quizCount,
        completed_quizzes: completedQuizzes,
        is_locked: isLocked,
        is_completed: item?.is_completed ?? false,
        is_current: false,
        completion_pct: completionPct
      };
    });

    const currentTarget =
      baseLevels.find((level) => !level.is_locked && !level.is_completed) ??
      baseLevels.find((level) => !level.is_locked) ??
      null;

    return baseLevels.map((level) => ({
      ...level,
      is_current: currentTarget ? currentTarget.id === level.id : false
    }));
  }, [levels, progress]);

  const currentLevel =
    mappedLevels.find((level) => level.is_current) ??
    mappedLevels.find((level) => !level.is_locked) ??
    null;

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="card">Caricamento...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="dashboard-hero card">
          <div className="dashboard-hero-main">
            <div>
              <div className="dashboard-hero-kicker">Percorso Concorsi Hero</div>
              <h1 className="title">Ciao {profile?.display_name ?? 'utente'} 👋</h1>
              <p className="subtitle">
                Continua da dove eri rimasto e completa il prossimo step del tuo percorso.
              </p>
            </div>

            <div className="dashboard-hero-actions">
              {profile?.role === 'admin' ? (
                <Link href="/admin" className="button button-secondary">
                  Admin
                </Link>
              ) : null}
              <button className="button button-outline" onClick={logout}>
                Esci
              </button>
            </div>
          </div>

          <div className="dashboard-hero-pills">
            <div className="dashboard-pill">
              <span>⚡</span>
              <strong>{profile?.total_xp ?? 0} XP</strong>
            </div>
            <div className="dashboard-pill">
              <span>🔥</span>
              <strong>{profile?.current_streak ?? 0} giorni</strong>
            </div>
            <div className="dashboard-pill">
              <span>🏅</span>
              <strong>{badges.length} badge</strong>
            </div>
          </div>
        </div>

        <div className="dashboard-stats-grid mt-24">
          <div className="card stat-card stat-card-xp">
            <div className="badge">XP</div>
            <h2>{profile?.total_xp ?? 0}</h2>
            <p className="muted">Punti esperienza totali</p>
          </div>

          <div className="card stat-card stat-card-streak">
            <div className="badge">Streak</div>
            <h2>{profile?.current_streak ?? 0} giorni</h2>
            <p className="muted">Continuità di allenamento</p>
          </div>

          <div className="card stat-card stat-card-badge">
            <div className="badge">Badge</div>
            <h2>{badges.length}</h2>
            <p className="muted">Ricompense già ottenute</p>
          </div>
        </div>

        <div className="grid grid-2 mt-24">
          <div className="card">
            <div className="space-between mb-16">
              <h2 style={{ margin: 0 }}>Il tuo percorso</h2>
              <span className="badge">3 livelli • 15 quiz</span>
            </div>

            <PathMap levels={mappedLevels} />
          </div>

          <div className="grid">
            <div className="card next-target-card">
              <div className="badge">Prossimo step</div>
              <h2 style={{ marginTop: 12 }}>
                {currentLevel ? currentLevel.title : 'Percorso completato'}
              </h2>
              <p className="muted">
                {currentLevel
                  ? currentLevel.description ?? 'Continua con il prossimo livello disponibile.'
                  : 'Hai completato tutti i livelli pubblicati.'}
              </p>

              {currentLevel ? (
                <>
                  <div className="progress-wrap mt-16">
                    <div
                      className="progress-bar"
                      style={{ width: `${currentLevel.completion_pct}%` }}
                    />
                  </div>
                  <p className="muted" style={{ marginTop: 8 }}>
                    {currentLevel.completed_quizzes}/{currentLevel.quiz_count} quiz completati
                  </p>

                  <Link
                    href={`/livello/${currentLevel.slug}`}
                    className="button button-primary mt-16"
                  >
                    Continua il livello
                  </Link>
                </>
              ) : null}
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Badge ottenuti</h2>

              <div className="badge-list-compact">
                {badges.length === 0 ? (
                  <p className="muted">Nessun badge ancora sbloccato.</p>
                ) : (
                  badges.map((item) => (
                    <div className="badge-chip" key={item.id}>
                      <span className="badge-chip-icon">{item.badges?.[0]?.icon ?? '🏅'}</span>
                      <strong>{item.badges?.[0]?.title ?? 'Badge'}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Metodo consigliato</h2>
              <p className="muted">
                Sessioni brevi, una domanda alla volta, feedback immediato e progressione visibile:
                è il modo più efficace per dare ritmo al percorso.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}