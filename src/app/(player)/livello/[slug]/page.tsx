'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Level = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string;
  sort_order: number;
};

type Quiz = {
  id: string;
  prompt: string;
  sort_order: number;
  xp_reward: number;
};

type Attempt = {
  quiz_id: string;
  is_correct: boolean;
};

export default function LevelPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [level, setLevel] = useState<Level | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: levelRow } = await supabase
        .from('levels')
        .select('*')
        .eq('slug', params.slug)
        .eq('is_published', true)
        .single();

      if (!levelRow) {
        router.push('/dashboard');
        return;
      }

      const [{ data: quizRows }, { data: attemptRows }] = await Promise.all([
        supabase.from('quizzes').select('id, prompt, sort_order, xp_reward').eq('level_id', levelRow.id).eq('is_published', true).order('sort_order'),
        supabase.from('user_quiz_attempts').select('quiz_id, is_correct').eq('user_id', user.id).eq('level_id', levelRow.id)
      ]);

      setLevel(levelRow as Level);
      setQuizzes((quizRows ?? []) as Quiz[]);
      setAttempts((attemptRows ?? []) as Attempt[]);
      setLoading(false);
    }

    load();
  }, [params.slug, router, supabase]);

  const correctQuizIds = useMemo(() => {
    return new Set(attempts.filter((item) => item.is_correct).map((item) => item.quiz_id));
  }, [attempts]);

  if (loading) {
    return <div className="page"><div className="container"><div className="card">Caricamento livello...</div></div></div>;
  }

  return (
    <div className="page">
      <div className="container">
        <div className="topbar">
          <div>
            <span className="badge">Livello {level?.sort_order}</span>
            <h1 className="title mt-16">{level?.title}</h1>
            <p className="subtitle">{level?.description}</p>
          </div>
          <Link href="/dashboard" className="button button-outline">Torna alla home</Link>
        </div>

        <div className="card">
          <div className="grid">
            {quizzes.map((quiz) => {
              const isDone = correctQuizIds.has(quiz.id);

              return (
                <div key={quiz.id} className="path-node">
                  <div>
                    <div className="row mb-8">
                      <span className="badge">Quiz {quiz.sort_order}</span>
                      <span className="badge">+{quiz.xp_reward} XP</span>
                      {isDone ? <span className="badge">Completato</span> : null}
                    </div>
                    <strong>{quiz.prompt}</strong>
                  </div>
                  <Link href={`/quiz/${quiz.id}`} className="button button-primary">
                    {isDone ? 'Ripeti' : 'Inizia'}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
