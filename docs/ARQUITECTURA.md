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
| Auth | Auth.js v5 (beta) | Enlace mágico o código por correo, sin contraseñas. Sesiones en base de datos. |
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
    login/                       # Login sin contraseña (enlace mágico o código)
    perfil/                      # Autoservicio: apodo y fecha de cumpleaños
    mis-respuestas/              # Historial propio
    respuesta-extraordinaria/    # Responder un día pasado, con un privilegio de un solo uso del admin
    grupos/unirse/[token]/       # Unirse a un grupo con su enlace de invitación
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
    participation-stats.ts       # Métricas de participación (dashboard, resumen semanal, inactividad)
    send-engagement.ts, engagement-email.ts        # Envío del resumen semanal y correo de inactividad
    weekly-report.ts, weekly-report-email.ts       # Contenido del resumen semanal (miembros y admins)
    send-extras.ts, extras-email.ts                # Correos especiales (racha, hace un año, aniversario, anual, bienvenida)
    last-seen.ts                 # Última visita al sitio de cada persona
    send-communication.ts, communication-email.ts  # Comunicaciones del admin
    notify-admins.ts, communication-result-email.ts # Aviso a admins del resultado de una programada
    notify-interaction.ts, interaction-email.ts    # Aviso de reacción/comentario a tu respuesta o comentario
    hero-photos.ts               # Sincroniza public/IMG con HeroPhoto y elige la foto del día
    phrases.ts, response-phrases.ts                # Frase del día / frases aportadas en respuestas
    response-photos.ts           # Fotos de respuestas: validar, guardar, borrar
    save-response.ts             # Guardado común de una respuesta (diaria y extraordinaria)
    extraordinary.ts, extraordinary-email.ts       # Respuestas extraordinarias: permisos y avisos
    groups.ts, group-email.ts                      # Grupos: membresía, a qué grupos va cada respuesta, invitaciones
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

- **Enlace mágico + código**: no hay contraseñas. La persona pide un
  correo (`src/app/login`) y Auth.js lo manda vía Nodemailer, con un
  código de 6 dígitos y un enlace que lleva ese mismo código (es el token
  de Auth.js, ver `src/lib/login-code.ts`; vigencia de 15 minutos).
  - El código se escribe en `/login/verificar`, en la misma pantalla
    donde se pidió. Existe porque WhatsApp y las apps de correo en iPhone
    abren los enlaces en su navegador interno, que no comparte cookies con
    Safari: con solo el enlace, la sesión quedaba en Safari y la persona
    tenía que volver a pedir correo cada vez que entraba desde WhatsApp.
  - `verifyCode` revisa el código contra `VerificationToken` sin
    consumirlo y luego manda al callback normal de Auth.js, que crea la
    sesión. Con 5 códigos incorrectos se borran los códigos vigentes de
    ese correo, y el callback (`GET /api/auth/callback/nodemailer`) tiene
    su propio tope de 10 intentos por correo para que no se pueda adivinar
    probando URLs.
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
3. **A qué grupos va** (`ResponseGroup`): quien está en dos o más grupos
   activos ve "¿A qué grupos la mandas?" con todos marcados por defecto;
   con un solo grupo no se pregunta y va ahí. Quien no está en ningún
   grupo ve un aviso en vez del formulario. Las opciones salen de
   `responseGroupOptions()` (`src/lib/groups.ts`).
4. Si `Settings.lockResponsesAfterSend` está activo (`responseLock()`): la
   respuesta es una sola para todos sus grupos, así que en cuanto sale el
   boletín de alguno de ellos ya no se puede editar. Sin respuesta, se
   puede responder mientras quede algún grupo sin enviar, y solo a esos
   (los que ya salieron se muestran deshabilitados).

### Respuestas extraordinarias (`/respuesta-extraordinaria`)

Para cuando a alguien la app le falló y no pudo responder un día. Desde
Ajustes, el admin habilita la página y le da a alguien un privilegio de
un solo uso para un día pasado (`ExtraordinaryGrant`, único por persona y
día, solo si ese día no tiene respuesta suya).

- Al dar el privilegio con la página habilitada, o al habilitarla con
  privilegios pendientes, a la persona le llega el correo de "privilegio
  especial" con el botón a la página (`sendGrantEmail()`).
- El formulario es el mismo de la home (`ResponseForm` con `action` y
  `dateOptions`), más un selector con los días que tiene permitidos. El
  guardado común vive en `src/lib/save-response.ts` (fuera de un archivo
  `"use server"` para no exponerlo como acción).
- `saveExtraordinaryResponse` se salta `lockResponsesAfterSend`, pero
  aparta el permiso (`usedAt`) antes de guardar y lo suelta si falla.
- Un admin siempre ve el formulario, aunque la página esté deshabilitada,
  y elige cualquier día pasado sin respuesta suya (calendario en vez de
  la lista). Al guardar se le anota un permiso ya usado a su nombre, para
  que quede en Ajustes y el día salga en `/boletines`.
- No se vuelve a mandar el boletín ni cambia su snapshot: la respuesta
  aparece en `/boletines`, que lee las respuestas en vivo, sin distinguirse
  de las demás. Si ese día no salió boletín, igual se lista.
- `notifyExtraordinaryResponse()` avisa por correo y en `/notificaciones`
  a todos los activos menos a quien respondió: "Hay actualizaciones en el
  boletín del…", sin decir quién. A los admins les llega la versión con
  el nombre.
- El borrador usa su propio prefijo (`wygh:extraordinaria:`), para que
  no borre el de la home ni al revés.

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
| Boletín diario de cada grupo | `Group.sendTime` de cada grupo no suspendido (si `Settings.autoSend`) | `sendDailyNewsletter(groupId, date)` | `NewsletterSend(groupId, date)` |
| Recordatorio a quien no ha respondido | 1 h antes del `sendTime` de cada grupo (si su `reminderEnabled`); solo a sus miembros sin respuesta ese día | `sendReminderIfNeeded(groupId, date)` | `ReminderSend(groupId, date)` |
| Boletín de cumpleaños (una edición por grupo de quien cumple) | `Settings.birthdaySendTime` (si `birthdayEnabled`) | `sendBirthdayNewsletter(userId, groupId, date)` | `BirthdayNewsletter(userId, groupId, date)` |
| Comunicaciones programadas | cuando llega su `scheduledAt` | `sendCommunicationNow()` + aviso a admins | `Communication.status` |
| Resumen semanal de participación (uno por grupo, a sus miembros) | `weeklySummaryDay` a las `weeklySummaryTime` (si `weeklySummaryEnabled`) | `sendWeeklySummary()` | `WeeklySummarySend(groupId, weekStart)` |
| Correo a quien lleva N días sin responder | `inactivityNudgeTime` (si `inactivityNudgeEnabled`) | `sendInactivityNudges()` | `InactivityNudge(userId, date)` |
| Correos especiales (racha, "hace un año", aniversario, resumen anual el 1 de enero) | `extrasEmailTime` (cada uno con su interruptor) | `sendDailyExtras()` | `EngagementEmail(userId, kind, key)` |

Todo se manda solo a usuarios activos.

### Participación (dashboard, resumen semanal, inactividad)

`getParticipationStats()` (`src/lib/participation-stats.ts`) calcula
todo a partir de los **días cerrados**: los días con fila en
`NewsletterSend`, que son en los que se esperaba respuesta. El día de hoy
no cuenta hasta que sale el boletín, un día sin boletín no se le "debe" a
nadie, y a cada persona solo le cuentan los días en que salió el boletín
de alguno de sus grupos, desde que entró a ese grupo
(`GroupMember.joinedAt`, nunca antes de `User.createdAt`). Los "días
seguidos sin responder" son sus días cerrados desde su última respuesta.
Con `groupId` todo se limita a un grupo (sus miembros, días, respuestas,
reacciones y comentarios): así se filtra `/admin/estadisticas` y se arma
el resumen semanal de cada grupo.

- **Resumen semanal**: uno por grupo, a sus miembros, con los 7 días
  anteriores al día de envío de ese grupo; mismo contenido para todo el
  grupo (participación, destacados y días respondidos por persona) más una
  línea personal. Quien está en varios grupos recibe uno de cada uno.
- **Resumen semanal, dos versiones**: los miembros reciben participación,
  destacados, top 3 de quién responde/reacciona/comenta más y menos, y las
  listas de quien lleva `inactivityNudgeDays` días o más sin responder y
  sin entrar al sitio. Los admins reciben eso más una sección "Solo para
  admins": tendencia contra la semana anterior, día por día, detalle por
  persona, correos de inactividad enviados, candidatos a desactivar (14+
  días sin entrar ni responder), altas nuevas, cumpleaños próximos y
  problemas de envío.
- **Última visita** (`src/lib/last-seen.ts`): `User.lastSeenAt` se anota
  al abrir inicio, `/boletines`, `/mis-respuestas` o `/perfil` (como
  mucho cada 10 minutos). Para lo anterior a ese campo se usa el
  vencimiento de la sesión (Auth.js lo alarga como mucho una vez al día al
  entrar, así que vencimiento − 90 días ≈ última visita) y la última
  respuesta, reacción o comentario. Leer solo el correo no cuenta.
- **Correos especiales** (`src/lib/send-extras.ts`): felicitación al
  llegar a 7, 30, 50, 100, 200 y 365 días seguidos respondiendo; "hace un
  año" con la respuesta del mismo día del año anterior; aniversario de la
  fecha de alta; resumen anual el 1 de enero; y bienvenida al dar de alta
  a alguien en `/admin/usuarios`. `EngagementEmail` los hace idempotentes
  (se aparta la fila antes de mandar y se suelta si el envío falla).
- **Correo de inactividad**: sale al llegar a `inactivityNudgeDays` días
  sin responder y se repite cada otros tantos mientras siga la racha.
  Título y mensaje se editan en Ajustes, con `{nombre}` y `{dias}`.

## El boletín diario

Cada grupo tiene su propio boletín: `buildNewsletter(groupId, date)`
(`src/lib/newsletter.ts`) arma el HTML y el texto plano solo con las
respuestas mandadas a ese grupo, con su nombre, lema y saludo, y se le
manda solo a sus miembros activos.

- **Portada** (opcional, en `/admin/grupos/[id]`): título, párrafo, foto,
  frase del día y un enlace.
  - La foto y la frase del día se resuelven una vez por grupo y quedan
    fijas en `DailyPick` (ver `hero-photos.ts` y `phrases.ts`). Salen del
    catálogo y de las respuestas mandadas a ese grupo, nunca de las de
    otro. Prioridad: la que
    eligió el admin, luego la que ya quedó fija, luego una "programada"
    para ese día, y si no, una al azar estable con `pickStable()`
    evitando repetir el evento del día anterior. Así la vista previa y el
    envío coinciden y la portada no cambia sola a media tarde.
  - Desde `/admin/boletin` se pueden elegir a mano o re-rolar.
- **Una tarjeta por respuesta del día mandada al grupo**: avatar, nombre a mostrar
  (`displayName()`), plan, comida, nota y foto.
- El saludo se personaliza por destinatario (`personalizeGreeting()`).

Al enviarse, el contenido queda **congelado** en `NewsletterSend`
(`contentHtml`, `contentText`, `heroJson`): `/boletines` y el panel lo
muestran tal cual salió, aunque los ajustes del grupo cambien después.

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
worker manda un boletín extra a cada uno de sus grupos (no suspendidos),
solo a los miembros de ese grupo y con el nombre y lema del grupo
(`src/lib/birthday-newsletter.ts` + `src/lib/send-birthday.ts`). Cada
edición usa solo fotos y momentos (con sus reacciones y comentarios) de
ese grupo:

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

- Por grupo: cada quien ve los de sus grupos (también los de un grupo en
  pausa) y elige el grupo arriba si está en varios; un admin ve todos.
  `?grupo=<id>` elige el grupo (si no es tuyo, se usa el primero tuyo).
- Lista de boletines enviados del grupo (diarios y de cumpleaños), sin
  los que el admin archivó.
- Reacciones y comentarios son del grupo en que se ven: una respuesta
  mandada a dos grupos tiene reacciones e hilo aparte en cada uno. Las
  acciones revisan que tengas acceso al grupo y que la respuesta se haya
  mandado ahí (`canInteractInGroup()` en `src/lib/groups.ts`); `@` solo
  sugiere y etiqueta a miembros del grupo, y los avisos solo le llegan a
  miembros y llevan a ese grupo.
- Cada boletín muestra la portada congelada y las respuestas de ese día
  mandadas a ese grupo como tarjetas (`response-card.tsx`) donde se puede:
  - **Reaccionar** a la respuesta o a cualquier comentario
    (`reaction-bar.tsx`): emojis rápidos, selector completo y emoticones
    ascii. Repetir la misma reacción la quita.
  - **Ver quién reaccionó**: al pasar el mouse sobre una reacción, o con
    el botón 👥 en celular. `summarizeReactions()` (`src/lib/reactions.ts`)
    agrupa por emoji con los nombres.
  - **Comentar** (`comment-thread.tsx`) y **responder** a un comentario.
    Los hilos tienen un solo nivel: responder a una respuesta la cuelga
    del mismo comentario de primer nivel y etiqueta a quien la escribió.
    Un comentario puede llevar una **foto** (📷), con o sin texto: se
    prepara igual que la del formulario diario (`prepare-photo.ts`,
    base64) y se guarda junto a las de las respuestas
    (`saveCommentPhoto()`), pero no entra a la portada.
  - **Editar** un comentario propio (✏️): texto, etiquetas y foto. Queda
    marcado como "editado" (`Comment.editedAt`) y solo se avisa a quienes
    se etiquetó recién en la edición.
  - **Etiquetar** con `@`: al escribir sale la lista de personas activas;
    lo elegido viaja aparte (ids) y el servidor solo guarda las
    etiquetas cuyo `@Nombre` siga en el texto. Se resaltan al mostrarse.
- Cada reacción avisa al dueño de la respuesta o del comentario
  (`notify-interaction.ts`). Un comentario nuevo avisa con
  `notifyNewComment()` una sola vez por persona, con lo más específico:
  "respondió a tu comentario", luego "te etiquetó" y al final "comentó tu
  respuesta", con el texto del comentario. Nunca a uno mismo ni a cuentas
  desactivadas. Todos llegan por correo y a `/notificaciones`. Es
  best-effort: si el correo falla, el comentario igual se guarda.
- Los menús emergentes (`popover.tsx`) se pintan en un portal con
  `position: fixed` para que el `overflow: hidden` del panel no los
  recorte, y se ajustan para no salirse de la pantalla en celular.

## Panel de administración (`/admin/*`)

Pestañas: Estadísticas, Respuestas, Usuarios, Grupos, Boletín, Fotos,
Frases, Cumpleaños, Envíos, Comunicaciones, Ajustes.

- **Estadísticas**: dashboard de participación por periodo (7/30/90
  días o todo): participación diaria y por día de la semana, ranking de
  quién responde más y menos, días seguidos sin responder, quién no ha
  entrado al sitio, rachas, última visita, hora
  típica de respuesta, reacciones/comentarios y datos curiosos.

- **Usuarios**: alta/edición (nombre, correo, rol, apodo) y
  activar/desactivar. El `<select>` de rol se deshabilita en tu propia
  fila para no quitarte el admin por accidente; como un `<select
  disabled>` no viaja en el `FormData`, se reemplaza por un
  `<input type="hidden">` con el rol actual. Al dar de alta a alguien se
  eligen sus grupos (vienen marcados los que no están en pausa), y cada
  fila muestra a qué grupos pertenece.
- **Grupos** (`/admin/grupos`): crear, renombrar y suspender (pausa)
  grupos, los ajustes del boletín de cada uno (lema, saludo, hora,
  recordatorio, portada, frase fija), agregar o quitar miembros a mano, y el enlace para unirse
  (crear, copiar, regenerar o desactivar). "Invitar amigos" manda a los
  usuarios activos que se elijan un correo con ese enlace
  (`sendGroupInvites()` en `src/lib/groups.ts`). El enlace lleva a
  `/grupos/unirse/<token>`, que pide sesión (no crea cuentas) y une con
  un botón, no al abrir la página, porque algunos correos abren los
  enlaces solos para revisarlos. Un grupo en pausa no admite gente nueva.
- **Boletín**: vista previa exacta del día de un grupo (o de cualquier
  fecha), elegir o re-rolar foto y frase, envío manual o reenvío.
- **Fotos**: catálogo sincronizado con `public/IMG` más las fotos de
  respuestas; cada una puede llevar descripción y fecha programada.
- **Frases**: catálogo de frases; las que vienen de respuestas llegan con
  autor y fecha. Una frase se puede fijar en uno o varios grupos.
- **Cumpleaños**: próximos cumpleaños, vista previa/envío por persona y
  ajustes del boletín de cumpleaños.
- **Envíos**: historial de `NewsletterSend` de todos los grupos;
  archivar oculta un boletín en `/boletines` sin borrarlo.
- **Comunicaciones**: correos sueltos con editor de texto enriquecido (el
  HTML se sanea en `rich-text.ts`), a todos, a personas elegidas o a los
  miembros de ciertos grupos (`audience = "groups"`), de inmediato o
  programados. De los programados, los admins reciben un
  correo con el resultado.
- **Ajustes**: nombre y lema del sitio, envío automático (todos los
  grupos), bloqueo tras el envío, remitente, resumen semanal, correo de inactividad y correos especiales (con vista previa
  de cada uno en `/admin/estadisticas/vista-previa?correo=…`). Cada
  correo tiene "Enviar ahora" (`src/lib/send-now.ts`): lo manda en el
  momento a quienes les tocaría hoy, mostrando antes la lista, y no lo
  anota en `WeeklySummarySend` / `InactivityNudge` / `EngagementEmail`,
  así que la programación sigue igual. A mano, la racha le llega a quien
  lleve 7+ días y el resumen anual cubre el año en curso hasta ayer.
  Al final, aparte del formulario porque manda correos, está la sección
  de respuestas extraordinarias (ver arriba).

## Autoservicio del usuario

- **`/perfil`**: nombre y correo de solo lectura, apodo (`username`),
  fecha de cumpleaños y "Mis grupos", donde cada quien puede salirse de un
  grupo (volver requiere el enlace de invitación o a un admin).
- **`/mis-respuestas`**: historial propio, día por día.
- **`/notificaciones`**: copia de cada correo que se le mandó a la persona
  (boletín, cumpleaños, recordatorio, reacciones/comentarios,
  comunicaciones, resumen semanal, inactividad, especiales y, a admins,
  el resultado de comunicaciones programadas). `recordNotification()`
  (`src/lib/notifications.ts`) la anota solo si el correo salió; los
  correos del código de acceso no entran. Si guarda el HTML del correo,
  el detalle lo muestra en un iframe sin scripts; si no (boletín,
  reacciones), lleva al boletín. El contador de no leídas sale en el menú
  de inicio, y el worker borra las de más de un año a las 3:30.
- **Reacciones**: `QUICK_EMOJIS` y `EMOJI_CATEGORIES` en
  `src/lib/emoji-data.ts`, sin emojis de Unicode 15 en adelante (muchos
  celulares no los tienen y salen como cuadrito; así pasó con 🫪, que se
  cambió por 🥴).

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
