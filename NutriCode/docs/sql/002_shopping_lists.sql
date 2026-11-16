-- =============================================================================
-- NutriFind — Esquema de Listas de Compras Personalizadas (Estilo Playlist)
-- Ejecutar en Supabase SQL Editor bloque por bloque (Bloque 1 -> Bloque 2 -> Bloque 3)
-- =============================================================================

-- =============================================================================
-- BLOQUE 1: Tabla public.listas_compras + Permisos + RLS (Cabeceras de listas)
-- =============================================================================
create table if not exists public.listas_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 60),
  descripcion text check (descripcion is null or char_length(trim(descripcion)) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listas_compras_user_id
  on public.listas_compras(user_id, created_at desc);

revoke all on table public.listas_compras from anon;
revoke all on table public.listas_compras from public;
grant select, insert, update, delete on table public.listas_compras to authenticated;

alter table public.listas_compras enable row level security;

drop policy if exists "Users can read own shopping lists" on public.listas_compras;
create policy "Users can read own shopping lists"
  on public.listas_compras for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own shopping lists" on public.listas_compras;
create policy "Users can create own shopping lists"
  on public.listas_compras for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own shopping lists" on public.listas_compras;
create policy "Users can update own shopping lists"
  on public.listas_compras for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own shopping lists" on public.listas_compras;
create policy "Users can delete own shopping lists"
  on public.listas_compras for delete to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- BLOQUE 2: Tabla public.listas_compras_items + Permisos + RLS (Productos)
-- Nota: product_id es bigint sin FK rígida a productos_demo para no bloquear
-- los scrapers de Martín ni la futura migración a productos_integrales.
-- =============================================================================
create table if not exists public.listas_compras_items (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.listas_compras(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null check (product_id > 0),
  quantity integer not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  unique (lista_id, product_id)
);

create index if not exists idx_listas_items_user_product
  on public.listas_compras_items(user_id, product_id);

create index if not exists idx_listas_items_lista_id
  on public.listas_compras_items(lista_id, created_at desc);

revoke all on table public.listas_compras_items from anon;
revoke all on table public.listas_compras_items from public;
grant select, insert, update, delete on table public.listas_compras_items to authenticated;

alter table public.listas_compras_items enable row level security;

drop policy if exists "Users can read own list items" on public.listas_compras_items;
create policy "Users can read own list items"
  on public.listas_compras_items for select to authenticated
  using (auth.uid() = user_id);

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

drop policy if exists "Users can update own list items" on public.listas_compras_items;
create policy "Users can update own list items"
  on public.listas_compras_items for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own list items" on public.listas_compras_items;
create policy "Users can delete own list items"
  on public.listas_compras_items for delete to authenticated
  using (auth.uid() = user_id);


-- =============================================================================
-- BLOQUE 3: Trigger automático updated_at en public.listas_compras
-- =============================================================================
drop trigger if exists trg_listas_compras_updated_at on public.listas_compras;
create trigger trg_listas_compras_updated_at
  before update on public.listas_compras
  for each row execute function public.set_profile_updated_at();
