# Cómo contribuir

¡Gracias por querer ayudar! El proyecto está en español (código,
comentarios, documentación y mensajes de commit); mantengámoslo así.

## Antes de empezar

1. Levanta el proyecto en local siguiendo el [`README.md`](README.md)
   (`npm run seed:demo` te da datos para probar, y sin SMTP el enlace de
   login sale en la terminal).
2. Lee [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y
   [`docs/BASE-DE-DATOS.md`](docs/BASE-DE-DATOS.md).
3. **Next.js 16 no es el Next.js que conoces**: antes de usar una API,
   revisa su guía en `node_modules/next/dist/docs/` (ver
   [`AGENTS.md`](AGENTS.md)).
4. Para algo grande, abre primero un issue para platicarlo.

## Flujo

La rama `main` está protegida: nadie (ni quien mantiene el proyecto)
puede subir cambios directo a ella. Todo entra por pull request, y solo
se puede unir cuando el CI (el check `verificar`) pasa en verde. Se une
con **Squash and merge**, así que cada PR queda como un solo commit en
`main`; no te preocupes por limpiar tu historial.

### 1. Haz fork y clónalo (una sola vez)

En GitHub, botón **Fork**. Luego:

```bash
git clone git@github.com:<tu-usuario>/wygh-public.git
cd wygh-public
git remote add upstream git@github.com:rominavc99/wygh-public.git
```

`origin` es tu fork; `upstream` es el repo original.

### 2. Crea una rama desde `main` al día

```bash
git switch main
git pull upstream main
git switch -c fix/descripcion-corta      # o feat/…, docs/…
```

### 3. Haz tu cambio y verifícalo

Commits chicos y descriptivos, en español. Antes de abrir el PR, que pase
todo esto (es lo mismo que corre el CI):

```bash
npm run lint
npm run typecheck
npm run build
```

No hay tests automatizados todavía: además de lo anterior, pruébalo a
mano (`npm run dev`, con `npm run seed:demo` para tener datos). Si
quieres agregar tests, ¡bienvenidos!

### 4. Sube la rama y abre el pull request

```bash
git push -u origin fix/descripcion-corta
```

GitHub te muestra un botón para abrir el PR contra `main` del repo
original. Llena la plantilla: qué cambia, por qué y cómo lo probaste
(capturas si toca la interfaz o el correo).

### 5. Si te piden cambios

Haz los commits en la misma rama y vuelve a hacer `git push`: el PR se
actualiza solo. Si `main` avanzó mientras tanto y hay conflictos:

```bash
git fetch upstream
git merge upstream/main     # resuelve los conflictos, commit y push
```

### Para la siguiente contribución

```bash
git switch main
git pull upstream main
git switch -c feat/otra-cosa
```

## Convenciones

- **Comentarios que expliquen el porqué**, no el qué — sobre todo
  decisiones no obvias o bugs reales que motivaron algo. Mira cómo están
  comentados los archivos existentes.
- **Validación en el servidor** con Zod en todo formulario/Server Action,
  y `requireUser()` / `requireAdmin()` al inicio de cada acción.
- **Nada de HTML de usuario sin escapar en los correos** (`escapeHtml()`).
- **Cambios al modelo de datos**: edita `prisma/schema.prisma` y agrega
  una migración en `prisma/migrations/`. En SQLite, para columnas nuevas
  prefiere escribir `ALTER TABLE … ADD COLUMN` a mano (el `migrate diff`
  a veces propone recrear la tabla). Actualiza `docs/BASE-DE-DATOS.md`.
- **El correo se ve siempre en modo claro** a propósito (ver
  `docs/ARQUITECTURA.md`); no intentes un modo oscuro sin platicarlo.
- Nunca subas `.env`, `data/` ni fotos reales.

## Código de conducta

Sé amable. Críticas al código, nunca a las personas.
