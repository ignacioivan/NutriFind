-- NutriFind: Esquema de perfiles de usuario + autogestión (cambio de datos y baja de cuenta)
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- NO modifica productos_demo, productos_integrales ni sources.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 80),
  dietary_priority text not null default 'sin_gluten' check (dietary_priority in ('sin_gluten')),
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfiles de usuario vinculados 1:1 a auth.users con borrado en cascada.';

-- 1. Mínimo privilegio: bloquear rol anónimo y habilitar solo a usuarios autenticados
revoke all on table public.profiles from anon;
revoke all on table public.profiles from public;
grant select, update, delete on table public.profiles to authenticated;

-- 2. Row Level Security (RLS) estricto: cada usuario solo ve/edita/borra su propia fila
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

-- 3. Actualizar updated_at automáticamente al editar el perfil
create or replace function public.set_profile_updated_at()
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
  for each row
  execute function public.set_profile_updated_at();

-- 4. Sincronización automática desde auth.users (al crear cuenta o al cambiar nombre/correo)
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_priority text;
begin
  v_name := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  if char_length(v_name) < 2 then
    v_name := 'Usuario NutriFind';
  elsif char_length(v_name) > 80 then
    v_name := left(v_name, 80);
  end if;

  v_priority := coalesce(new.raw_user_meta_data ->> 'dietary_priority', 'sin_gluten');
  if v_priority not in ('sin_gluten') then
    v_priority := 'sin_gluten';
  end if;

  insert into public.profiles (id, email, full_name, dietary_priority)
  values (new.id, coalesce(new.email, ''), v_name, v_priority)
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        dietary_priority = excluded.dietary_priority,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_synced on auth.users;
create trigger on_auth_user_synced
  after insert or update of email, raw_user_meta_data on auth.users
  for each row
  execute function public.sync_profile_from_auth();

-- 5. Función RPC segura para el futuro botón "Eliminar mi cuenta" (sin exponer service_role key)
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- Al borrar de auth.users, ON DELETE CASCADE elimina automáticamente public.profiles y futuras listas_compras
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
