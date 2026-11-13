# NutriFind

> Plataforma web de búsqueda, indexación y comparación de precios de alimentos saludables y para dietas especializadas en Chile.

[![Production](https://img.shields.io/badge/Production-Live%20on%20Cloudflare%20Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white)](https://nutrifind.ignaacio-ivan.workers.dev)
[![Astro](https://img.shields.io/badge/Astro-7.4%20(SSR)-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Python](https://img.shields.io/badge/Python-3.11%20(Scrapers)-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)

**Proyecto Capstone (APT122)** · Escuela de Informática y Telecomunicaciones, Duoc UC  

---

### Descripción del Proyecto

**NutriFind** es una plataforma web diseñada para optimizar el tiempo de búsqueda y ayudar a cuidar el presupuesto de los consumidores que requieren alimentos especializados en Chile (enfermedad celíaca, intolerancias alimentarias o elecciones de salud).

En nuestro país, los productos de primera necesidad certificados sin gluten o sin alérgenos registran sobreprecios de hasta un **+270%** frente a alternativas convencionales, con catálogos dispersos entre distintos supermercados. Nuestro objetivo es centralizar la oferta, permitiendo encontrar y comparar precios de forma rápida, transparente y con redirección directa al comercio oficial.

---

### Tecnologías

Seleccionadas con el objetivo de mantener un ecosistema ligero, moderno y de alto rendimiento en el edge:

#### Lenguajes

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=py,html,js,ts&theme=light" />
  </a>
</div>

#### Frameworks y Librerías

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=astro,tailwindcss,react&theme=light" />
  </a>
</div>

#### Base de Datos e Infraestructura

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=postgresql,supabase,cloudflare&theme=light" />
  </a>
</div>

---

### Integrantes del Equipo y Roles

| Integrantes | Rol Oficial | Foco Operativo |
| :--- | :--- | :--- |
| **Iván Sepúlveda** | Full-Stack Developer | Frontend (Astro SSR + React 19), Diseño UI/UX "Etiqueta", API Routes y Despliegue en Cloudflare Workers. |
| **Martín Muñoz** | Data Engineer | Extracción de datos (Web Scraping en Python), bypass de firewalls y normalización ETL. |
| **Pedro Mallea** | Jefe de Proyecto | Modelado relacional en Supabase, Gestión ágil Scrum, Actas y Aseguramiento de Calidad. |

---

### Metodología de Trabajo

El desarrollo de **NutriFind** se gestiona bajo la metodología ágil **Scrum**, estructurando el ciclo de vida del proyecto en **5 Sprints** iterativos e incrementales:

- **Product Backlog y Estimación:** Requerimientos desglosados en **Historias de Usuario (HU-001 a HU-009)** priorizadas según valor de negocio (*MoSCoW*) y estimadas en equipo con escala **Fibonacci**.
- **Criterios de Aceptación y Calidad (DoD):** Escenarios estructurados (*Dado / Cuando / Entonces*) con Definition of Done dual: validación de tipos estricta (`npx astro check`), pruebas unitarias (`npm test`), accesibilidad WCAG 2.2 AA y datos normalizados en Supabase antes de cerrar cada tarea.
- **Seguimiento y Control:** Coordinación continua entre las áreas de Gestión, Scraping y Desarrollo Full-Stack con actas de control semanal y demostraciones en video.

---

### Arquitectura del Sistema

**NutriFind** implementa una **arquitectura en capas desacoplada** con procesamiento batch independiente y renderizado en el Edge:

<div align="center">
<img width="2616" height="1498" alt="capas horizontal" src="https://github.com/user-attachments/assets/34b531ea-1c02-41cb-8c38-8c3af10f6b36" />
</div>

> **Nota de evolución:** El diagrama original de arriba muestra el diseño conceptual inicial. En la implementación final en producción se eliminó la API intermedia de FastAPI, el scraping utiliza `cloudscraper` + `polars` (sin Playwright en runtime) y el despliegue corre en **Cloudflare Workers** (en lugar de Pages).

#### Flujos de Información en la Arquitectura Actual

El sistema opera bajo **dos flujos independientes** que convergen de forma segura en la base de datos:

1. **Flujo de Consulta Pública (Usuario -> Edge SSR -> Supabase):**
   - El usuario accede desde su navegador a la aplicación servida globalmente por **Cloudflare Workers**.
   - **Frontend ('NutriCode'):** Construido con **Astro 7.4** en modo SSR (`output: 'server'`). Renderiza en servidor las páginas de inicio, catálogo `/buscar` (con filtros de precio y paginación) y fichas de producto `/producto/[id]`.
   - **Buscador Reactivo:** Una isla interactiva en **React 19** (`live-search.tsx`, `client:idle`) consume el endpoint interno `/api/productos` con debounce de 200ms.
   - **Capa de Datos:** Las consultas pasan a través de `src/lib/products.ts` hacia el PostgREST de **Supabase (PostgreSQL)** sobre la tabla `productos_demo`, protegida con políticas RLS (*Row Level Security*) de solo lectura (`SELECT`).

2. **Flujo de Extracción e Ingesta (Scrapers Python -> Supabase):**
   - De ejecución periódica/manual, los scripts en `NutriCode/scrapers/` descargan con **cloudscraper** y **BeautifulSoup4** el catálogo de supermercados (iniciando con Lider.cl).
   - Los datos se limpian y normalizan con **polars** (precios en enteros CLP, marcas, unidades de medida y atributos) y se cargan a Supabase mediante *upsert* atómico por `nombre`.

#### Decisión Técnica: Descarte de FastAPI

Inicialmente se proyectó un microservicio separado en FastAPI. Durante el desarrollo del Sprint 3 se resolvió prescindir de él:
- **Menor latencia y saltos de red:** Astro SSR provee endpoints backend nativos (`export const GET: APIRoute`) ejecutados en la red perimetral de Cloudflare Workers, reduciendo tiempos de respuesta (TTFB).
- **Aprovechamiento de PostgREST:** Supabase expone una API REST directa y segura con RLS, eliminando la sobrecarga de mantener y costear un servidor backend intermediario redundante.

---

### Estructura del Repositorio

```text
NutriFind/
├── Actas Control de Avances/       # Documentación de gestión y actas semanales (Duoc UC)
├── NutriCode/                      # Aplicación web completa y pipeline de extracción
│   ├── public/                     # Activos estáticos, favicons y visores locales
│   │   └── archify/                # Visor unificado de diagramas y consola API de pruebas
│   ├── scrapers/                   # Pipeline ETL en Python (producs.py, prueba.py, scrapin.py)
│   ├── src/
│   │   ├── components/             # Componentes Astro y la isla React (live-search.tsx)
│   │   ├── lib/                    # Acceso a Supabase (products.ts), formateo y filtros
│   │   ├── pages/                  # Rutas SSR (index, /buscar, /producto/[id], /api/productos)
│   │   └── styles/                 # global.css con tokens @theme de Tailwind v4
│   ├── Dockerfile                  # Contenedor Node.js optimizado para desarrollo
│   ├── compose.yaml                # Orquestación con Docker Compose
│   └── wrangler.jsonc              # Manifiesto de despliegue en Cloudflare Workers
├── CONTEXTO.md                     # Bitácora estratégica, historias de usuario y sprint log
└── README.md                       # Documentación principal del repositorio
```

---

### Instalación y Ejecución Local

#### Prerrequisitos
- Node.js `>= 22.12.0`
- Python `>= 3.11` (para scrapers)

#### 1. Iniciar la aplicación web
```bash
cd NutriCode
npm install

# Iniciar servidor de desarrollo en http://localhost:4321
npm run dev
```

#### 2. Variables de entorno (`NutriCode/.env`)
```env
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_ANON_KEY="tu-anon-key-publica"
```

#### 3. Calidad y Tests
```bash
# Validación estricta de tipos TypeScript y componentes Astro
npx astro check

# Suite de pruebas unitarias nativas
npm test
```

#### 4. Ejecución con Docker (Opcional)
```bash
docker compose up --build
```
