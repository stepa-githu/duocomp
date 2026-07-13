'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';

type Quiz = {
  id: string;
  level_id: string;
  prompt: string;
  explanation: string | null;
  xp_reward: number;
  levels?: {
    slug: string;
    title: string;
    sort_order: number;
  }[] | null;
};

type Option = {
  id: string;
  option_text: string;
  is_correct: boolean;
  sort_order: number;
};

type Profile = {
  total_xp: number;
  current_streak: number;
  last_activity_on: string | null;
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function QuizPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: quizRow } = await supabase
        .from('quizzes')
        .select('id, level_id, prompt, explanation, xp_reward, levels(slug, title, sort_order)')
        .eq('id', params.id)
        .single();

      if (!quizRow) {
        router.push('/dashboard');
        return;
      }

      const { data: optionRows } = await supabase
        .from('quiz_options')
        .select('id, option_text, is_correct, sort_order')
        .eq('quiz_id', params.id)
        .order('sort_order');

      setQuiz(quizRow as Quiz);
      setOptions((optionRows ?? []) as Option[]);
    }

    load();
  }, [params.id, router, supabase]);

  async function handleSubmit() {
    if (!selected || !quiz) return;
    setSaving(true);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.push('/login');
      return;
    }

    const selectedOption = options.find((item) => item.id === selected);
    const answerIsCorrect = !!selectedOption?.is_correct;
    const gainedXp = answerIsCorrect ? quiz.xp_reward : 0;

    setSubmitted(true);
    setIsCorrect(answerIsCorrect);
    setEarnedXp(gainedXp);
    setFeedback(
      answerIsCorrect
        ? 'Risposta corretta! Ottimo lavoro.'
        : quiz.explanation ?? 'Risposta errata, ma puoi riprovare subito.'
    );

    await supabase.from('user_quiz_attempts').insert({
      user_id: user.id,
      level_id: quiz.level_id,
      quiz_id: quiz.id,
      selected_option_id: selected,
      is_correct: answerIsCorrect,
      earned_xp: gainedXp,
    });

    const { data: profile } = await supabase
      .from('profiles')
      .select('total_xp, current_streak, last_activity_on')
      .eq('id', user.id)
      .single();

    const profileRow = profile as Profile | null;

    const today = new Date();
    const todayStr = formatDate(today);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    let nextStreak = profileRow?.current_streak ?? 0;
    const lastActivity = profileRow?.last_activity_on;

    if (lastActivity === todayStr) {
      nextStreak = profileRow?.current_streak ?? 0;
    } else if (lastActivity === yesterdayStr) {
      nextStreak = (profileRow?.current_streak ?? 0) + 1;
    } else {
      nextStreak = 1;
    }

    await supabase
      .from('profiles')
      .update({
        total_xp: (profileRow?.total_xp ?? 0) + gainedXp,
        current_streak: nextStreak,
        last_activity_on: todayStr,
      })
      .eq('id', user.id);

    const { data: allAttempts } = await supabase
      .from('user_quiz_attempts')
      .select('quiz_id, is_correct')
      .eq('user_id', user.id)
      .eq('level_id', quiz.level_id);

    const correctIds = new Set(
      (allAttempts ?? []).filter((item) => item.is_correct).map((item) => item.quiz_id)
    );

    const completedQuizzes = correctIds.size;
    const isCompleted = completedQuizzes >= 5;
    setLevelCompleted(answerIsCorrect && isCompleted);

    await supabase.from('user_level_progress').upsert(
      {
        user_id: user.id,
        level_id: quiz.level_id,
        completed_quizzes: completedQuizzes,
        xp_earned: completedQuizzes * quiz.xp_reward,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      },
      { onConflict: 'user_id,level_id' }
    );

    const currentLevel = quiz.levels?.[0];

    if (isCompleted && currentLevel?.sort_order) {
      const badgeCode = `level-${currentLevel.sort_order}-complete`;
      const { data: badge } = await supabase
        .from('badges')
        .select('id')
        .eq('code', badgeCode)
        .single();

      if (badge?.id) {
        await supabase.from('user_badges').upsert(
          {
            user_id: user.id,
            badge_id: badge.id,
          },
          { onConflict: 'user_id,badge_id' }
        );
      }
    }

    setSaving(false);
  }

  const currentLevel = quiz?.levels?.[0];
  const celebrationMode = useMemo(() => {
    if (!submitted || !isCorrect) return null;
    return levelCompleted ? 'level' : 'quiz';
  }, [submitted, isCorrect, levelCompleted]);

  return (
    <div className="page celebration-page">
      <div className="container" style={{ maxWidth: 820 }}>
        {celebrationMode ? <CelebrationOverlay show={true} mode={celebrationMode} /> : null}

        <div className="topbar">
          <div>
            <span className="badge">Quiz</span>
            <h1 className="title mt-16">{quiz?.prompt ?? 'Caricamento...'}</h1>
            <p className="subtitle">Scegli una risposta.</p>
          </div>
          <Link
            href={currentLevel?.slug ? `/livello/${currentLevel.slug}` : '/dashboard'}
            className="button button-outline"
          >
            Torna al livello
          </Link>
        </div>

        <div className="card celebration-shell">
          <div className="grid">
            {options.map((option) => {
              let cls = 'option';
              if (selected === option.id) cls += ' selected';
              if (submitted && option.is_correct) cls += ' correct';
              if (submitted && selected === option.id && !option.is_correct) cls += ' wrong';

              return (
                <button
                  key={option.id}
                  className={cls}
                  disabled={submitted}
                  onClick={() => setSelected(option.id)}
                  type="button"
                >
                  {option.option_text}
                </button>
              );
            })}

            {!submitted ? (
              <button
                className="button button-primary"
                onClick={handleSubmit}
                disabled={!selected || saving}
                type="button"
              >
                {saving ? 'Salvataggio...' : 'Conferma risposta'}
              </button>
            ) : (
              <div
                className={`card celebration-result ${
                  isCorrect ? 'celebration-result-success' : 'celebration-result-error'
                }`}
              >
                <div className="celebration-result-header">
                  <div>
                    <h3 style={{ marginTop: 0 }}>
                      {levelCompleted
                        ? 'Livello completato! 🏆'
                        : isCorrect
                        ? 'Corretto 🎉'
                        : 'Quasi!'}
                    </h3>
                    <p>{feedback}</p>
                  </div>
                  {isCorrect ? (
                    <div className="celebration-xp-pill">+{earnedXp} XP</div>
                  ) : null}
                </div>

                {levelCompleted ? (
                  <div className="celebration-big-banner">
                    Hai sbloccato badge, progresso e un finale più scenografico. Ottimo lavoro.
                  </div>
                ) : null}

                <div className="row mt-16">
                  <Link
                    href={currentLevel?.slug ? `/livello/${currentLevel.slug}` : '/dashboard'}
                    className="button button-primary"
                  >
                    {levelCompleted ? 'Guarda il livello completato' : 'Torna al livello'}
                  </Link>
                  <Link href="/dashboard" className="button button-outline">
                    Vai alla home
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}