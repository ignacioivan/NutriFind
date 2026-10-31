# Directrices y Protocolo para Claude Code: NutriFind

> **Instrucción de Inicio para Claude Code:**
> 1. Al iniciar la sesión, lee inmediatamente `CONTEXTO_MAESTRO.md` para conocer el estado actual de los Sprints, las tablas de Supabase y el foco de trabajo de esta semana (Sprint 3: HU-005 y HU-006).
> 2. El usuario es **Iván Sepúlveda** (Full-Stack Developer y diseñador UI/UX del proyecto).
> 3. Trabaja con código limpio (anti-slop): sin librerías innecesarias, con Tailwind CSS v4 nativo y validando siempre tipos con `npx astro check`.

---

## 1. Contexto y Propósito del Proyecto
- **Nombre:** NutriFind (Proyecto Capstone / Tesis - APT122).
- **Propósito:** Plataforma web para comparar precios y disponibilidad de productos saludables, integrales y para dietas especiales (sin gluten, veganos, sin azúcar) en supermercados y tiendas especializadas en Chile.
- **Equipo y Roles:**
  - **Iván Sepúlveda (Usuario principal):** Full-Stack Developer, Diseño UI/UX y Frontend.
  - **Martín Muñoz:** Data Engineer, Backend & Web Scraping.
  - **Pedro Mallea:** Jefe de Proyecto & Modelado de Datos.

---

## 2. Arquitectura y Stack Tecnológico
> Consulta el archivo `CONTEXTO_MAESTRO.md` para el detalle exhaustivo del esquema de Supabase, las 9 Historias de Usuario (HU-001 a HU-009) y el plan táctico por Sprints.
Arquitectura desacoplada en tres capas principales:
1. **Frontend (`NutriCode/`):**
   - **Framework:** Astro 5+ con TypeScript y Vite.
   - **Estilos:** Tailwind CSS v4 (`@tailwindcss/vite`, importado en `src/styles/global.css`).
   - **Islas interactivas:** React 19 (`@astrojs/react`) para componentes dinámicos (filtros reactivos, comparador y gráficos).
   - **Despliegue previsto:** Cloudflare Pages.
2. **Backend & Extracción (`NutriCode/scrapers/`):**
   - Python con `cloudscraper`, `BeautifulSoup4` y `Playwright` para evadir antibots y extraer catálogos.
   - API RESTful en FastAPI para servir consultas al frontend.
3. **Base de Datos & Almacenamiento:**
   - **Supabase (PostgreSQL):** Tablas de catálogo (`productos_integrales`), historial de precios y atributos nutricionales en formato `JSONB`.

---

## 3. Reglas de Interacción para el Asistente (Torre de Control)
Toda IA que trabaje en este repositorio debe cumplir estrictamente estas reglas:

1. **Torre de Control (No actuar a ciegas):**
   - Antes de modificar código, explica en español el alcance, archivos que tocarás, dependencias y cómo se verificará el cambio.
   - Solicita confirmación antes de cambios estructurales, destructivos o de esquema.
2. **Anti-Slop y Código Limpio:**
   - Prohibido generar código genérico de plantilla, comentarios obvios o bibliotecas redundantes.
   - Mantén componentes modulares, nombres semánticos y CSS utility-first con Tailwind v4.
3. **Verificación Empírica Obligatoria:**
   - No des por terminado un cambio sin verificar su compilación o tipos (`npx astro check`, `npm run build` o ejecución del script Python).
   - Si la terminal arroja error, diagnostica la causa raíz antes de parchar al azar.
4. **Respeto a Git:**
   - No realizar commits forzados ni alterar ramas ajenas.
   - Usar commits atómicos y descriptivos (`feat:`, `fix:`, `refactor:`, `docs:`, `perf:`).

---

## 4. Estándar de Evidencias (Académico y Portafolio)
El proyecto requiere alimentar tanto las entregas universitarias (Actas en `.docx`) como el portafolio profesional en Astro del usuario (`https://portafolio-v2-34f.pages.dev/`).

### Estructura de Evidencia Técnica
Cada funcionalidad o ajuste relevante debe registrarse con la siguiente estructura:
- **Hito / Historia de Usuario:** Código o nombre del requerimiento (ej. `HU-03: Comparador de precios`).
- **Problema / Requerimiento:** Qué necesidad resuelve.
- **Solución Técnica:** Archivos modificados y decisiones de arquitectura (ej. uso de isla React vs. componente Astro estático).
- **Prueba de Funcionamiento:**
  - *Frontend:* Captura de pantalla o video del componente antes vs. después, validación responsive y contraste de color accesible.
  - *Scraping / Backend:* Muestra del JSON obtenido, tiempo de respuesta o conteo de registros insertados en Supabase.
- **Copiar a Acta Universitaria:** Al cerrar un avance, redactar un resumen breve en tercera persona (*"El estudiante implementó..."*) listo para transcribir al Word de la semana.

---

## 5. Comandos Frecuentes de Desarrollo
*(Nota para Claude Code: Si tu sesión está abierta en la raíz del repositorio, antepón `cd NutriCode && ...`)*

### Frontend (dentro de `NutriCode/`)
```bash
npm run dev                  # Servidor de desarrollo local (http://localhost:4321)
astro dev --background       # Iniciar dev server en segundo plano
astro dev logs               # Ver logs del dev server en segundo plano
astro dev stop               # Detener dev server
npx astro check              # Verificación estricta de TypeScript y componentes Astro
npm run build                # Compilación para producción (Cloudflare Pages)
```

### Scrapers / Python (dentro de `NutriCode/scrapers/`)
```bash
python3 producs.py           # Ejecución de scraper de productos
python3 scrapin.py           # Prueba de extracción con Cloudscraper + BS4
```

---

## 6. Registro Vivo de Estado y Checklist de Tareas

> Esta sección es la bitácora activa del proyecto. Actualízala cada vez que se inicie o concluya una tarea.

### Estado Actual: Fase 2 / Sprint Activo
- [x] Configuración inicial del entorno Astro + Tailwind CSS v4 + React 19.
- [x] Estructuración de scrapers base con Cloudscraper para catálogo de supermercados.
- [ ] Implementar vista de catálogo con tarjetas de productos y badges de dieta (`sin gluten`, `vegano`).
- [ ] Conectar frontend con Supabase / FastAPI para búsqueda en tiempo real.
- [ ] Crear isla React interactiva para la comparación visual de precios entre tiendas.
- [ ] Validación de accesibilidad (contraste, navegación por teclado y diseño mobile-first).

### Historial de Cambios Relevantes
- **[2026-10-30]**: Estandarización del repositorio y creación del documento maestro operativo `AGENTS.md`. Unificación de criterios de evidencia técnica y reglas anti-slop para agentes de IA.
