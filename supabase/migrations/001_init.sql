create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  role text not null default 'student' check (role in ('admin', 'student')),
  total_xp integer not null default 0,
  current_streak integer not null default 0,
  last_activity_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  difficulty text not null,
  sort_order integer not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  prompt text not null,
  explanation text,
  sort_order integer not null,
  xp_reward integer not null default 10,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  selected_option_id uuid references public.quiz_options(id) on delete set null,
  is_correct boolean not null default false,
  earned_xp integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_level_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  completed_quizzes integer not null default 0,
  xp_earned integer not null default 0,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, level_id)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  icon text,
  trigger_type text not null,
  trigger_value text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_levels_updated_at on public.levels;
create trigger trg_levels_updated_at
before update on public.levels
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_quizzes_updated_at on public.quizzes;
create trigger trg_quizzes_updated_at
before update on public.quizzes
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_user_level_progress_updated_at on public.user_level_progress;
create trigger trg_user_level_progress_updated_at
before update on public.user_level_progress
for each row execute procedure public.set_updated_at();

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.levels enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_options enable row level security;
alter table public.user_quiz_attempts enable row level security;
alter table public.user_level_progress enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

create policy "profiles select own or admin"
on public.profiles
for select
using (auth.uid() = id or public.is_admin());

create policy "profiles update own or admin"
on public.profiles
for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "profiles insert admin only"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy "levels read published"
on public.levels
for select
to authenticated
using (is_published = true or public.is_admin());

create policy "levels admin all"
on public.levels
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "quizzes read published"
on public.quizzes
for select
to authenticated
using (is_published = true or public.is_admin());

create policy "quizzes admin all"
on public.quizzes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "quiz options read published through quiz"
on public.quiz_options
for select
to authenticated
using (
  exists (
    select 1
    from public.quizzes q
    where q.id = quiz_options.quiz_id
      and (q.is_published = true or public.is_admin())
  )
);

create policy "quiz options admin all"
on public.quiz_options
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "attempts own rows"
on public.user_quiz_attempts
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "attempts insert own rows"
on public.user_quiz_attempts
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin());

create policy "progress own rows"
on public.user_level_progress
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "progress upsert own rows"
on public.user_level_progress
for all
to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

create policy "badges read active"
on public.badges
for select
to authenticated
using (is_active = true or public.is_admin());

create policy "badges admin all"
on public.badges
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "user badges own rows"
on public.user_badges
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "user badges insert own rows"
on public.user_badges
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin());

insert into public.levels (title, slug, description, difficulty, sort_order, is_published)
values
  ('Fondamenti costituzionali', 'fondamenti-costituzionali', 'Nozioni base per partire senza blocchi.', 'base', 1, true),
  ('Procedimento amministrativo', 'procedimento-amministrativo', 'Competenze intermedie per capire atti e fasi.', 'intermedio', 2, true),
  ('Trasparenza e anticorruzione', 'trasparenza-e-anticorruzione', 'Livello avanzato con casi e norme chiave.', 'avanzato', 3, true)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  difficulty = excluded.difficulty,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published;

insert into public.badges (code, title, description, icon, trigger_type, trigger_value, is_active)
select 'level-1-complete', 'Fondamenta sbloccate', 'Hai completato il livello 1.', '🥉', 'level_completed', l.id::text, true
from public.levels l where l.slug = 'fondamenti-costituzionali'
on conflict (code) do nothing;

insert into public.badges (code, title, description, icon, trigger_type, trigger_value, is_active)
select 'level-2-complete', 'Procedura in marcia', 'Hai completato il livello 2.', '🥈', 'level_completed', l.id::text, true
from public.levels l where l.slug = 'procedimento-amministrativo'
on conflict (code) do nothing;

insert into public.badges (code, title, description, icon, trigger_type, trigger_value, is_active)
select 'level-3-complete', 'Pronto per il concorso', 'Hai completato il livello 3.', '🥇', 'level_completed', l.id::text, true
from public.levels l where l.slug = 'trasparenza-e-anticorruzione'
on conflict (code) do nothing;

with level_rows as (
  select id, slug from public.levels
)
insert into public.quizzes (level_id, prompt, explanation, sort_order, xp_reward, is_published)
select lr.id, q.prompt, q.explanation, q.sort_order, 10, true
from level_rows lr
join (
  values
    ('fondamenti-costituzionali', 'Placeholder quiz 1 - livello 1', 'Sostituisci con la spiegazione reale.', 1),
    ('fondamenti-costituzionali', 'Placeholder quiz 2 - livello 1', 'Sostituisci con la spiegazione reale.', 2),
    ('fondamenti-costituzionali', 'Placeholder quiz 3 - livello 1', 'Sostituisci con la spiegazione reale.', 3),
    ('fondamenti-costituzionali', 'Placeholder quiz 4 - livello 1', 'Sostituisci con la spiegazione reale.', 4),
    ('fondamenti-costituzionali', 'Placeholder quiz 5 - livello 1', 'Sostituisci con la spiegazione reale.', 5),
    ('procedimento-amministrativo', 'Placeholder quiz 1 - livello 2', 'Sostituisci con la spiegazione reale.', 1),
    ('procedimento-amministrativo', 'Placeholder quiz 2 - livello 2', 'Sostituisci con la spiegazione reale.', 2),
    ('procedimento-amministrativo', 'Placeholder quiz 3 - livello 2', 'Sostituisci con la spiegazione reale.', 3),
    ('procedimento-amministrativo', 'Placeholder quiz 4 - livello 2', 'Sostituisci con la spiegazione reale.', 4),
    ('procedimento-amministrativo', 'Placeholder quiz 5 - livello 2', 'Sostituisci con la spiegazione reale.', 5),
    ('trasparenza-e-anticorruzione', 'Placeholder quiz 1 - livello 3', 'Sostituisci con la spiegazione reale.', 1),
    ('trasparenza-e-anticorruzione', 'Placeholder quiz 2 - livello 3', 'Sostituisci con la spiegazione reale.', 2),
    ('trasparenza-e-anticorruzione', 'Placeholder quiz 3 - livello 3', 'Sostituisci con la spiegazione reale.', 3),
    ('trasparenza-e-anticorruzione', 'Placeholder quiz 4 - livello 3', 'Sostituisci con la spiegazione reale.', 4),
    ('trasparenza-e-anticorruzione', 'Placeholder quiz 5 - livello 3', 'Sostituisci con la spiegazione reale.', 5)
) as q(slug, prompt, explanation, sort_order)
  on q.slug = lr.slug
where not exists (
  select 1 from public.quizzes existing
  where existing.level_id = lr.id and existing.sort_order = q.sort_order
);

insert into public.quiz_options (quiz_id, option_text, is_correct, sort_order)
select q.id, opt.option_text, opt.is_correct, opt.sort_order
from public.quizzes q
join (
  values
    (1, 'Opzione A placeholder', false, 1),
    (1, 'Opzione B placeholder', true, 2),
    (1, 'Opzione C placeholder', false, 3),
    (1, 'Opzione D placeholder', false, 4),
    (2, 'Opzione A placeholder', false, 1),
    (2, 'Opzione B placeholder', true, 2),
    (2, 'Opzione C placeholder', false, 3),
    (2, 'Opzione D placeholder', false, 4),
    (3, 'Opzione A placeholder', false, 1),
    (3, 'Opzione B placeholder', true, 2),
    (3, 'Opzione C placeholder', false, 3),
    (3, 'Opzione D placeholder', false, 4),
    (4, 'Opzione A placeholder', false, 1),
    (4, 'Opzione B placeholder', true, 2),
    (4, 'Opzione C placeholder', false, 3),
    (4, 'Opzione D placeholder', false, 4),
    (5, 'Opzione A placeholder', false, 1),
    (5, 'Opzione B placeholder', true, 2),
    (5, 'Opzione C placeholder', false, 3),
    (5, 'Opzione D placeholder', false, 4)
) as opt(sort_order_match, option_text, is_correct, sort_order)
  on q.sort_order = opt.sort_order_match
where not exists (
  select 1 from public.quiz_options existing where existing.quiz_id = q.id
);
