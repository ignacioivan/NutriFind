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
    <img src="https://skillicons.dev/icons?i=astro,tailwindcss,fastapi&theme=light" />
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

El desarrollo de **NutriFind** se gestiona bajo la **Metodología Ágil Scrum**, estructurando el ciclo de vida del proyecto en **5 Sprinst** iterativos e incrementales para asegurar entregas continuas de valor y adaptación temprana:

- **Product Backlog y Estimación:** Los requerimientos se desglosan en **Historias de Usuario (HU)** priorizadas según el valor entregado al consumidor (método *MoSCoW* y estimadas en equipo utilizando puntos de historia bajo la escala **Fibonacci**.

- **Criterios de Aceptación y Calidad (DoD):** Cada historia de usuario cuenta con escenarios de vlaidación estructurados (*Dado / Cuando / Entonces*) y una **Definition of Done (DoD)** dual (de negocio y técnica) que exige código versionado en GitHub, datos normalizados en **Supabase** e interfaz responsiva antes de dar una tarea por terminada.

- **Roles y Seguimiento Colaborativo:** El trabajo se coordina dividiendo responsabilidades claras entre **Gestión de Proyecto y Datos**, **Ingeniería de Datos / Web Scraping** y **Desarrollo Full-Stock / Infraestructura**, realizando revisiones de avance por Sprint.

---

### Arquitectura

**NutriFind** implementa una **arquitectura en capas** desacoplada para garantizar escalabilidad, rendimiento y facilidad de mantenimiento:

<div align="center">
  <img width="1497" height="428" alt="capas horizontal" src="https://github.com/user-attachments/assets/27f63e0f-2054-425f-be41-6591a1dc65d5" />
</div>

#### ¿Cómo funciona el flujo dentro del diagrama?

Para entender el recorrido de la información de principio a fin, el gráfico se divide en **dos flujos principales** que convergen en la base de datos:

1. **FLujo e Consulta del Usuario (Izquierda a Derecha):**
   - El **Usuario** accede desde su navegador pasando por la capa de seguridad y CDN de **Cloudflare Pages**
   - Interactúa con el **Frontend ('NutriCode')**, contruido en **Astro 7** y **Tailwind CSS v4**
   para las vistas principaes, buscador y comparador, junto con islas interactivas en **React 19** para visualizar los gráficos de evolución de precios.
   - Al realizar una búsqueda o aplicar filtros dietéticos, el Frontend consulta mediante peticiones HTTP/JSON a la **API RESTful en FastAPI**, la cual filtra y retorna los datos almacenados en **Supabase (PostgreSQL)**.

2. **Flujo de Extracción Automatizada (Abajo / derecha hacia Base de Datos):**
   - De forma programada e independientes al usuario, el **Motor de Web Scraping** (**Playwright + BeautifulSoup4**) navega por lossitios web de **Supermercados y Tiendas Especializadas**.
   - Los datos crudos extraídos pasan por un **Pipeline de Normalización** en Python (limpieza de texto, estandrización de precios en '$ CLP' y clasificación de etiquetas nutricionales en formato 'JSONB') antes de actualizar el catálogo ('productos_integrales') y el registro histórico de precios en **Supabase**.

---