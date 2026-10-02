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

1. Haz fork y crea una rama desde `main` (`feat/…`, `fix/…`).
2. Haz tu cambio con commits chicos y descriptivos.
3. Antes de abrir el PR, que pase todo esto (es lo mismo que corre el CI):
   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```
4. Abre el PR contra `main` explicando qué cambia, por qué y cómo lo
   probaste (capturas si toca la interfaz o el correo).

No hay tests automatizados todavía: la verificación es typecheck, lint,
build y probarlo a mano. Si quieres agregar tests, ¡bienvenidos!

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
