# API para la app móvil (v1)

API JSON para una app nativa que haga todo lo que un **miembro** hace hoy en
el sitio: entrar con su correo, mandar su Resumen del día, entregar
misiones, leer los boletines, reaccionar y comentar, ver perfiles y
notificaciones; además, todo lo del panel de admin (`/api/v1/admin/*`) y
notificaciones push.

- **Base:** `https://<tu-dominio>/api/v1` (en este documento, `/api/v1/...`).
- **Formato:** JSON en el cuerpo y en la respuesta (`Content-Type: application/json`).
- **Idioma:** los mensajes de error vienen en español, listos para mostrarse.
- **Código:** `src/app/api/v1/**/route.ts`; lo común en `src/lib/api/`. Las
  reglas (qué se puede hacer y cuándo) son las mismas funciones que usa el
  sitio web, así que la app y la web siempre se comportan igual.

## Conceptos que hay que entender primero

### El boletín y las fechas

- Cada grupo tiene **un boletín al día**, que sale a su `sendTime` (hoy las
  12:00) con los **resúmenes del día anterior**.
- Una respuesta se guarda con la **fecha del boletín en que sale** (`date`),
  no con la del día del que habla. `describedDate` es el día del que habla
  (`date` − 1 día en los resúmenes).
- El resumen de un día se puede escribir desde que sale el boletín de ese
  día hasta que sale el siguiente. Ejemplo con `sendTime` 12:00: el sábado a
  las 22:00 se escribe el resumen del sábado, que sale en el boletín del
  domingo a las 12:00. `GET /today` siempre dice cuál está abierto.
- Antes de octubre de 2026 el formulario era "¿Qué harás al llegar a tu
  casa?". Esas respuestas siguen consultables con `format: "HOME"`; las
  nuevas son `format: "DAY"`. Nunca se crean ni se editan respuestas HOME.

### Grupos

Una persona puede estar en varios grupos. Cada grupo tiene su boletín, y
las reacciones y comentarios son **por grupo**: el mismo resumen puede
tener comentarios distintos en cada grupo al que se mandó. Por eso los
endpoints de reacciones y comentarios piden `groupId`.

### Misiones

Actividades pequeñas para alguien del grupo ("Consigue una foto de una
comida que le guste mucho a Bruno"). Se piden al azar o eligiendo a la
persona; se aceptan, se cambia la actividad o se rechazan; y se
**entregan dentro del resumen del día**. Si no se entrega ni se cancela
antes de que salga el boletín, cuenta como advertencia; a las 3, una
semana sin misiones. Los límites exactos vienen en `GET /config`.

## Autenticación

Sin contraseñas: se entra con un código de 6 dígitos que llega al correo.
Solo entran correos dados de alta por un admin.

1. `POST /api/v1/auth/code` con `{ "email": "fer@ejemplo.com" }` → manda el correo.
2. `POST /api/v1/auth/token` con `{ "email": "fer@ejemplo.com", "code": "123456" }` → devuelve el token.
3. En todas las demás llamadas: `Authorization: Bearer <token>`.

El token dura 90 días. Cuando vence o se cierra la sesión, la API responde
`401` y hay que volver al paso 1. El correo también trae un enlace, pero
ese es para la web: en la app solo se usa el código.

**Fotos:** las URLs de fotos (`photoUrl`, `photo.url`, `imageUrl` de
portadas subidas por usuarios) piden sesión. Cárgalas mandando el mismo
encabezado `Authorization: Bearer <token>`.

## Errores

Siempre con esta forma:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Revisa los campos marcados.",
    "fields": { "didToday": "Cuéntanos qué hiciste." }
  }
}
```

| Status | `code` | Cuándo |
|---|---|---|
| 400 | `invalid_request`, `invalid_comment` | Datos inválidos. `fields` dice cuál campo y por qué. |
| 401 | `unauthorized` | Sin token, token vencido o cuenta desactivada. |
| 401 | `invalid_code` | Código de login incorrecto o vencido. |
| 403 | `forbidden`, `not_allowed` | No tiene permiso (p. ej., correo no registrado, grupo ajeno). |
| 404 | `not_found`, `invalid_invite` | No existe o no lo puede ver. |
| 409 | `not_allowed`, `mission_not_allowed`, `conflict`, `group_suspended` | Regla de negocio: el boletín ya salió, ya tiene 3 misiones hoy, nombre de usuario ocupado… |
| 429 | `rate_limited`, `code_locked` | Demasiados intentos seguidos. |
| 502 | `email_failed` | No se pudo mandar el correo con el código. |
| 500 | `server_error` | Error nuestro. |

## Fotos que se suben

No se suben como archivo, sino en base64 dentro del JSON:

```json
"photo": { "data": "<base64, sin el prefijo data:...>", "type": "image/jpeg" }
```

Tipos: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. Máximo 5 MB.
Recomendado: reducirla en el teléfono antes de mandarla (la web la deja en
un lado máximo de 2000 px, en JPEG). El sitio está detrás de Cloudflare y su
WAF bloquea algunas subidas binarias, por eso se usa base64.

## Objetos comunes

**Persona (referencia):** `{ "id": "…", "name": "Bruno" }`. `name` es lo
que se muestra: el nombre de usuario si lo eligió, o su nombre.

**Reacciones** (lista agrupada por emoji):

```json
[{ "emoji": "💖", "kind": "emoji", "count": 2, "reactedByMe": true, "users": ["Tú", "Caro"] }]
```

`kind` es `"emoji"` o `"ascii"` (emoticones de texto como `¯\_(ツ)_/¯`).

**Comentario:**

```json
{
  "id": "…", "parentId": null, "author": { "id": "…", "name": "Caro" },
  "text": "¡Qué bien @Bruno!", "photoUrl": null,
  "createdAt": "2026-10-25T18:00:00.000Z", "editedAt": null, "mine": false,
  "reactions": [], "mentions": [{ "id": "…", "name": "Bruno" }]
}
```

Los hilos tienen un solo nivel: `parentId` es el comentario de primer
nivel del que cuelga una respuesta.

**Respuesta** (resumen del día o formato anterior):

```json
{
  "id": "…", "date": "2026-10-25", "describedDate": "2026-10-24", "format": "DAY",
  "author": { "id": "…", "name": "Bruno" },
  "day": {
    "didToday": "Paseé por el centro", "stayedHome": false, "wentWhere": "Al centro",
    "food": "Pozole", "bestPart": "El pozole", "worstPart": null,
    "tomorrowPlan": null, "mood": "feliz 🎉"
  },
  "home": null,
  "note": "Algo que quieras compartir", "photo": { "url": "https://…", "description": "…" },
  "phrase": "Frase del día", "createdAt": "…", "updatedAt": "…",
  "reactions": [ … ], "comments": [ … ]
}
```

Con `format: "HOME"`, `day` es `null` y `home` trae los campos del formato
anterior (`atHome`, `arrivingLate`, `beforeHomePlan`, `stayedHome`,
`homePlan`, `awayPlan`, `tonightPlan`, `food`, `goingOut`, `goingOutWhere`).
`reactions` y `comments` solo vienen en los endpoints de boletines.

**Misión:**

```json
{
  "id": "…", "date": "2026-10-25", "status": "ACCEPTED", "mode": "random",
  "text": "Consigue una foto de una comida que le guste mucho a Bruno.",
  "requiresPhoto": true, "target": { "id": "…", "name": "Bruno" },
  "user": { "id": "…", "name": "Fer" },
  "swaps": 1, "resolutionText": null, "photoUrl": null,
  "createdAt": "…", "acceptedAt": "…", "closedAt": null
}
```

`date` es la fecha del boletín en cuyo resumen se entrega. `status`:
`OFFERED` (ofrecida, sin decidir), `ACCEPTED` (activa), `COMPLETED`,
`FAILED` (no entregada: advertencia), `REJECTED`, `CANCELLED`. `user`
solo viene donde importa quién la hizo (boletines, historial).

## Endpoints

### Sesión

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/auth/code` | `{ email }` → manda el código. `{ ok: true }`. |
| POST | `/auth/token` | `{ email, code }` → `{ token, expiresAt, user }` (`user` igual que `GET /me`). |
| POST | `/auth/logout` | Invalida el token. |
| GET | `/config` | Sin sesión. Nombre del sitio, emojis (`quick`, `categories`, `ascii`), límites de misiones y a qué minutos antes del envío salen los recordatorios. |

### Mi cuenta

**`GET /me`**

```json
{
  "id": "…", "name": "Fernanda", "username": "Fer", "displayName": "Fer",
  "email": "fer@ejemplo.com", "role": "MEMBER",
  "birthday": "1995-05-05", "birthdayPromptDismissed": false, "greetingEmoji": "🐧",
  "missionOptOut": false, "missionStrikes": 0, "missionBanUntil": null,
  "groups": [{ "id": "…", "name": "Los importantes", "suspended": false }],
  "unreadNotifications": 3, "pendingMissions": 1
}
```

**`PATCH /me`**: solo cambia lo que mandes. `username` (`""` para quitarlo),
`birthday` (`"YYYY-MM-DD"` o `""`), `greetingEmoji` (un emoji o un emoticón
de `config.emojis.ascii`; `""` = 🐧), `missionOptOut` (no salir como persona
en las misiones de otros), `birthdayPromptDismissed`. Responde como `GET /me`.
`409` si el nombre de usuario ya lo tiene alguien.

| Método | Ruta | Qué hace |
|---|---|---|
| DELETE | `/me/groups/<groupId>` | Salirse de un grupo. |
| POST | `/groups/join` | `{ token }` (el final del enlace `/grupos/unirse/<token>`, o el enlace completo) → `{ status: "joined" \| "already", groupName }`. |

### Hoy: el Resumen del día

**`GET /today`**

```json
{
  "date": "2026-10-26", "describedDate": "2026-10-25", "dayWord": "hoy",
  "sendTime": "12:00", "sendsToday": false, "noGroups": false, "locked": false,
  "groups": [{ "id": "…", "name": "Los importantes", "selected": true, "disabled": false, "sent": false }],
  "response": null,
  "missions": [{ "id": "…", "text": "…", "requiresPhoto": true, "targetName": "Bruno", "resolutionText": null, "photoUrl": null }]
}
```

- `dayWord` (`"hoy"` / `"ayer"`) es para las preguntas: "¿Qué hiciste hoy?"
  o "¿Qué hiciste ayer?". Si es `"ayer"`, "¿Qué crees que harás mañana?"
  pasa a "¿Qué crees que harás hoy?".
- `sendsToday`: si el boletín sale hoy (si no, mañana) a las `sendTime`.
- `locked`: ya salió el boletín de alguno de sus grupos y no se puede
  editar. Ahí `response` trae lo que mandó (solo lectura).
- `groups`: a qué grupos puede ir. Los `disabled` ya enviaron su boletín.
  Si hay uno solo elegible, no hace falta preguntar.
- `missions`: misiones aceptadas que se entregan en este resumen.

**`PUT /today/response`**: manda o actualiza el resumen. Es un
**reemplazo completo** (lo que no mandes queda vacío), igual que el
formulario web: al editar, manda todos los campos otra vez.

```json
{
  "didToday": "Fui a la oficina",
  "stayedHome": false,
  "wentWhere": "A la oficina",
  "food": "Tacos",
  "bestPart": "La comida",
  "worstPart": "El tráfico",
  "tomorrowPlan": "Dormir",
  "note": "Algo que quieras compartir",
  "mood": "cansada pero contenta 😴",
  "phrase": "Frase del día",
  "photo": { "data": "…", "type": "image/jpeg" },
  "photoDescription": "La comida",
  "removePhoto": false,
  "groupIds": ["…"],
  "missions": [{ "id": "…", "text": "Le pregunté y…", "photo": { "data": "…", "type": "image/jpeg" } }]
}
```

- **Obligatorios:** `didToday`, `stayedHome`, `mood`; `wentWhere` si
  `stayedHome` es `false`; `photoDescription` si hay foto (nueva o la que
  ya tenía).
- **Foto:** sin `photo` se conserva la que ya tenía; `removePhoto: true` la quita.
- **`groupIds`:** sin él, los grupos que ya tenía la respuesta (o todos, si
  es nueva). Solo cuentan los que no están `disabled`.
- **`missions`:** `text` vacío = todavía sin entregar. Las misiones que no
  vengan en la lista se quedan como estaban. Si la misión `requiresPhoto`,
  hace falta foto (nueva o la que ya tenía); `removePhoto: true` la quita.
- **Errores de validación:** `400` con `fields`. Los de misiones vienen como
  `"mission:<id>:text"`. Si ya salió el boletín: `409`.
- Responde `{ ok: true }`; vuelve a pedir `GET /today` para pintar el estado.

### Misiones

**`GET /missions`**

```json
{
  "date": "2026-10-26", "used": 1, "perDay": 3, "rejections": 0, "rejectionsPerDay": 3,
  "cancelsThisWeek": 0, "cancelsPerWeek": 2, "swapsPerOffer": 3,
  "strikes": 1, "strikesToBan": 3, "bannedUntil": null, "canRequest": true,
  "offer": null, "accepted": [ /* misiones */ ], "completed": [ /* entregadas hoy */ ],
  "chosenTargets": [{ "id": "…", "name": "Bruno" }],
  "history": [ /* cumplidas, incumplidas y canceladas, de la más reciente */ ]
}
```

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/missions` | `{ mode: "random" }` o `{ mode: "chosen", targetId }` → crea la oferta (`offer`). `201`. |
| POST | `/missions/<id>/accept` | Acepta la oferta abierta. |
| POST | `/missions/<id>/swap` | "Cambiar actividad": misma persona, otra misión (`swapsPerOffer` veces). |
| POST | `/missions/<id>/reject` | Rechaza la oferta. |
| POST | `/missions/<id>/cancel` | Cancela una aceptada (sin advertencia; se avisa a los admins). |

Todas responden el estado completo, igual que `GET /missions`. Si una regla
no lo permite (ya tiene 3 hoy, está fuera por advertencias, esa persona no
está disponible…): `409` con el motivo en `message`.

- **Al azar** solo salen personas que entraron en los últimos 3 días; **al
  elegir**, en los últimos 7. Nunca salen quienes tienen `missionOptOut` ni
  quienes están fuera por advertencias. Usar la app cuenta como entrar.
- La entrega va en `PUT /today/response` (`missions`), no aquí.

### Boletines

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/groups` | Grupos cuyo archivo puede ver (`member` dice si es miembro; los admins ven todos). |
| GET | `/groups/<groupId>/members` | Miembros activos, para etiquetar con @ y abrir perfiles. |
| GET | `/groups/<groupId>/newsletters?archive=day\|legacy\|all` | El archivo, del más reciente al más viejo. `day` (default) son los Resúmenes del día; `legacy`, el formato anterior. |
| GET | `/groups/<groupId>/newsletters/<date>` | Un boletín diario completo. |
| GET | `/groups/<groupId>/birthdays/<userId>/<date>` | Una edición de cumpleaños. |

Entrada del archivo:

```json
{ "date": "2026-10-26", "describedDate": "2026-10-25", "format": "DAY", "type": "daily", "birthdayUserId": null, "celebrant": null }
```

Con `type: "birthday"`, ábrela con `/birthdays/<birthdayUserId>/<date>`.

Boletín diario:

```json
{
  "groupId": "…", "date": "2026-10-26", "describedDate": "2026-10-25", "format": "DAY",
  "sentAt": "2026-10-26T18:00:05.000Z",
  "hero": {
    "title": "…", "paragraph": "…", "imageUrl": "https://…",
    "imageCaption": { "date": "…", "description": "…", "authorName": "…" },
    "link": { "url": "…", "text": "Leer más" },
    "dailyPhrase": { "text": "…", "author": "…" }
  },
  "responses": [ /* respuestas con reactions y comments de este grupo */ ],
  "missions": [ /* misiones cumplidas con user, reactions y comments */ ]
}
```

`hero` es `null` si el boletín no tiene portada. Solo se pueden abrir los
boletines que están en el archivo (enviados y no archivados): el de un día
que todavía no sale da `404`.

Edición de cumpleaños: `{ groupId, date, celebrant, title, hero, moments }`,
con `moments` como respuestas con su interacción.

### Reaccionar y comentar

| Método | Ruta | Cuerpo | Responde |
|---|---|---|---|
| POST | `/responses/<id>/reactions` | `{ groupId, emoji, kind }` | `{ reactions }` |
| POST | `/missions/<id>/reactions` | `{ groupId, emoji, kind }` | `{ reactions }` |
| POST | `/comments/<id>/reactions` | `{ emoji, kind }` | el comentario |
| POST | `/responses/<id>/comments` | `{ groupId, text, photo?, replyToId?, mentionIds? }` | el comentario (`201`) |
| POST | `/missions/<id>/comments` | igual | el comentario (`201`) |
| PATCH | `/comments/<id>` | `{ text, photo?, removePhoto?, mentionIds? }` | el comentario |

- Las reacciones son un interruptor: mandar la misma otra vez la quita.
- Un comentario puede ser solo texto, solo foto o las dos cosas (máx. 1000 caracteres).
- `replyToId`: responder a un comentario del mismo hilo.
- `mentionIds`: ids de miembros del grupo etiquetados. Solo cuentan si su
  `@Nombre` está en el texto, con el `name` de `/groups/<id>/members`.
- Solo se edita lo propio (`mine: true`). Al editar se mandan `text` y
  `mentionIds` completos; sin `photo` se conserva la foto.
- Cada acción avisa (correo y notificación) a quien corresponde, igual que en la web.

### Perfiles

**`GET /users/<id>`** (o `/users/me`):

```json
{
  "id": "…", "name": "Bruno", "realName": "Bruno Pérez", "isMe": false,
  "lastSeenAt": "2026-10-26T15:00:00.000Z", "mood": "feliz 🎉", "birthday": "03-14",
  "stats": { "responses": 148, "missionsDone": 9, "streak": 12 },
  "canRequestMission": true
}
```

**`GET /users/<id>/history?type=day|home|missions&limit=30&before=YYYY-MM-DD`**:
historial de lo más reciente a lo más viejo. `day` y `home` traen
`{ responses, nextBefore }`; `missions` trae `{ done, forThem, nextBefore }`
(las que cumplió y las que le hicieron). Para la siguiente página, manda
`before = nextBefore`; `null` = no hay más.

Quien ve el perfil de otra persona solo ve lo que se mandó a grupos en
común y cuyo boletín ya salió (`404` si no comparten grupo). Las misiones
que le hicieron a alguien aparecen hasta que sale su boletín, también en
su propio perfil, para no arruinar la sorpresa.

### Notificaciones

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/notifications?limit=50&before=<ISO>` | `{ unread, notifications, nextBefore }`, de la más nueva a la más vieja. |
| GET | `/notifications/<id>` | Una notificación (la marca leída). Si es copia de un correo, trae `html` para un WebView. |
| POST | `/notifications/read-all` | Marca todas como leídas. |

```json
{
  "id": "…", "kind": "newsletter", "title": "📰 Salió el boletín…", "preview": "…",
  "createdAt": "…", "readAt": null, "hasEmail": false,
  "target": { "type": "newsletter", "groupId": "…", "date": "2026-10-26", "birthdayUserId": null }
}
```

`target` dice a qué pantalla llevar: `newsletter` (con `groupId` y `date`,
o `birthdayUserId` si es de cumpleaños), `today`, `missions`, `profile`,
`notification` (abrir el detalle con su `html`) o `web` (con `url`, para
abrir en el navegador).

### Respuestas extraordinarias

Para cuando la app le falló a alguien y un admin le dio permiso de
responder un día pasado.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/extraordinary` | `{ enabled, anyPastDay, availableDates, recentlyUsedDates }`. `anyPastDay` es para admins: pueden elegir cualquier día pasado. |
| POST | `/extraordinary` | `{ date, ...los campos de PUT /today/response, sin missions }`. Se agrega al boletín de ese día (el correo no se vuelve a mandar). `201`. |

## Límites de uso

Los mismos de la web, por persona: 15 resúmenes guardados cada 5 minutos,
60 reacciones por minuto, 30 comentarios cada 5 minutos, 30 acciones de
misiones cada 5 minutos, y en el login 8 pedidos de código por IP y 5 por
correo cada 10 minutos. Al pasarse: `429`, hay que esperar.

## Notificaciones push

Cada notificación que aparece en `/notifications` también llega como push a
los teléfonos registrados de esa persona (comentarios, reacciones,
menciones, boletín nuevo, recordatorios, misiones, etc.).

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/me/devices` | `{ token, provider: "expo" \| "fcm", platform: "ios" \| "android" }` — registra el teléfono. Llámalo al iniciar sesión y cada vez que el sistema dé un token nuevo. `201`. |
| DELETE | `/me/devices` | `{ token }` — deja de mandarle push (llámalo al cerrar sesión, antes de `/auth/logout`). |

- **`expo`**: el token de Expo (`ExponentPushToken[...]`). Funciona sin
  configurar nada en el servidor.
- **`fcm`**: el token de Firebase Cloud Messaging (Android, o iOS con FCM).
  Necesita en el servidor la variable `FCM_SERVICE_ACCOUNT_FILE` con la ruta
  al JSON de la cuenta de servicio del proyecto de Firebase (se descarga en
  Firebase › Configuración del proyecto › Cuentas de servicio). Sin eso, los
  dispositivos `fcm` se registran pero no reciben nada.

Contenido del push: `title` (el título de la notificación), `body` (su
resumen), `badge` (notificaciones sin leer) y `data` con `notificationId`,
`kind` y `target` (el mismo objeto de `/notifications`, como texto JSON),
para saber qué pantalla abrir al tocarlo. Los tokens que el proveedor dice
que ya no existen se borran solos.

## Panel de admin (`/api/v1/admin/*`)

Solo para cuentas con `role: "ADMIN"` (si no, `403`). Usan las mismas
reglas que el panel web. Los `PATCH` cambian solo los campos que vengan.
Los errores de validación son `400` con `fields`, como en el resto de la API.

### Personas

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/admin/users` | Todas (también desactivadas): grupos, última visita, advertencias de misiones. |
| POST | `/admin/users` | `{ name, email, role: "MEMBER" \| "ADMIN", username?, groupIds? }` → `{ id }`. Manda la bienvenida si está activada. |
| PATCH | `/admin/users/<id>` | `{ name?, email?, role?, username?, active? }`. |
| POST | `/admin/users/<id>/clear-strikes` | Quita advertencias y baneo de misiones. |

### Grupos

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/admin/groups` | Todos, con sus ajustes y `memberCount`. |
| POST | `/admin/groups` | `{ name }` → el grupo. |
| GET | `/admin/groups/<id>` | Ajustes, `inviteUrl` y miembros. |
| PATCH | `/admin/groups/<id>` | `{ name?, suspended?, newsletter?: { tagline, greetingTemplate (con {nombre}), sendTime "HH:MM", reminderEnabled, heroEnabled, heroTitle, heroParagraph, heroImageUrl, heroLinkUrl, heroLinkText, selectedPhraseId (null = frase al azar) } }`. |
| POST | `/admin/groups/<id>/invite-link` | `{ mode: "enable" \| "regenerate" \| "disable" }` → `{ inviteUrl }`. |
| POST | `/admin/groups/<id>/members` | `{ userIds }` — agrega directo. |
| DELETE | `/admin/groups/<id>/members/<userId>` | Saca a alguien. |
| POST | `/admin/groups/<id>/invitations` | `{ userIds }` — manda la invitación por correo. |

### Boletín, envíos, fotos y frases

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/admin/groups/<id>/newsletters/<date>` | Vista previa (`html`, `text`), si ya salió (`sent`, `sentAt`, `status`), la foto y frase de portada (`pick`) y las fotos elegibles (`photos`). |
| POST | `/admin/groups/<id>/newsletters/<date>/send` | `{ force? }` — lo manda ya; sin `force`, si ya salió responde `status: "already_sent"`. |
| POST | `/admin/groups/<id>/newsletters/<date>/reroll` | `{ target: "photo" \| "phrase" }` — otra al azar. |
| PUT | `/admin/groups/<id>/newsletters/<date>/photo` | `{ heroPhotoId }` — fija la foto (`null` = automática). |
| GET | `/admin/sends?groupId=&limit=` | Boletines enviados (también archivados). |
| PATCH | `/admin/sends/<id>` | `{ archived }` — archivado ya no aparece a los miembros. |
| GET | `/admin/photos` | Fotos de portada. |
| PATCH | `/admin/photos/<id>` | `{ description?, date? ("YYYY-MM-DD" o "") }`. |
| GET | `/admin/phrases` | Frases del día (con `fixedInGroups`). |
| POST | `/admin/phrases` | `{ text }`. |
| DELETE | `/admin/phrases/<id>` | Borra (los grupos que la tenían fija vuelven al azar). |

### Cumpleaños

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/admin/birthdays` | `settings`, `upcoming` (próximos), `withoutBirthday` y ediciones enviadas. |
| PATCH | `/admin/birthdays/settings` | `{ birthdayEnabled?, birthdaySendTime?, birthdayGreetingTemplate?, birthdayHeroTitle?, birthdayHeroParagraph?, birthdayTopTitle? }`. |
| GET | `/admin/birthdays/<userId>/<groupId>/<date>` | Vista previa de la edición. |
| POST | `/admin/birthdays/<userId>/<groupId>/<date>/send` | `{ force? }`. |
| POST | `/admin/birthdays/<userId>/<groupId>/<date>/reroll-photo` | Otra foto al azar. |
| PUT | `/admin/birthdays/<userId>/<groupId>/<date>/photo` | `{ heroPhotoId }` (`null` = automática). |

### Comunicaciones

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/admin/communications` | Programadas y enviadas. |
| POST | `/admin/communications` | `{ subject, bodyHtml, audience: "all" \| "selected" \| "groups", recipientIds?, groupIds?, scheduledAt? }` — sin `scheduledAt` (ISO, futuro) se manda ya. `bodyHtml` se limpia igual que en el editor del panel. |
| GET | `/admin/communications/<id>` | Con su contenido. |
| PATCH | `/admin/communications/<id>` | Edita una programada (mismos campos). |
| DELETE | `/admin/communications/<id>` | Cancela una programada. |

### Ajustes, correos especiales y respuestas extraordinarias

| Método | Ruta | Qué hace |
|---|---|---|
| GET / PATCH | `/admin/settings` | Ajustes generales: `newsletterName`, `tagline`, `autoSend`, `lockResponsesAfterSend`, `fromName`, `fromEmail`, resumen semanal (`weeklySummaryEnabled`, `weeklySummaryDay` 0–6, `weeklySummaryTime`), correos de inactividad (`inactivityNudge*`), correos especiales (`extrasEmailTime`, `streakEmailEnabled`, `onThisDayEnabled`, `anniversaryEnabled`, `wrappedEnabled`, `welcomeEmailEnabled`), correo a quien no mandó su resumen (`missedEmailEnabled`, `missedEmailDelayMinutes`). |
| POST | `/admin/emails/<kind>` | "Enviar ahora": `weekly`, `nudge`, `missed` (a quien no mandó su resumen para el último boletín), `streak`, `on-this-day`, `anniversary`, `wrapped` o `welcome` (este con `{ userId }`). Responde `{ message }`. |
| GET | `/admin/extraordinary` | Si la página está habilitada y los permisos dados. |
| PATCH | `/admin/extraordinary` | `{ enabled }` — al habilitarla avisa a quien ya tenía permiso. |
| POST | `/admin/extraordinary/grants` | `{ userId, date }` — permiso de un solo uso para un día pasado. |
| DELETE | `/admin/extraordinary/grants/<id>` | Quita un permiso sin usar. |

### Estadísticas, respuestas y misiones

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/admin/stats?from=&to=&groupId=` | Participación, como en `/admin/estadisticas` (sin fechas: últimos 30 días; `from=all`: todo). |
| GET | `/admin/responses?date=` | Todas las respuestas de un boletín y quién falta (sin `date`: el que todavía no sale). |
| GET | `/admin/missions?estado=&usuario=&desde=&hasta=` | Seguimiento: `summary`, `activeByUser`, `perUser`, `perDay` y `missions`. `estado`: `todas`, `activas`, `concluidas`, `cumplidas`, `incumplidas`, `canceladas` o `rechazadas`. |
| GET | `/admin/missions/catalog` | El catálogo (con `completedCount`). |
| POST | `/admin/missions/catalog` | `{ text (con {usuario}), requiresPhoto? }`. |
| PATCH | `/admin/missions/catalog/<id>` | `{ text?, requiresPhoto?, active? }`. |
| DELETE | `/admin/missions/catalog/<id>` | La borra si nunca se usó; si no, la desactiva (`{ result: "deleted" \| "deactivated" }`). |
