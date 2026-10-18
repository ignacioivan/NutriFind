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

| Integrante         | Rol              |
| :----------------- | :--------------- |
| **Martín Muñoz**   | Data Engineer    |
| **Pedro Mallea**   | Jefe de Proyecto |
| **Iván Sepulveda** | Administrador    |

---

### Metodología de trabajo

---

### Arquitectura
  
**NutriFind** implementa una **arquitectura en capas** desacoplada para garantizar escalabilidad, rendimiento y facilidad de mantenimiento:

  1. **Capa de Presentación (Frontend & Edge):** Desarrollada con **Astro** y **Tailwind CSS** para una carga rápida y diseño responsivo, integrando componentes en **React** para el dashboard interactivo de precios. Desplegada y protegida perimetralmente mediante **Cloudflare Pages**.

  2. **Capa de Lógica de Negocio (Backend API):** API RESTful construida con **FastAPI (Python)**, encargada de gestionar la lógica de búsqueda, filtrado por restricciones alimentarias, perfiles de usuario, listas de compras y exposición de métricas.

  3. **Capa de Extracción y Procesamiento (Web Scraping):** Motor automatizado basado en **Playwright** y **BeautifulSoup** que extrae periódicamente el catálogo y precios desde distintos supermercados, aplicando un pipeline de limpieza y normalización antes de guardar los datos.
  4. **Capa de Persistencia (Base de Datos):** Base de datos relacional **PostgreSQL** alojada en **Supabase**, donde se centralizan los productos, tiendas, historial de precios y perfiles de usuarios.

---