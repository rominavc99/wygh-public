# Base de datos

> Ver también: [`ARQUITECTURA.md`](./ARQUITECTURA.md). Fuente de verdad
> real: `prisma/schema.prisma` — si este documento y el schema alguna vez
> no coinciden, el schema manda.

SQLite (`data/app.db`, gitignored), un solo archivo, Prisma 7 con driver
adapter (`@prisma/adapter-better-sqlite3`), sin query engine embebido.
Cliente generado en `src/generated/prisma` (también gitignored, se
regenera con `npx prisma generate`).

## Diagrama entidad-relación

Dividido en tres partes para que se lea; las relaciones con `User` se
repiten donde hace falta.

### Respuestas e interacción

```mermaid
erDiagram
    User ||--o{ Response : "responde (una por día)"
    Response ||--o{ Reaction : "recibe"
    Response ||--o{ Comment : "recibe"
    Comment ||--o{ CommentReaction : "recibe"
    User ||--o{ Reaction : "reacciona"
    User ||--o{ Comment : "comenta"
    User ||--o{ CommentReaction : "reacciona"

    User {
        string id PK
        string name UK "nombre real, lo administra el admin"
        string username UK "apodo opcional, se edita en /perfil"
        string email UK
        datetime emailVerified "requerido por el adapter de Auth.js"
        Role role "MEMBER | ADMIN"
        boolean active "si es false, no puede iniciar sesión ni recibe correos"
        string birthday "YYYY-MM-DD, nullable, se edita en /perfil"
        boolean birthdayPromptDismissed "eligió no registrar su cumpleaños"
        string greetingEmoji "emoji (o emoticón de ASCII_PICKER) del saludo en la home, nullable, se edita en /perfil"
        datetime createdAt
    }

    Response {
        string id PK
        string userId FK
        string date "YYYY-MM-DD; único con userId"
        boolean atHome
        boolean arrivingLate "llega más tarde"
        string beforeHomePlan "nullable; requerido si arrivingLate"
        boolean stayedHome "hoy se quedó en casa"
        string homePlan "nullable"
        string awayPlan "nullable; requerido si no llega a casa"
        string tonightPlan "nullable; requerido si stayedHome"
        string food
        boolean goingOut "solo se pregunta si llega a la hora normal"
        string goingOutWhere "nullable"
        string note "nullable"
        string photoFilename "nullable, IMG/respuestas/..."
        string photoDescription "nullable; requerida si hay foto"
        string phraseText "nullable, frase mandada ese día"
        string phraseId "nullable, apunta a Phrase (sin FK real)"
        datetime createdAt
        datetime updatedAt
    }

    Reaction {
        string id PK
        string responseId FK
        string userId FK
        string emoji "emoji real o texto ascii"
        string kind "emoji | ascii"
        datetime createdAt
    }

    Comment {
        string id PK
        string responseId FK
        string userId FK
        string text
        datetime createdAt
    }

    CommentReaction {
        string id PK
        string commentId FK
        string userId FK
        string emoji
        string kind "emoji | ascii"
        datetime createdAt
    }
```

### Boletines, portada y envíos

```mermaid
erDiagram
    User ||--o{ Phrase : "aporta"
    User ||--o{ HeroPhoto : "aporta"
    User ||--o{ BirthdayNewsletter : "le dedican"
    User ||--o{ InactivityNudge : "recibe"
    HeroPhoto ||--o{ DailyPick : "elegida para un día"
    Phrase ||--o{ DailyPick : "elegida para un día"
    HeroPhoto ||--o{ BirthdayNewsletter : "portada de"

    Settings {
        int id PK "singleton, siempre 1"
        string newsletterName
        string tagline
        string greetingTemplate "admite {nombre}"
        string sendTime "HH:MM, hora local del servidor"
        boolean autoSend
        boolean reminderEnabled "1 h antes de sendTime"
        boolean lockResponsesAfterSend
        string fromName
        string fromEmail
        boolean heroEnabled
        string heroTitle
        string heroParagraph
        string heroImageUrl "vacío = foto automática"
        string heroLinkUrl
        string heroLinkText
        string selectedPhraseId "vacío = frase automática (sin FK real)"
        boolean birthdayEnabled
        string birthdaySendTime "HH:MM"
        string birthdayGreetingTemplate "admite {nombre}"
        string birthdayHeroTitle "admite {nombre} y {NOMBRE}"
        string birthdayHeroParagraph "admite {nombre} y {NOMBRE}"
        string birthdayTopTitle "admite {nombre} y {NOMBRE}"
    }

    Phrase {
        string id PK
        string text
        string date "YYYY-MM-DD, nullable; día en que se mandó"
        string authorId FK "nullable; null si la dio de alta el admin"
        datetime createdAt
    }

    HeroPhoto {
        string id PK
        string filename UK "IMG/foto.jpg o IMG/respuestas/..."
        string description "nullable"
        string date "YYYY-MM-DD, nullable; programada para ese día"
        string authorId FK "nullable"
        datetime createdAt
    }

    DailyPick {
        string date PK "YYYY-MM-DD"
        string heroPhotoId FK "nullable"
        boolean heroPhotoManual "elegida a mano por el admin"
        string phraseId FK "nullable"
    }

    NewsletterSend {
        string id PK
        string date UK "una fila por día, idempotencia"
        datetime sentAt
        int recipientCount
        int responseCount
        string status "sent | partial | failed"
        string error "nullable"
        string contentHtml "snapshot de lo enviado"
        string contentText "snapshot de lo enviado"
        string greetingTemplate "snapshot"
        string heroJson "snapshot de la portada"
        boolean archived "oculto en /boletines"
    }

    ReminderSend {
        string id PK
        string date UK "una fila por día, idempotencia"
        datetime sentAt
        int recipientCount
    }

    WeeklySummarySend {
        string weekStart PK "primer día de los 7 que cubre"
        string weekEnd
        datetime sentAt
        int recipientCount
        string status "sent | partial | failed | skipped_no_days"
        string error "nullable"
    }

    InactivityNudge {
        string id PK
        string userId FK
        string date "YYYY-MM-DD; único con userId"
        int missedDays "días sin responder al mandarlo"
        datetime sentAt
    }

    BirthdayNewsletter {
        string id PK
        string userId FK "quien cumple años"
        string date "YYYY-MM-DD; único con userId"
        string heroPhotoId FK "nullable"
        boolean heroPhotoManual
        string status "nullable hasta enviarse"
        datetime sentAt "nullable"
        int recipientCount
        int momentCount
        string error "nullable"
        string contentHtml "snapshot"
        string contentText "snapshot"
        string greetingTemplate "snapshot"
        string heroJson "snapshot de la portada"
        string momentsJson "snapshot del top 5: título + ids de Response"
        datetime createdAt
    }
```

### Comunicaciones y autenticación

```mermaid
erDiagram
    User ||--o{ Communication : "crea (admin)"
    User ||--o{ Session : "sesiones activas"
    User ||--o{ Account : "cuentas (sin uso hoy)"

    Communication {
        string id PK
        string subject
        string bodyHtml "HTML del editor, ya saneado"
        string bodyText
        string audience "all | selected"
        string recipientIds "JSON con ids de User si selected"
        string status "scheduled | sent | partial | failed"
        datetime scheduledAt
        datetime sentAt "nullable"
        int recipientCount
        string error "nullable"
        string createdById FK
        datetime createdAt
    }

    Session {
        string id PK
        string sessionToken UK
        string userId FK
        datetime expires
    }

    Account {
        string id PK
        string userId FK
        string provider
        string providerAccountId
    }

    VerificationToken {
        string identifier
        string token UK
        datetime expires
    }
```

## Notas sobre el modelo

### Usuarios

- **`User.name` vs `User.username`**: `name` es el nombre real, lo pone el
  admin y es único. `username` es un apodo opcional (también único, pero
  `NULL` no choca consigo mismo en SQLite) que cada quien edita en
  `/perfil`. Todo lo público (boletín, comentarios, reacciones) usa
  `username` si está puesto y si no `name` — ver `src/lib/display-name.ts`.
  El saludo del correo sí usa siempre `name`.
- **`User.active = false`** no borra nada: la persona no puede iniciar
  sesión ni recibe correos (boletín, recordatorio, avisos de interacción),
  pero sus respuestas siguen en el historial.
- **`User.birthday`** es la fecha completa, pero solo se usan mes y día
  (ver "Boletín de cumpleaños" abajo).

### Respuestas

- **`Response` es única por `(userId, date)`**: volver a responder el
  mismo día actualiza la fila. `date` es un string `"YYYY-MM-DD"`, no un
  `DateTime`, para no lidiar con zonas horarias al comparar fechas.
- **Los cuatro flujos del formulario** (llega a la hora normal, llega
  tarde, no llega, se quedó en casa) comparten la tabla: `atHome`,
  `arrivingLate` y `stayedHome` dicen cuál fue, y las reglas de qué campo
  es obligatorio en cada uno viven en `src/lib/response-schema.ts`.
- **Foto de la respuesta**: el archivo vive en `data/uploads/respuestas/`
  (fuera de `public/`, ver `ARQUITECTURA.md`), pero `photoFilename` guarda
  el nombre lógico `IMG/respuestas/<archivo>`, que es la URL con la que
  se sirve. Además se da de alta como `HeroPhoto` (con autor y fecha) para
  entrar a la rotación de portadas.
- **Frase de la respuesta**: `phraseText` guarda el texto (para precargar
  el formulario al editar) y `phraseId` apunta a la fila creada en
  `Phrase`, para actualizarla en vez de duplicarla. No es FK real.

### Interacción

- **`Reaction` y `CommentReaction`** tienen `@@unique([…Id, userId, emoji])`:
  una persona puede reaccionar con varios emojis distintos, pero solo una
  vez con cada uno; repetir el mismo lo quita (toggle). `kind` solo sirve
  para pintar distinto los emojis y los emoticones ascii. Están en tablas
  separadas para no mezclar reacciones a respuestas con reacciones a
  comentarios (p. ej. el top 5 de cumpleaños solo cuenta las primeras).
- **`Comment`** es un hilo plano por respuesta, en orden cronológico.
- Todo se borra en cascada con la respuesta o con el usuario.

### Portada del boletín

- **`HeroPhoto` se sincroniza sola** con lo que haya en `public/IMG`
  (`syncHeroPhotos()` en `src/lib/hero-photos.ts`): agrega las fotos
  nuevas y borra las que ya no están en disco. Las fotos de respuestas
  (`IMG/respuestas/…`) se excluyen de esa limpieza porque viven en otro
  lado.
- **`DailyPick`** fija la foto y la frase de la portada de un día la
  primera vez que se resuelven (o cuando el admin las elige a mano o las
  re-rola), para que la vista previa y el envío real coincidan y la
  portada no cambie sola a media tarde.
- **`Settings.selectedPhraseId`** no es FK real (vacío = modo automático);
  se resuelve en `src/lib/phrases.ts`.

### Envíos

- **Idempotencia**: `NewsletterSend` y `ReminderSend` tienen `date` único,
  y `BirthdayNewsletter` es único por `(userId, date)`. El worker revisa
  si ya existe el envío antes de mandar, así que aunque el cron corra de
  más o el proceso se reinicie, nunca sale dos veces lo mismo (salvo
  reenvío forzado desde el panel).
- **Snapshots congelados**: al enviarse, `NewsletterSend` y
  `BirthdayNewsletter` guardan el contenido tal cual salió
  (`contentHtml`, `contentText`, `heroJson` y, en cumpleaños,
  `momentsJson`). `/boletines` y el panel muestran eso en vez de
  reconstruirlo con los Ajustes actuales, que pueden haber cambiado. Los
  envíos anteriores a esos campos los tienen vacíos y se reconstruyen.
- **`BirthdayNewsletter`** es tabla aparte de `NewsletterSend` porque el
  día del cumpleaños también sale el diario (único por fecha). La fila
  nace al resolver la foto de portada (vista previa o envío) y hace de
  `DailyPick` de esa edición; `sentAt` se llena al enviarse.
- **`Communication`** son correos sueltos del admin, de inmediato o
  programados (`scheduledAt`); el worker manda los programados cuando
  llega su hora.
- **`WeeklySummarySend`** hace idempotente el resumen semanal (uno por
  semana, por `weekStart`). **`InactivityNudge`** guarda cada correo de
  "llevas N días sin responder": además de evitar repetirlo el mismo día,
  es el historial con el que se decide el siguiente (a los N, 2N, 3N…
  días de la misma racha; ver `pendingInactivityNudges()`).

### Otros

- **`Settings` es un singleton**: siempre `id = 1`, se crea con
  `upsert` la primera vez que hace falta, sin seed obligatorio.
- **`Account` / `Session` / `VerificationToken`** son los modelos estándar
  de `@auth/prisma-adapter`. `Account` existe por completitud, pero no
  hay login social: solo enlace mágico por correo.
- **Migraciones** en `prisma/migrations/`, aplicadas con
  `npx prisma migrate deploy` (nunca `migrate dev` fuera de desarrollo
  local). En SQLite, para agregar columnas se prefiere `ALTER TABLE …
  ADD COLUMN` escrito a mano: el `migrate diff` de Prisma a veces propone
  recrear la tabla completa, que es más riesgoso sobre datos reales.
