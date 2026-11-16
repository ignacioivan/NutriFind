-- =============================================================================
-- NutriFind — Reparación de Foreign Keys de Listas + Backfill de Perfiles
-- Ejecutar en Supabase SQL Editor (puede ejecutarse completo o por bloques)
-- =============================================================================

-- =============================================================================
-- BLOQUE 1: Sincronizar retroactivamente usuarios existentes hacia public.profiles
-- Soluciona cuentas creadas en auth.users antes de que existiera el trigger.
-- =============================================================================
insert into public.profiles (id, email, full_name, dietary_priority)
select
  u.id,
  coalesce(u.email, ''),
  case
    when char_length(trim(coalesce(u.raw_user_meta_data ->> 'full_name', ''))) between 2 and 80
      then trim(u.raw_user_meta_data ->> 'full_name')
    else 'Usuario NutriFind'
  end,
  'sin_gluten'
from auth.users u
on conflict (id) do nothing;


-- =============================================================================
-- BLOQUE 2: Apuntar FK de listas_compras y listas_compras_items directo a auth.users(id)
-- Mantiene ON DELETE CASCADE al eliminar la cuenta, sin fallar si falta fila en profiles.
-- =============================================================================
alter table public.listas_compras
  drop constraint if exists listas_compras_user_id_fkey,
  add constraint listas_compras_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.listas_compras_items
  drop constraint if exists listas_compras_items_user_id_fkey,
  add constraint listas_compras_items_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;


-- =============================================================================
-- BLOQUE 3: Reasegurar permisos GRANT y políticas RLS de INSERT para authenticated
-- =============================================================================
grant select, insert, update, delete on table public.listas_compras to authenticated;
grant select, insert, update, delete on table public.listas_compras_items to authenticated;

drop policy if exists "Users can create own shopping lists" on public.listas_compras;
create policy "Users can create own shopping lists"
  on public.listas_compras for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can insert own list items" on public.listas_compras_items;
create policy "Users can insert own list items"
  on public.listas_compras_items for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.listas_compras l
      where l.id = lista_id and l.user_id = auth.uid()
    )
  );
