-- =============================================================================
-- NutriFind · 005_dev_user_cleanup.sql
-- Propósito:
--   1. Re-sincronizar cualquier usuario de auth.users que haya quedado sin fila
--      en public.profiles tras borrar filas manualmente en Table Editor.
--   2. Asegurar que listas_compras y listas_compras_items apunten a auth.users(id)
--      ON DELETE CASCADE.
--   3. Habilitar la función RPC public.admin_reset_demo_user(target_email) para
--      poder borrar usuarios de prueba (auth.users + profiles + listas) en 1 clic
--      desde el panel de desarrollo (/archify/presentacion.html).
-- =============================================================================

-- 1. Reparar perfiles faltantes y asegurar FKs hacia auth.users(id)
insert into public.profiles (id, email, full_name, dietary_priority)
select
  u.id,
  coalesce(u.email, ''),
  case
    when char_length(trim(coalesce(u.raw_user_meta_data ->> 'full_name', ''))) >= 2
      then left(trim(u.raw_user_meta_data ->> 'full_name'), 80)
    else 'Usuario NutriFind'
  end,
  'sin_gluten'
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      updated_at = now();

alter table public.listas_compras
  drop constraint if exists listas_compras_user_id_fkey;

alter table public.listas_compras
  add constraint listas_compras_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.listas_compras_items
  drop constraint if exists listas_compras_items_user_id_fkey;

alter table public.listas_compras_items
  add constraint listas_compras_items_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 2. Función RPC para listar correos registrados en el panel de pruebas (dev)
create or replace function public.dev_list_registered_users()
returns table (
  id uuid,
  email text,
  full_name text,
  email_confirmed boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    coalesce(u.email, '')::text as email,
    coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', 'Sin nombre')::text as full_name,
    (u.email_confirmed_at is not null) as email_confirmed,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc
  limit 25;
$$;

revoke all on function public.dev_list_registered_users() from public;
grant execute on function public.dev_list_registered_users() to anon, authenticated;

-- 3. Función RPC para purgar un usuario de prueba por correo (borra auth.users + profiles + listas en cascada)
create or replace function public.admin_reset_demo_user(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_clean text := lower(trim(coalesce(target_email, '')));
  v_deleted_count int := 0;
begin
  if v_clean = '' then
    return jsonb_build_object('ok', false, 'deleted', 0, 'message', 'Correo vacío');
  end if;

  with deleted_rows as (
    delete from auth.users
    where lower(email) = v_clean
    returning id
  )
  select count(*) into v_deleted_count from deleted_rows;

  -- Por seguridad también limpiamos huérfanos en public.profiles si existieran
  delete from public.profiles where lower(email) = v_clean;

  return jsonb_build_object(
    'ok', true,
    'deleted', v_deleted_count,
    'email', v_clean
  );
end;
$$;

revoke all on function public.admin_reset_demo_user(text) from public;
grant execute on function public.admin_reset_demo_user(text) to anon, authenticated;
