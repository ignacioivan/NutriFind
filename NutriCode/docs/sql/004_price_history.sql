-- =============================================================================
-- NutriFind — Tabla public.historial_precios + Trigger Automático de Scraping
-- Ejecutar en Supabase SQL Editor bloque por bloque (Bloque 1 -> Bloque 2 -> Bloque 3)
-- =============================================================================

-- =============================================================================
-- BLOQUE 1: Tabla public.historial_precios + Carga inicial desde productos_demo
-- Nota: product_id guarda el id del producto sin FK rígida para no bloquear
-- los scrapers de Martín ni futuras recargas de catálogo.
-- =============================================================================
create table if not exists public.historial_precios (
  id_historial bigint generated always as identity primary key,
  product_id bigint not null check (product_id > 0),
  tienda text not null default 'Lider' check (char_length(trim(tienda)) between 1 and 60),
  precio_registrado integer not null check (precio_registrado >= 0),
  disponible boolean not null default true,
  fecha_captura timestamptz not null default now()
);

create index if not exists idx_historial_precios_product_fecha
  on public.historial_precios(product_id, fecha_captura asc);

-- Poblar la 1ª captura histórica para todos los productos actuales en productos_demo
insert into public.historial_precios (product_id, tienda, precio_registrado, disponible, fecha_captura)
select
  p.id,
  coalesce(nullif(trim(p.supermercado), ''), 'Lider'),
  p.precio,
  true,
  coalesce(p.created_at, now())
from public.productos_demo p
where p.precio is not null
  and not exists (
    select 1
    from public.historial_precios h
    where h.product_id = p.id
  );


-- =============================================================================
-- BLOQUE 2: Permisos de Mínimo Privilegio + RLS (Lectura pública de catálogo)
-- =============================================================================
revoke all on table public.historial_precios from anon;
revoke all on table public.historial_precios from public;
revoke all on table public.historial_precios from authenticated;

grant select on table public.historial_precios to anon, authenticated;

alter table public.historial_precios enable row level security;

drop policy if exists "Public can read price history" on public.historial_precios;
create policy "Public can read price history"
  on public.historial_precios
  for select
  to anon, authenticated
  using (true);


-- =============================================================================
-- BLOQUE 3: Trigger automático al ejecutar el scraper sobre productos_demo
-- Cada vez que el scraper inserte un producto o actualice su fila, guarda el
-- precio en historial_precios si cambió el precio o si pasaron +12h desde la
-- última captura de ese producto.
-- =============================================================================
create or replace function public.record_product_price_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_price integer;
  v_last_date timestamptz;
begin
  if new.precio is null or new.precio < 0 then
    return new;
  end if;

  select h.precio_registrado, h.fecha_captura
    into v_last_price, v_last_date
  from public.historial_precios h
  where h.product_id = new.id
  order by h.fecha_captura desc
  limit 1;

  -- Registrar si es primera vez, si el precio varió, o si es un nuevo barrido (>12h)
  if v_last_price is null
     or v_last_price <> new.precio
     or v_last_date < (now() - interval '12 hours') then
    insert into public.historial_precios (
      product_id,
      tienda,
      precio_registrado,
      disponible,
      fecha_captura
    )
    values (
      new.id,
      coalesce(nullif(trim(new.supermercado), ''), 'Lider'),
      new.precio,
      true,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_productos_demo_price_history on public.productos_demo;
create trigger trg_productos_demo_price_history
  after insert or update on public.productos_demo
  for each row
  execute function public.record_product_price_history();
