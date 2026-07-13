# Concorsi Hero - MVP 0.1

Stack: Next.js App Router + Supabase + Vercel

## Cosa contiene
- login con email/password Supabase
- 3 livelli lineari stile percorso
- 5 quiz per livello
- salvataggio progressi, XP, streak e badge
- area admin minima per creare livelli e quiz placeholder

## Setup veloce
1. Crea progetto Supabase.
2. Esegui `supabase/migrations/001_init.sql` nel SQL Editor.
3. Crea progetto Vercel collegato al repository.
4. Imposta le env:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
5. In Supabase > Authentication > Users crea 4 utenti:
   - 1 admin
   - 3 beta tester
6. Dopo aver creato l'admin, esegui:
   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'admin@example.com';
   ```
7. Avvia in locale:
   ```bash
   npm install
   npm run dev
   ```

## Rotte
- `/login`
- `/dashboard`
- `/livello/[slug]`
- `/quiz/[id]`
- `/admin`

## Nota
Questa base e pensata per partire rapidamente. Per la v0.2 conviene aggiungere:
- editor completo per modificare quiz e opzioni
- analytics
- notifiche
- revisione adattiva
