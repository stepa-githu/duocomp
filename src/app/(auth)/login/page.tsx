'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card">
          <span className="badge">MVP 0.1</span>
          <h1 className="title mt-16">Accedi a Concorsi Hero</h1>
          <p className="subtitle">
            A volte un'idea nata in spiaggia è l'IDEA.Altre volte no, è solo un'idea.
          </p>

          <form className="grid mt-24" onSubmit={onSubmit}>
            <div>
              <label className="mb-8" style={{ display: 'block' }}>Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-8" style={{ display: 'block' }}>Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}

            <button className="button button-primary w-full" disabled={loading} type="submit">
              {loading ? 'Accesso in corso...' : 'Entra'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
