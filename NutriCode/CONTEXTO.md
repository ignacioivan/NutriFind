# Contexto Maestro y Plan Estratégico: NutriFind

> Documento de contextualización integral para Agentes de IA y Desarrolladores. Contiene el estado real del repositorio, la arquitectura técnica, las metas de titulación (Capstone Duoc UC) y la hoja de ruta para maximizar el avance semanal.

---

## 1. Visión y Definición del Proyecto
- **Institución & Ramo:** Duoc UC – Escuela de Informática y Telecomunicaciones (Proyecto Capstone APT122).
- **Docente Guía:** Felipe Antonio Krauss.
- **Nombre:** NutriFind – Plataforma web de búsqueda y comparación de precios de alimentos especializados.
- **Problema de Negocio:** En Chile, los alimentos para dietas restringidas (sin gluten, sin lactosa, veganos, orgánicos, sin azúcar) presentan sobreprecios severos y catálogos dispersos en múltiples supermercados y tiendas.
- **Propuesta de Valor:** Un motor centralizado que extrae, normaliza y compara precios entre comercios (Lider, Jumbo, Tottus y tiendas de nicho), permitiendo filtrar por sellos dietéticos y redirigir al enlace oficial de compra.

### Equipo y División de Responsabilidades
| Integrante | Rol Oficial | Foco Operativo |
| :--- | :--- | :--- |
| **Iván Sepúlveda** | Full-Stack Developer | **Frontend (Astro + Tailwind v4 + React 19), UX/UI, Integración API y Despliegue.** |
| **Martín Muñoz** | Data Engineer | Backend, Web Scraping (Python, Playwright, Cloudscraper) y Normalización de datos. |
| **Pedro Mallea** | Jefe de Proyecto | Modelado relacional en Supabase, Gestión ágil, Actas de avance y Documentación. |

---

## 2. Arquitectura de Software y Base de Datos

### A. Frontend (`NutriCode/`)
- **Astro 5+:** Renderizado ultrarrápido y arquitectura de islas.
- **Tailwind CSS v4:** Motor de estilos vía `@tailwindcss/vite` (sin configuración JS obsoleta).
- **React 19:** Islas dinámicas (`client:load` / `client:visible`) para el buscador con filtrado en vivo, comparador de precios y gráficos de historial.
- **Despliegue:** Cloudflare Pages (CDN perimetral y HTTPS nativo).

### B. Backend & Extracción (`NutriCode/scrapers/`)
- **Web Scraping:** Python con `cloudscraper` (para bypass de Cloudflare en supermercados), `BeautifulSoup4` y `Playwright`.
- **API RESTful:** FastAPI exponiendo endpoints de consulta rápida hacia el frontend.

### C. Persistencia (Supabase / PostgreSQL)
1. `sources`: Tiendas y supermercados (`id`, `name`, `base_url`, `country`, `is_active`).
2. `productos_integrales`: Catálogo central (`id`, `source_id`, `nombre`, `marca`, `categoria`, `precio`, `moneda`='CLP', `descripcion`, `info_nutricional` [JSONB], `url_origen` [UNIQUE], `disponible`, `scraped_at`).
3. `historial_precios`: Trazabilidad (`id_historial`, `producto_id`, `precio_registrado`, `disponible`, `fecha_captura`).
4. `usuarios` & `listas_compras`: Perfiles con restricciones alimentarias y favoritos.

---

## 3. Estado Real del Repositorio y Avances Cumplidos

```text
[Sprint 1: Creado] -> [Sprint 2: Creado] -> [Sprint 3: EN PROCESO] -> [Sprint 4] -> [Sprint 5]
```

### Hitos Completados (Semanas 1 a 9)
- **HU-001 (Arquitectura Base):** Estructura del repositorio en `NutriCode/`, configuración de Astro + Tailwind v4 + React 19.
- **HU-002 (Modelo en Supabase):** Tablas creadas, llaves foráneas, índices por categoría y RLS activo (Revisado en Acta Semana 7).
- **HU-003 & HU-004 (Scrapers & Normalización):** Extracción funcional de catálogo de supermercados y pipeline de limpieza de precios y sellos JSONB (Aprobado en Acta Semana 9 con video demo).

### Estado de Código al Día de Hoy
- `NutriCode/src/components/Navbar.astro`: Barra de navegación responsive maquetada con la paleta de marca (Verde `#15803d` y Dorado `#d19d38`).
- `NutriCode/src/layouts/Layout.astro`: Shell base con navbar y footer listo.
- `NutriCode/src/pages/index.astro`: **Página de inicio vacía (pendiente de desarrollo de catálogo y buscador).**
- `NutriCode/scrapers/`: Scripts `scrapin.py` y `producs.py` funcionales con `cloudscraper`.

---

## 4. El Objetivo Actual: Sprint 3 (Semana 10 y 11)
El foco exclusivo de esta semana es conectar la información de Supabase/Scrapers con la interfaz gráfica de usuario:

### Tareas Críticas del Sprint 3
1. **HU-005 (8 Puntos): API RESTful de Consulta:**
   - Exponer endpoints en FastAPI o API Routes de Astro para servir el catálogo con paginación y búsqueda por texto (`/api/productos?q=...&categoria=...&tienda=...`).
2. **HU-006 (5 Puntos): Buscador Interactivo y Catálogo Frontend:**
   - **Hero Section:** Buscador central con autocompletado y botón de búsqueda rápida.
   - **Filtros Dietéticos (Badges/Pills):** `Sin Gluten`, `Vegano`, `Sin Lactosa`, `Orgánico`, `Sin Azúcar`.
   - **Grid de Productos (`ProductCard.astro` o isla React):**
     - Imagen del producto con fallback.
     - Título, marca y badge de la tienda de origen (`sources`).
     - Precio en `$ CLP` formateado con separador de miles.
     - Etiquetas nutricionales extraídas del campo `info_nutricional`.
     - Estado de stock (`disponible`).
     - Botón de compra que abre `url_origen` en pestaña nueva.

---

## 5. Hoja de Ruta para lo que Queda de Proyecto

### Sprint 4 (Próximas Semanas): Comparador y Dashboard
- **HU-007 (5 Puntos):** Vista comparativa multi-tienda (contrastar el mismo producto entre Lider vs. Jumbo vs. Tottus) con orden de menor a mayor precio.
- **HU-008 (8 Puntos):** Componente interactivo en React 19 para visualizar el gráfico de historial de precios y gestión de lista de compras futuras.

### Sprint 5 (Cierre y Titulación): Despliegue y Auditoría
- **HU-009 (5 Puntos):** Despliegue en Cloudflare Pages, auditoría de Core Web Vitals (LCP < 2.5s) y seguridad HTTPS con variables de entorno protegidas.
- **Entrega Final:** Informe Final APT, Acta final y video demostrativo completo.

---

## 6. Plan Táctico Semanal para Iván (Aprovechar la Semana al Máximo)

Para avanzar con máxima velocidad y sin bloqueos entre frontend y backend:

- **Día 1 (Lunes): UI Kit y Tarjeta de Producto**
  - Crear componente `ProductCard.astro` con diseño pulido en Tailwind v4 (sombras sutiles, badges dietéticos, precio destacado).
  - Diseñar el estado de carga (*skeleton loader*) y estado vacío (*empty state* "No se encontraron productos").
- **Día 2 (Martes): Filtros Dietéticos y Layout del Catálogo**
  - Diseñar la barra lateral o barra superior de filtros interactivos en `src/pages/index.astro`.
  - Agregar botones tipo *pill* para filtrado rápido: `Sin Gluten`, `Vegano`, `Sin Lactosa`, `Orgánico`.
- **Día 3 (Miércoles): Mock Data y Buscador Reactivo**
  - Crear un archivo de prueba `src/data/mockProducts.json` con 10 productos reales extraídos por el scraper para probar la UI sin depender de la red.
  - Implementar la isla React interactiva del buscador con debounce para búsquedas instantáneas.
- **Día 4 (Jueves): Integración Real con Supabase / API**
  - Conectar el buscador y catálogo con la base de datos Supabase o el endpoint de FastAPI.
  - Verificar tiempos de respuesta y manejo de errores de conexión.
- **Día 5 (Viernes): Control de Calidad y Acta Semanal**
  - Ejecutar `npx astro check` y resolver cualquier discrepancia de tipos TypeScript.
  - Capturar pantallas antes/después del catálogo para el portafolio personal.
  - Redactar el párrafo de evidencia en tercera persona para el Acta de Avance del docente Felipe Krauss.

---

## 7. Criterios de Aceptación Universitaria (Definition of Done)
Cualquier entrega de código debe cumplir con:
1. **Compilación Limpia:** Cero advertencias críticas en `astro check` y `npm run build`.
2. **Diseño Responsive:** Verificado en pantallas móviles (375px) y escritorio (1440px).
3. **No Slop:** Interfaces limpias, sin componentes genéricos de IA, contrastes legibles según norma WCAG AA.
4. **Trazabilidad:** Cada cambio relevante se asocia a su Historia de Usuario (HU-001 a HU-009) y se actualiza en la bitácora de `AGENTS.md`.
