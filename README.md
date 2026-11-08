# NutriFind

> Repositorio principal para la documentación y seguimiento de nuestro progreso dentro del proyecto Capstone.

---

### Nombre del proyecto

**NutriFind**

### Descripción

**NutriFind** es una plataforma web diseñada para optimizar el tiempo de búsqueda y ayudar a cuidar el presupuesto de sus usuarios.

Nuestro objetivo es facilitar la búsqueda de productos para quienes desean cambiar sus hábitos alimenticios, ya sea por motivos de salud o por decisión personal, permitiendo encontrar y comparar distintas opciones de manera rápida y sencilla.

---

### Tecnologías

Para la creación de la plataforma utilizaremos diversas tecnologías, seleccionadas con el objetivo de mantener un ecosistema ligero, moderno y amigable para el desarrollo.

#### Lenguajes

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=py,html,js,ts&theme=light" />
  </a>
</div>

#### Frameworks

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=astro,tailwindcss,react&theme=light" />
  </a>
</div>

#### Base de datos e infraestructura

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=postgresql,supabase,cloudflare&theme=light" />
  </a>
</div>

---

### Instrucciones para su ejecución local

---

### Integrantes del equipo y sus roles

| Integrantes        | Roles                               |
| :----------------- | :---------------------------------- |
| **Iván Sepulveda** | Full-Stack Developer                |
| **Martín Muñoz**   | Data Engineer / Backend & Scraping  |
| **Pedro Mallea**   | Jefe de Proyecto / Gestión de datos |

---

### Metodología de trabajo

El desarrollo de **NutriFind** se gestiona bajo la **Metodología Ágil Scrum**, estructurando el ciclo de vida del proyecto en **5 Sprints** iterativos e incrementales para asegurar entregas continuas de valor y adaptación temprana:

- **Product Backlog y Estimación:** Los requerimientos se desglosan en **Historias de Usuario (HU)** priorizadas según el valor entregado al consumidor (método *MoSCoW*) y estimadas en equipo utilizando puntos de historia bajo la escala **Fibonacci**.

- **Criterios de Aceptación y Calidad (DoD):** Cada historia de usuario cuenta con escenarios de validación estructurados (*Dado / Cuando / Entonces*) y una **Definition of Done (DoD)** dual (de negocio y técnica) que exige código versionado en GitHub, datos normalizados en **Supabase** e interfaz responsiva antes de dar una tarea por terminada.

- **Roles y Seguimiento Colaborativo:** El trabajo se coordina dividiendo responsabilidades claras entre **Gestión de Proyecto y Datos**, **Ingeniería de Datos / Web Scraping** y **Desarrollo Full-Stack / Infraestructura**, realizando revisiones de avance por Sprint.

---

### Arquitectura

**NutriFind** implementa una **arquitectura en capas** desacoplada para garantizar escalabilidad, rendimiento y facilidad de mantenimiento:

<div align="center">
  <img width="1497" height="428" alt="capas horizontal" src="https://github.com/user-attachments/assets/27f63e0f-2054-425f-be41-6591a1dc65d5" />
</div>

> **Nota (estado actual):** el diagrama muestra el diseño inicial. En la implementación vigente no existe la API FastAPI, el scraping usa cloudscraper (no Playwright) y el despliegue es en Cloudflare Workers (no Pages).

#### ¿Cómo funciona el flujo dentro del diagrama?

Para entender el recorrido de la información de principio a fin, el gráfico se divide en **dos flujos principales** que convergen en la base de datos:

1. **Flujo de Consulta del Usuario (Izquierda a Derecha):**
   - El **Usuario** accede desde su navegador a la aplicación desplegada en **Cloudflare Workers**.
   - Interactúa con el **Frontend ('NutriCode')**, construido en **Astro 7** (renderizado en servidor) y **Tailwind CSS v4**: inicio, resultados con filtros de precio y paginación, y ficha de producto. El buscador con sugerencias en vivo es una isla interactiva en **React 19**. El comparador de precios y los gráficos de evolución están planificados para el Sprint 4.
   - Al realizar una búsqueda, las páginas y el endpoint `/api/productos` consultan la API REST (PostgREST) de **Supabase (PostgreSQL)** a través de una única capa de datos (`src/lib/products.ts`). No existe una API intermedia en FastAPI.

2. **Flujo de Extracción (Abajo / Derecha hacia Base de Datos):**
   - De forma **manual** por ahora (sin scheduler), los scripts de Python en `NutriCode/scrapers/` descargan con **cloudscraper** y **BeautifulSoup4** el catálogo sin gluten de **Lider.cl**, recorriendo las páginas hasta que no aparecen productos nuevos.
   - Los datos pasan por una normalización en Python (precio a entero en CLP y deduplicación por nombre con **polars**) y se cargan en la tabla `productos_demo` de **Supabase** mediante *upsert* por `nombre`. Planificado: más tiendas, ejecución programada, `productos_integrales`, historial de precios y atributos nutricionales en `JSONB`.