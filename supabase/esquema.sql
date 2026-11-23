-- Pega todo este archivo en Supabase → SQL Editor → New query → Run.
-- Crea las dos tablas de la app y las reglas para que SOLO tú puedas ver tus datos.

create table if not exists public.movimientos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated timestamptz not null default now()
);
create index if not exists movimientos_user_server_idx on public.movimientos (user_id, server_updated);

create table if not exists public.config (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at bigint not null,
  server_updated timestamptz not null default now()
);

-- Marca la hora del servidor en cada cambio (sirve para saber qué falta sincronizar).
create or replace function public.tocar_server_updated() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_updated = now();
  return new;
end $$;

drop trigger if exists movimientos_tocar on public.movimientos;
create trigger movimientos_tocar before insert or update on public.movimientos
  for each row execute function public.tocar_server_updated();
drop trigger if exists config_tocar on public.config;
create trigger config_tocar before insert or update on public.config
  for each row execute function public.tocar_server_updated();

-- Permite a los usuarios con sesión usar las tablas desde la app (los proyectos nuevos no lo hacen solos).
grant select, insert, update, delete on table public.movimientos to authenticated;
grant select, insert, update, delete on table public.config to authenticated;

-- Seguridad: cada usuario solo ve y modifica sus propias filas.
alter table public.movimientos enable row level security;
alter table public.config enable row level security;

drop policy if exists "solo mis movimientos" on public.movimientos;
create policy "solo mis movimientos" on public.movimientos
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "solo mi config" on public.config;
create policy "solo mi config" on public.config
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
