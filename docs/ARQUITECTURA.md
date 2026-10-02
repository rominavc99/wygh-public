# Arquitectura

> Ver también: [`BASE-DE-DATOS.md`](./BASE-DE-DATOS.md) (modelo de datos)
> y [`DESPLIEGUE.md`](./DESPLIEGUE.md) (cómo hospedarlo). Este archivo
> explica el "cómo está construido".

## Qué es

Boletín diario y privado para un grupo cerrado de ~15-20 amigos. Cada
quien responde a diario "qué va a hacer al llegar a casa / a dónde va",
y una vez al día se manda un correo a todo el grupo con las respuestas.
En la web, además, se puede reaccionar y comentar las respuestas de los
demás. El día del cumpleaños de alguien sale un boletín extra para
felicitarle. Todo autoalojado en una PC personal, sin servicios de pago.

## Stack

| Capa | Tecnología | Notas |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Breaking changes reales vs. versiones anteriores — ver `AGENTS.md`, que apunta a `node_modules/next/dist/docs/`. `middleware.ts` ya no existe: es `proxy.ts` con función `proxy`. |
| Lenguaje | TypeScript | Estricto, sin `any` salvo un cast puntual documentado en `src/auth.ts`. |
| UI | React 19 + Tailwind CSS 4 | Estética "retro Windows/MSN Messenger + periódico" a propósito (ver `globals.css`). |
| ORM | Prisma 7 | **Requiere driver adapters**. Cliente generado en `src/generated/prisma` (gitignored). |
| Base de datos | SQLite | Archivo único `data/app.db`, gitignored. Adaptador `@prisma/adapter-better-sqlite3`. |
| Auth | Auth.js v5 (beta) | Enlace mágico por correo, sin contraseñas. Sesiones en base de datos. |
| Correo | Nodemailer sobre SMTP de Gmail | Transporte compartido con pool (`src/lib/mailer.ts`). |
| Imágenes | sharp | Valida las fotos subidas y las reduce para el correo. |
| Cron | `node-cron` | En `worker.ts`, revisa cada minuto qué toca enviar. |
| Procesos | PM2 | `newsletter-web`, `newsletter-worker`, `newsletter-deploy-watcher` y `cf-tunnel`. |
| Red pública | Cloudflare Tunnel | Sin puertos abiertos en el router. Pasa por el WAF de Cloudflare (ver "Fotos de las respuestas"). |
| Validación | Zod | En todos los formularios y Server Actions, del lado del servidor. |

## Estructura de carpetas

```
src/
  app/
    page.tsx, response-form.tsx, actions.ts   # Formulario diario (home) y su Server Action
    birthday-prompt.tsx         # Aviso "Agrega tu fecha de cumpleaños" en la home
    login/                       # Login sin contraseña (enlace mágico)
    perfil/                      # Autoservicio: apodo y fecha de cumpleaños
    mis-respuestas/              # Historial propio
    boletines/                   # Archivo de boletines enviados, interactivo (reacciones, comentarios)
    IMG/respuestas/[filename]/   # Sirve las fotos de respuestas, solo con sesión iniciada
    error.tsx, global-error.tsx, not-found.tsx
    admin/
      layout.tsx                 # Pestañas + chequeo de rol ADMIN (defensa en profundidad)
      respuestas/                 # Respuestas de cualquier día + quién falta
      usuarios/                   # Alta/edición, rol, activar/desactivar
      boletin/                    # Vista previa del boletín del día, foto/frase, envío manual
      fotos/                      # Catálogo de fotos de portada
      frases/                     # Catálogo de frases
      cumpleanos/                 # Próximos cumpleaños, vista previa/envío y ajustes del boletín de cumpleaños
      envios/                     # Historial de NewsletterSend, archivar
      comunicaciones/             # Correos sueltos a todos o a algunos, inmediatos o programados
      ajustes/                    # Nombre, horarios, remitente, portada…
  lib/
    prisma.ts, mailer.ts, site-url.ts, date.ts, pick.ts, display-name.ts, avatar.ts
    auth-guards.ts               # requireUser() / requireAdmin()
    rate-limit.ts                # Limitador en memoria (un solo proceso)
    user-schema.ts, response-schema.ts, communication-schema.ts   # Zod
    newsletter.ts                # Arma el boletín diario (HTML + texto) y piezas compartidas del correo
    send-newsletter.ts           # Envío del diario + deliverToActiveUsers() compartido
    birthday-newsletter.ts       # Arma el boletín de cumpleaños (foto, top 5)
    send-birthday.ts             # Envío del de cumpleaños
    send-reminder.ts, reminder-email.ts            # Recordatorio a quien no ha respondido
    send-communication.ts, communication-email.ts  # Comunicaciones del admin
    notify-admins.ts, communication-result-email.ts # Aviso a admins del resultado de una programada
    notify-interaction.ts, interaction-email.ts    # Aviso de reacción/comentario a tu respuesta o comentario
    hero-photos.ts               # Sincroniza public/IMG con HeroPhoto y elige la foto del día
    phrases.ts, response-phrases.ts                # Frase del día / frases aportadas en respuestas
    response-photos.ts           # Fotos de respuestas: validar, guardar, borrar
    prepare-photo.ts             # (navegador) Reduce la foto y la pasa a base64 antes de subirla
    reactions.ts                 # Agrupa reacciones por emoji con quién reaccionó
    emoji-data.ts                # Emojis rápidos, selector y emoticones ascii
    email-theme.ts               # Paleta del correo, modo claro forzado, escapeHtml
    rich-text.ts                 # Sanea el HTML del editor de comunicaciones
    migrate-response-photos.ts   # Migración de una vez (fotos que vivían en public/)
  auth.ts                        # Auth.js (provider, callbacks, sesión)
  proxy.ts                       # Protege /admin/* (antes middleware.ts)
  instrumentation.ts             # Corre la migración de fotos al arrancar
worker.ts                        # Proceso de envíos programados (cada minuto)
deploy-watcher.ts                # Auto-deploy opcional (ver DESPLIEGUE.md)
boot-check.ts                    # Correo al admin tras reiniciar la PC (ver DESPLIEGUE.md)
prisma/schema.prisma             # Modelo de datos
```

## Autenticación y autorización

- **Enlace mágico**: no hay contraseñas. La persona pide un enlace de un
  solo uso a su correo (`src/app/login`) y Auth.js lo manda vía Nodemailer.
- **Sin auto-registro**: solo puede entrar quien un admin dio de alta en
  `/admin/usuarios` y está activo.
  - `requestMagicLink` (`src/app/login/actions.ts`) lo revisa primero y,
    si el correo no está registrado o está desactivado, lo dice con un
    mensaje claro. (Antes se dejaba todo a Auth.js, que tronaba con
    `AccessDenied` y mostraba "Algo tronó, intenta de nuevo": la persona
    reintentaba hasta bloquearse.)
  - `callbacks.signIn` en `src/auth.ts` sigue siendo la barrera real.
- **Límite de intentos** (`src/lib/rate-limit.ts`, en memoria): 8 por IP
  y 5 por correo cada 10 minutos. La IP sale de `cf-connecting-ip` (la
  real detrás del túnel). Los intentos con correos no registrados no
  gastan el límite del correo, y al dar de alta, reactivar o corregir el
  correo de alguien se limpia su contador. Los contadores viven en
  `globalThis` para que el login y el panel de admin vean los mismos.
- **Sesiones en base de datos** (no JWT), de 90 días.
- **Roles**: `MEMBER` / `ADMIN`. `callbacks.session` agrega `id` y `role`
  a la sesión.
- **Protección en dos capas**:
  1. `src/proxy.ts` redirige a `/login` sin sesión, o a `/` si no es
     admin, en todo `/admin/*`.
  2. Cada Server Action vuelve a llamar `requireUser()` o
     `requireAdmin()` (`src/lib/auth-guards.ts`).

## La respuesta diaria

1. En `/` la persona llena el formulario (`src/app/response-form.tsx`).
   Hay cuatro flujos — llega a la hora normal, llega tarde, no llega, se
   quedó en casa — y cada uno pide campos distintos (reglas en
   `src/lib/response-schema.ts`). Opcionalmente agrega una foto con
   descripción y una frase para el catálogo.
2. Se guarda con la Server Action `saveResponse` (`src/app/actions.ts`)
   como `upsert` en `Response`, única por `(userId, date)`.
3. Si `Settings.lockResponsesAfterSend` está activo, una vez enviado el
   boletín del día ya no se puede editar.

### Fotos de las respuestas

- **Subida en base64, ya reducida**: al elegir la foto, el navegador la
  reduce (máx. 2000 px, JPEG; los GIF van tal cual) con
  `src/lib/prepare-photo.ts` y la manda como texto base64 en vez de como
  archivo. Motivo: el WAF de Cloudflare bloqueaba con un 403 algunas
  fotos subidas como binario, porque ciertos bytes de la imagen coinciden
  por azar con firmas de ataque; en base64 eso no puede pasar. De paso
  sube mucho más rápido con datos móviles.
- **Validación antes de guardar**: el servidor revisa tipo, tamaño (máx.
  5 MB) y que sharp la pueda leer, y solo la escribe a disco si el resto
  del formulario también es válido.
- **Privadas**: se guardan en `data/uploads/respuestas/`, fuera de
  `public/` a propósito. Todo lo que está en `public/` se sirve como
  estático sin pasar por la app, así que no se podría exigir sesión. Las
  sirve `src/app/IMG/respuestas/[filename]/route.ts`, solo con sesión
  iniciada.
- **En el correo** van incrustadas como adjuntos (`cid:`) y reducidas a
  800 px (`embedResponsePhotosAsAttachments` en `send-newsletter.ts`),
  porque un cliente de correo no manda cookies de sesión.
- También se dan de alta como `HeroPhoto`, así que entran a la rotación
  de portadas.

### Borrador en el dispositivo

Mientras se llena el formulario, lo escrito (incluida la foto ya
preparada) se guarda en `localStorage`, con una clave por usuario y
fecha. Si el envío falla (sin internet, un bloqueo), el formulario se
queda como estaba con un aviso, en vez de la pantalla de error; y si se
cierra o recarga la página, al volver aparece "Recuperamos lo que tenías
escrito". El borrador se borra al guardarse bien y los de días anteriores
se limpian solos.

El formulario no usa `<form action={...}>` a propósito: React 19 resetea
el formulario cada vez que se despacha esa acción, aunque el resultado
sea un error de validación. Se llama la acción a mano desde `onSubmit`,
lo que además permite atrapar fallos de red.

## Envíos programados (`worker.ts`)

Proceso PM2 aparte que cada minuto revisa:

| Qué | Cuándo | Función | Idempotencia |
|---|---|---|---|
| Boletín diario | `Settings.sendTime` (si `autoSend`) | `sendDailyNewsletter()` | `NewsletterSend.date` |
| Recordatorio a quien no ha respondido | 1 h antes de `sendTime` (si `reminderEnabled`) | `sendReminderIfNeeded()` | `ReminderSend.date` |
| Boletín de cumpleaños | `Settings.birthdaySendTime` (si `birthdayEnabled`) | `sendBirthdayNewsletter()` | `BirthdayNewsletter(userId, date)` |
| Comunicaciones programadas | cuando llega su `scheduledAt` | `sendCommunicationNow()` + aviso a admins | `Communication.status` |

Todo se manda solo a usuarios activos.

## El boletín diario

`buildNewsletter()` (`src/lib/newsletter.ts`) arma el HTML y el texto
plano:

- **Portada** (opcional, `/admin/ajustes`): título, párrafo, foto, frase
  del día y un enlace.
  - La foto y la frase del día se resuelven una vez y quedan fijas en
    `DailyPick` (ver `hero-photos.ts` y `phrases.ts`). Prioridad: la que
    eligió el admin, luego la que ya quedó fija, luego una "programada"
    para ese día, y si no, una al azar estable con `pickStable()`
    evitando repetir el evento del día anterior. Así la vista previa y el
    envío coinciden y la portada no cambia sola a media tarde.
  - Desde `/admin/boletin` se pueden elegir a mano o re-rolar.
- **Una tarjeta por respuesta del día**: avatar, nombre a mostrar
  (`displayName()`), plan, comida, nota y foto.
- El saludo se personaliza por destinatario (`personalizeGreeting()`).

Al enviarse, el contenido queda **congelado** en `NewsletterSend`
(`contentHtml`, `contentText`, `heroJson`): `/boletines` y el panel lo
muestran tal cual salió, aunque los Ajustes cambien después.

`renderEmailShell()`, `renderHero()`, `responseDetailsHtml()` y
`deliverToActiveUsers()` son piezas compartidas con el boletín de
cumpleaños.

### Decisión de diseño: modo claro forzado en el correo

Los clientes de correo (sobre todo Gmail/Outlook en Android) oscurecen el
HTML a nivel de píxel e ignoran las técnicas CSS habituales
(`color-scheme`, media queries, trucos con `background-image`). Tras
varias vueltas sin éxito, se decidió **forzar modo claro siempre** vía
`flatBg()` (`src/lib/email-theme.ts`). No volver a intentar un modo
oscuro por cliente sin que se pida explícitamente.

## Boletín de cumpleaños

Cada quien registra su fecha en `/perfil`, o en el aviso que aparece en
`/` mientras no la tenga y no haya elegido "Prefiero no decirlo". A
`Settings.birthdaySendTime` (09:00 por defecto) de su cumpleaños, el
worker manda a todos los activos un boletín extra
(`src/lib/birthday-newsletter.ts` + `src/lib/send-birthday.ts`):

- Mismo marco y remitente que el diario.
- Portada con una foto subida por quien cumple años (fija para ese día,
  elegible a mano o re-rolable desde `/admin/cumpleanos`), y título y
  párrafo configurables con `{nombre}` / `{NOMBRE}`.
- En vez de las respuestas del día, sus 5 respuestas del último año con
  más reacciones + comentarios, con fecha, reacciones y comentarios.
- El 29 de febrero se celebra el 28 en años no bisiestos
  (`birthdayInYear()` en `src/lib/date.ts`).
- Ya enviado, aparece en `/boletines` junto a los diarios con un badge 🎂
  (`?date=…&cumple=<userId>`). La portada y el top 5 salen del snapshot
  (`heroJson`, `momentsJson`), pero cada momento usa la tarjeta
  interactiva normal.

## `/boletines`: archivo interactivo

- Lista de boletines enviados (diarios y de cumpleaños), sin los que el
  admin archivó.
- Cada boletín muestra la portada congelada y las respuestas de ese día
  como tarjetas (`response-card.tsx`) donde se puede:
  - **Reaccionar** a la respuesta o a cualquier comentario
    (`reaction-bar.tsx`): emojis rápidos, selector completo y emoticones
    ascii. Repetir la misma reacción la quita.
  - **Ver quién reaccionó**: al pasar el mouse sobre una reacción, o con
    el botón 👥 en celular. `summarizeReactions()` (`src/lib/reactions.ts`)
    agrupa por emoji con los nombres.
  - **Comentar** (`comment-thread.tsx`), en un hilo plano.
- Cada reacción o comentario avisa por correo al dueño de la respuesta o
  del comentario (`notify-interaction.ts`), salvo que sea uno mismo o la
  persona esté desactivada. Es best-effort: si el correo falla, la
  reacción igual se guarda.
- Los menús emergentes (`popover.tsx`) se pintan en un portal con
  `position: fixed` para que el `overflow: hidden` del panel no los
  recorte, y se ajustan para no salirse de la pantalla en celular.

## Panel de administración (`/admin/*`)

Pestañas: Respuestas, Usuarios, Boletín, Fotos, Frases, Cumpleaños,
Envíos, Comunicaciones, Ajustes.

- **Usuarios**: alta/edición (nombre, correo, rol, apodo) y
  activar/desactivar. El `<select>` de rol se deshabilita en tu propia
  fila para no quitarte el admin por accidente; como un `<select
  disabled>` no viaja en el `FormData`, se reemplaza por un
  `<input type="hidden">` con el rol actual.
- **Boletín**: vista previa exacta del día (o de cualquier fecha), elegir
  o re-rolar foto y frase, envío manual o reenvío.
- **Fotos**: catálogo sincronizado con `public/IMG` más las fotos de
  respuestas; cada una puede llevar descripción y fecha programada.
- **Frases**: catálogo de frases; las que vienen de respuestas llegan con
  autor y fecha.
- **Cumpleaños**: próximos cumpleaños, vista previa/envío por persona y
  ajustes del boletín de cumpleaños.
- **Envíos**: historial de `NewsletterSend`; archivar oculta un boletín
  en `/boletines` sin borrarlo.
- **Comunicaciones**: correos sueltos con editor de texto enriquecido (el
  HTML se sanea en `rich-text.ts`), a todos o a personas elegidas, de
  inmediato o programados. De los programados, los admins reciben un
  correo con el resultado.
- **Ajustes**: nombre, lema, saludo, horarios, envío automático,
  recordatorio, bloqueo tras el envío, remitente y portada.

## Autoservicio del usuario

- **`/perfil`**: nombre y correo de solo lectura, apodo (`username`) y
  fecha de cumpleaños.
- **`/mis-respuestas`**: historial propio, día por día.

## Seguridad (resumen)

- Sin auto-registro; acceso solo para usuarios dados de alta y activos.
- Zod del lado del servidor en todos los formularios.
- Contenido de usuario escapado en la web (React) y en el correo
  (`escapeHtml()` manual). El HTML de comunicaciones se sanea.
- Fotos de respuestas privadas: fuera de `public/`, servidas solo con
  sesión, con nombre de archivo saneado contra path traversal.
- Rate limiting en memoria para enlaces mágicos, respuestas, reacciones y
  comentarios.
- Cabeceras de seguridad (CSP sin orígenes externos, `X-Frame-Options`,
  etc.) en `next.config.ts`. La CSP no permite `blob:`; por eso la vista
  previa de la foto usa una data URL.
- Secretos solo en `.env` (gitignored).
- Consultas parametrizadas vía Prisma; no hay SQL armado a mano.

## Páginas de error

- `not-found.tsx`: 404 con el mismo estilo retro.
- `error.tsx`: atrapa errores durante una petición; botón de reintentar.
- `global-error.tsx`: red de seguridad si el layout raíz truena; no
  depende de CSS ni fuentes externas.
- Ninguna cubre "el proceso está caído" o "la PC está apagada": ahí
  Cloudflare muestra su propia página de error. Eso lo mitigan PM2
  (`autorestart`) y el arranque automático al prender la PC.

## Operación

El auto-deploy (`deploy-watcher.ts`), el arranque automático con PM2 y
el aviso por correo tras un reinicio (`boot-check.ts`) son operativos,
no de arquitectura: ver [`DESPLIEGUE.md`](./DESPLIEGUE.md).
