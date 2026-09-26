-- INCREASE: tabelas e regras de acesso para o Supabase.
-- Cola tudo isto no Supabase em SQL Editor → New query → Run.

-- Nome de jogador de cada conta
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  created_at timestamptz not null default now()
);

-- Jogo gravado de cada jogador (o estado completo do jogo)
create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Ranking: um resumo público do jogo de cada jogador
create table if not exists public.scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  net_worth numeric not null default 0,
  title text,
  day int,
  city text,
  updated_at timestamptz not null default now()
);
create index if not exists scores_net_worth_idx on public.scores (net_worth desc);

-- Regras de acesso (Row Level Security): cada jogador só mexe nos seus dados
alter table public.profiles enable row level security;
alter table public.saves    enable row level security;
alter table public.scores   enable row level security;

drop policy if exists "nomes visíveis a todos" on public.profiles;
create policy "nomes visíveis a todos" on public.profiles for select using (true);
drop policy if exists "cada um edita o seu nome" on public.profiles;
create policy "cada um edita o seu nome" on public.profiles for update using (auth.uid() = id);

drop policy if exists "ver o próprio jogo" on public.saves;
create policy "ver o próprio jogo" on public.saves for select using (auth.uid() = user_id);
drop policy if exists "gravar o próprio jogo" on public.saves;
create policy "gravar o próprio jogo" on public.saves for insert with check (auth.uid() = user_id);
drop policy if exists "atualizar o próprio jogo" on public.saves;
create policy "atualizar o próprio jogo" on public.saves for update using (auth.uid() = user_id);

drop policy if exists "ranking visível a jogadores" on public.scores;
create policy "ranking visível a jogadores" on public.scores for select to authenticated using (true);
drop policy if exists "publicar a própria pontuação" on public.scores;
create policy "publicar a própria pontuação" on public.scores for insert with check (auth.uid() = user_id);
drop policy if exists "atualizar a própria pontuação" on public.scores;
create policy "atualizar a própria pontuação" on public.scores for update using (auth.uid() = user_id);

-- Quando alguém cria conta, guarda o nome de jogador que escolheu
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
