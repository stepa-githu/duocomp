'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Level = {
  id: string;
  title: string;
  slug: string;
  sort_order: number;
};

type QuizRow = {
  id: string;
  prompt: string;
  levels: {
    title: string;
  }[] | null;
};

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);

  const [levelForm, setLevelForm] = useState({
    title: '',
    slug: '',
    description: '',
    difficulty: 'base',
    sort_order: 1,
    badge_title: '',
    badge_icon: '🏅'
  });

  const [quizForm, setQuizForm] = useState({
    level_id: '',
    prompt: '',
    explanation: '',
    sort_order: 1,
    xp_reward: 10,
    option_1: '',
    option_2: '',
    option_3: '',
    option_4: '',
    correct_option: 1
  });

  useEffect(() => {
    async function bootstrap() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      await loadData();
      setLoading(false);
    }

    bootstrap();
  }, [router, supabase]);

  async function loadData() {
    const [{ data: levelRows }, { data: quizRows }] = await Promise.all([
      supabase.from('levels').select('id, title, slug, sort_order').order('sort_order'),
      supabase
        .from('quizzes')
        .select('id, prompt, levels(title)')
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    const nextLevels = (levelRows ?? []) as Level[];
    setLevels(nextLevels);
    setQuizzes((quizRows ?? []) as QuizRow[]);

    if (nextLevels.length > 0 && !quizForm.level_id) {
      setQuizForm((prev) => ({ ...prev, level_id: nextLevels[0].id }));
    }
  }

  async function createLevel(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const { data: levelInsert, error: levelError } = await supabase
      .from('levels')
      .insert({
        title: levelForm.title,
        slug: levelForm.slug,
        description: levelForm.description,
        difficulty: levelForm.difficulty,
        sort_order: levelForm.sort_order,
        is_published: true
      })
      .select('id, sort_order')
      .single();

    if (levelError || !levelInsert) {
      setMessage(levelError?.message ?? 'Errore durante la creazione del livello.');
      return;
    }

    await supabase.from('badges').insert({
      code: `level-${levelInsert.sort_order}-complete`,
      title: levelForm.badge_title || `Badge Livello ${levelInsert.sort_order}`,
      description: `Completamento del livello ${levelInsert.sort_order}`,
      icon: levelForm.badge_icon,
      trigger_type: 'level_completed',
      trigger_value: String(levelInsert.id),
      is_active: true
    });

    setLevelForm({
      title: '',
      slug: '',
      description: '',
      difficulty: 'base',
      sort_order: 1,
      badge_title: '',
      badge_icon: '🏅'
    });

    setMessage('Livello creato con successo.');
    await loadData();
  }

  async function createQuiz(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const { data: quizInsert, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        level_id: quizForm.level_id,
        prompt: quizForm.prompt,
        explanation: quizForm.explanation,
        sort_order: quizForm.sort_order,
        xp_reward: quizForm.xp_reward,
        is_published: true
      })
      .select('id')
      .single();

    if (quizError || !quizInsert) {
      setMessage(quizError?.message ?? 'Errore durante la creazione del quiz.');
      return;
    }

    const options = [
      { option_text: quizForm.option_1, is_correct: quizForm.correct_option === 1, sort_order: 1 },
      { option_text: quizForm.option_2, is_correct: quizForm.correct_option === 2, sort_order: 2 },
      { option_text: quizForm.option_3, is_correct: quizForm.correct_option === 3, sort_order: 3 },
      { option_text: quizForm.option_4, is_correct: quizForm.correct_option === 4, sort_order: 4 }
    ].map((item) => ({ ...item, quiz_id: quizInsert.id }));

    const { error: optionError } = await supabase.from('quiz_options').insert(options);

    if (optionError) {
      setMessage(optionError.message);
      return;
    }

    setQuizForm({
      level_id: levels[0]?.id ?? '',
      prompt: '',
      explanation: '',
      sort_order: 1,
      xp_reward: 10,
      option_1: '',
      option_2: '',
      option_3: '',
      option_4: '',
      correct_option: 1
    });

    setMessage('Quiz creato con successo.');
    await loadData();
  }

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="card">Verifica permessi admin...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="topbar">
          <div>
            <span className="badge">Admin</span>
            <h1 className="title mt-16">Pannello contenuti</h1>
            <p className="subtitle">Qui puoi creare e modificare le cose principali del MVP.</p>
          </div>
          <div className="row">
            <Link href="/dashboard" className="button button-outline">
              Dashboard
            </Link>
          </div>
        </div>

        {message ? <div className="card mb-16">{message}</div> : null}

        <div className="grid grid-2">
          <form className="card grid" onSubmit={createLevel}>
            <h2 style={{ marginTop: 0 }}>Crea livello</h2>
            <input
              className="input"
              placeholder="Titolo livello"
              value={levelForm.title}
              onChange={(e) => setLevelForm({ ...levelForm, title: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Slug"
              value={levelForm.slug}
              onChange={(e) => setLevelForm({ ...levelForm, slug: e.target.value })}
              required
            />
            <textarea
              className="textarea"
              placeholder="Descrizione"
              value={levelForm.description}
              onChange={(e) => setLevelForm({ ...levelForm, description: e.target.value })}
            />
            <select
              className="select"
              value={levelForm.difficulty}
              onChange={(e) => setLevelForm({ ...levelForm, difficulty: e.target.value })}
            >
              <option value="base">Base</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzato">Avanzato</option>
            </select>
            <input
              className="input"
              type="number"
              placeholder="Ordine"
              value={levelForm.sort_order}
              onChange={(e) => setLevelForm({ ...levelForm, sort_order: Number(e.target.value) })}
            />
            <input
              className="input"
              placeholder="Titolo badge"
              value={levelForm.badge_title}
              onChange={(e) => setLevelForm({ ...levelForm, badge_title: e.target.value })}
            />
            <input
              className="input"
              placeholder="Icona badge"
              value={levelForm.badge_icon}
              onChange={(e) => setLevelForm({ ...levelForm, badge_icon: e.target.value })}
            />
            <button className="button button-primary" type="submit">
              Salva livello
            </button>
          </form>

          <form className="card grid" onSubmit={createQuiz}>
            <h2 style={{ marginTop: 0 }}>Crea quiz</h2>
            <select
              className="select"
              value={quizForm.level_id}
              onChange={(e) => setQuizForm({ ...quizForm, level_id: e.target.value })}
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.title}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Domanda"
              value={quizForm.prompt}
              onChange={(e) => setQuizForm({ ...quizForm, prompt: e.target.value })}
              required
            />
            <textarea
              className="textarea"
              placeholder="Spiegazione"
              value={quizForm.explanation}
              onChange={(e) => setQuizForm({ ...quizForm, explanation: e.target.value })}
            />
            <div className="grid grid-2">
              <input
                className="input"
                type="number"
                placeholder="Ordine"
                value={quizForm.sort_order}
                onChange={(e) => setQuizForm({ ...quizForm, sort_order: Number(e.target.value) })}
              />
              <input
                className="input"
                type="number"
                placeholder="XP"
                value={quizForm.xp_reward}
                onChange={(e) => setQuizForm({ ...quizForm, xp_reward: Number(e.target.value) })}
              />
            </div>
            <input
              className="input"
              placeholder="Opzione 1"
              value={quizForm.option_1}
              onChange={(e) => setQuizForm({ ...quizForm, option_1: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Opzione 2"
              value={quizForm.option_2}
              onChange={(e) => setQuizForm({ ...quizForm, option_2: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Opzione 3"
              value={quizForm.option_3}
              onChange={(e) => setQuizForm({ ...quizForm, option_3: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Opzione 4"
              value={quizForm.option_4}
              onChange={(e) => setQuizForm({ ...quizForm, option_4: e.target.value })}
              required
            />
            <select
              className="select"
              value={quizForm.correct_option}
              onChange={(e) => setQuizForm({ ...quizForm, correct_option: Number(e.target.value) })}
            >
              <option value={1}>Risposta corretta: 1</option>
              <option value={2}>Risposta corretta: 2</option>
              <option value={3}>Risposta corretta: 3</option>
              <option value={4}>Risposta corretta: 4</option>
            </select>
            <button className="button button-primary" type="submit">
              Salva quiz
            </button>
          </form>
        </div>

        <div className="grid grid-2 mt-24">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Livelli attuali</h2>
            <div className="grid">
              {levels.map((level) => (
                <div key={level.id} className="path-node">
                  <div>
                    <strong>
                      {level.sort_order}. {level.title}
                    </strong>
                    <p className="muted" style={{ margin: '6px 0 0' }}>
                      {level.slug}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Ultimi quiz creati</h2>
            <div className="grid">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="path-node">
                  <div>
                    <strong>{quiz.prompt}</strong>
                    <p className="muted" style={{ margin: '6px 0 0' }}>
                      {quiz.levels?.[0]?.title ?? 'Senza livello'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}