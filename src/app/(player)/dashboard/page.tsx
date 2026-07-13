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
  } | null;
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
          supabase.from('user_level_progress').select('level_id, completed_quizzes, is_completed').eq('user_id', user.id),
          supabase.from('user_badges').select('id, badges(title, icon)').eq('user_id', user.id)
        ]);

      setProfile(profileRow as Profile);
      setLevels((levelsRows ?? []) as Level[]);
      setProgress((progressRows ?? []) as Progress[]);
      setBadges((badgeRows ?? []) as UserBadge[]);
      setLoading(false);
    }

    load();
  }, [router, supabase]);

  const mappedLevels = useMemo(() => {
    return levels.map((level, index) => {
      const item = progress.find((p) => p.level_id === level.id);
      const previous = levels[index - 1];
      const previousProgress = previous ? progress.find((p) => p.level_id === previous.id) : null;
      const isLocked = previous ? !previousProgress?.is_completed : false;

      return {
        ...level,
        quiz_count: 5,
        completed_quizzes: item?.completed_quizzes ?? 0,
        is_locked: isLocked
      };
    });
  }, [levels, progress]);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return <div className="page"><div className="container"><div className="card">Caricamento...</div></div></div>;
  }

  return (
    <div className="page">
      <div className="container">
        <div className="topbar">
          <div>
            <h1 className="title">Ciao {profile?.display_name ?? 'utente'} 👋</h1>
            <p className="subtitle">Riparti dal tuo percorso sui concorsi pubblici.</p>
          </div>
          <div className="row">
            {profile?.role === 'admin' ? (
              <Link href="/admin" className="button button-secondary">Admin</Link>
            ) : null}
            <button className="button button-outline" onClick={logout}>Esci</button>
          </div>
        </div>

        <div className="grid grid-3 mb-16">
          <div className="card">
            <div className="badge">XP</div>
            <h2>{profile?.total_xp ?? 0}</h2>
            <p className="muted">Punti esperienza totali</p>
          </div>
          <div className="card">
            <div className="badge">Streak</div>
            <h2>{profile?.current_streak ?? 0} giorni</h2>
            <p className="muted">Giorni consecutivi attivi</p>
          </div>
          <div className="card">
            <div className="badge">Badge</div>
            <h2>{badges.length}</h2>
            <p className="muted">Ricompense già ottenute</p>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="space-between mb-16">
              <h2 style={{ margin: 0 }}>Il tuo percorso</h2>
              <span className="badge">3 livelli • 15 quiz</span>
            </div>
            <PathMap levels={mappedLevels} />
          </div>

          <div className="grid">
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Badge ottenuti</h2>
              <div className="grid">
                {badges.length === 0 ? (
                  <p className="muted">Nessun badge ancora sbloccato.</p>
                ) : (
                  badges.map((item) => (
                    <div className="row" key={item.id}>
                      <span style={{ fontSize: 24 }}>{item.badges?.icon ?? '🏅'}</span>
                      <strong>{item.badges?.title}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Consiglio MVP</h2>
              <p className="muted">
                Mantieni sessioni brevi: 1 quiz alla volta, feedback immediato, progresso visibile.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
