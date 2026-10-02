# De regreso a casa — Especificación para desarrollo

> **Documento histórico**: es la especificación con la que arrancó el
> proyecto. Desde entonces cambió bastante (p. ej. el modelo de datos):
> la referencia actual es [`ARQUITECTURA.md`](./ARQUITECTURA.md),
> [`BASE-DE-DATOS.md`](./BASE-DE-DATOS.md) y, sobre todo, el código.

> Documento para entregar a **Claude Code**. Describe una app de newsletter diario entre amigos, autoalojada en una PC personal. Léelo completo antes de empezar y sigue el orden de construcción del final.

---

## 1. Concepto

Un newsletter diario y privado entre un grupo fijo de amigos (**máximo 15–20 personas**). Cada día, cada persona responde un formulario corto sobre qué hará al llegar a casa esa noche. A una hora configurada, la plataforma compila todas las respuestas del día y envía por correo un boletín bonito a todos los suscriptores.

Tres piezas:
1. **Formulario** para participantes (identificados por su cuenta).
2. **Panel de administración** para el dueño.
3. **Motor de boletín**: compila las respuestas del día, genera el HTML y lo envía automáticamente.

---

## 2. Decisiones tomadas (no cambiar sin motivo)

### 2.1 Identidad: cuentas sin contraseña (magic link)
- El grupo es fijo y pequeño, así que **el admin pre-registra a cada persona una sola vez** (nombre + correo). No hay registro abierto.
- El login es **passwordless con enlace mágico**: la persona escribe su correo, recibe un enlace de un solo uso y con eso entra. La sesión se mantiene con cookie segura por mucho tiempo, así que casi nunca vuelven a iniciar sesión.
- **Por qué así:** (a) el nombre queda ligado a la cuenta → **imposible duplicar nombres** (restricción `UNIQUE` en base de datos); (b) no se guardan contraseñas → no hay hashes que filtrar; (c) reutiliza la infraestructura de correo que ya se necesita; (d) solo los correos pre-registrados pueden entrar (control fuerte de acceso).
- **El formulario NO pide el nombre.** Se toma de la sesión. Se muestra en modo lectura ("Hola, {nombre}").

### 2.2 Stack (lo más simple y seguro para autoalojar)
- **Framework:** Next.js (App Router) + TypeScript. Un solo proyecto full-stack (UI + API en el mismo servidor).
- **Estilos:** Tailwind CSS.
- **Base de datos:** **SQLite** (un archivo en disco, cero servidor que administrar). Sobra para 15–20 usuarios.
- **ORM:** Prisma (consultas parametrizadas → sin inyección SQL).
- **Auth:** **Auth.js (NextAuth v5)** con el *Email provider* (magic link) + adaptador de Prisma + sesiones en base de datos. Maneja tokens de un solo uso, expiración, CSRF y cookies seguras por nosotros.
- **Correo:** **Nodemailer** sobre SMTP. Empieza con una cuenta de Gmail + *App Password* (suficiente para ~20 correos/día). El mismo transporte sirve para los enlaces mágicos y para el boletín.
- **Programación del envío:** un **worker** aparte con `node-cron` que revisa cada minuto si toca enviar.
- **Mantener procesos vivos:** **PM2** (auto-arranque al encender la PC y reinicio si algo falla).
- **Exposición a internet:** **Cloudflare Tunnel** (`cloudflared`) → URL pública con HTTPS, sin abrir puertos en el router. Requisito para que el magic link y las cookies seguras funcionen y para que los amigos entren desde sus casas.

> Usa las versiones **estables actuales** de cada paquete al momento de instalar. No fijes versiones viejas.

---

## 3. Modelo de datos (Prisma / SQLite)

`prisma/schema.prisma`. Incluye además los modelos estándar del adaptador de Auth.js (`Account`, `Session`, `VerificationToken`) — genéralos según la doc oficial del adaptador de Prisma.

```prisma
enum Role { MEMBER ADMIN }

model User {
  id        String   @id @default(cuid())
  name      String   @unique          // nombre único → sin duplicados
  email     String   @unique
  role      Role     @default(MEMBER)
  active    Boolean  @default(true)    // recibe el boletín / puede entrar
  createdAt DateTime @default(now())

  responses Response[]
  accounts  Account[]                  // Auth.js
  sessions  Session[]                  // Auth.js
}

model Response {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date          String                    // "YYYY-MM-DD" (fecha local del envío)

  atHome        Boolean                   // true = sí llega a casa
  homePlan      String?                   // qué hará al llegar (requerido si atHome)
  awayPlan      String?                   // para dónde va y a qué (requerido si !atHome)
  food          String                    // qué va a comer (siempre requerido)
  goingOut      Boolean                   // ¿va a salir?
  goingOutWhere String?                   // a dónde (requerido si goingOut)
  note          String?                   // algo que mencionar (opcional)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, date])                // una respuesta por persona por día (editable)
}

model Settings {
  id             Int     @id @default(1)  // fila única
  newsletterName String  @default("De regreso a casa")
  tagline        String  @default("Una nota diaria entre amigos")
  sendTime       String  @default("20:00") // "HH:MM" hora local del servidor
  autoSend       Boolean @default(true)    // enviar automáticamente
  fromName       String  @default("De regreso a casa")
  fromEmail      String  @default("")
}

model NewsletterSend {
  id             String   @id @default(cuid())
  date           String   @unique          // "YYYY-MM-DD" → evita doble envío
  sentAt         DateTime @default(now())
  recipientCount Int
  responseCount  Int
  status         String                     // "sent" | "partial" | "failed"
  error          String?
}
```

Notas:
- `@@unique([userId, date])`: si una persona vuelve a enviar el mismo día, se **actualiza** su respuesta (upsert), no se duplica.
- La tabla `Settings` siempre tiene una sola fila (id = 1); créala en el seed.

---

## 4. Autenticación y seguridad (lee esto con atención)

El usuario pidió explícitamente que **no haya brechas de seguridad**. Aplica todo lo siguiente:

1. **Solo correos pre-registrados pueden entrar.** En el callback `signIn` de Auth.js, rechaza cualquier correo que no exista en la tabla `User` o cuyo `active` sea `false`. No hay auto-creación de usuarios al iniciar sesión.
2. **Sin contraseñas.** Solo magic link. Auth.js genera tokens de un solo uso, con expiración corta, y los guarda hasheados en `VerificationToken`.
3. **Cookies de sesión** `httpOnly`, `Secure`, `SameSite=Lax` (defaults de Auth.js sobre HTTPS). Sesión larga (p. ej. 60–90 días) para baja fricción.
4. **`AUTH_SECRET` fuerte** (32+ bytes aleatorios) en `.env`. Nunca en el repo.
5. **Autorización en el servidor, en cada request.** El panel de admin y todas sus rutas/acciones verifican `session.user.role === "ADMIN"` **del lado del servidor** (no basta con ocultar botones en la UI). Middleware para proteger `/admin/*` y comprobación explícita en cada Server Action / route handler que muta datos.
6. **Validación de entrada con Zod** en cada endpoint y Server Action, con las reglas condicionales de la sección 5. Nunca confíes en la validación del cliente.
7. **Rate limiting** en el endpoint de envío de magic link y en el de guardar respuesta (p. ej. límite por IP/correo por ventana de tiempo) para evitar abuso. Un limitador en memoria simple es suficiente a esta escala.
8. **Prisma** con consultas parametrizadas (nunca SQL crudo con interpolación).
9. **Escapar/renderizar de forma segura** todo el contenido de usuario tanto en la web como en el HTML del correo (evitar inyección de HTML). React escapa por defecto; en el correo, construye el HTML escapando manualmente los campos de usuario.
10. **Endpoint del cron protegido:** si expones una ruta para disparar el envío (`/api/cron/send`), protégela con un `CRON_SECRET` (header o query). Idealmente el worker llama la función directamente y no expone ruta pública.
11. **Secretos fuera del repo:** `.gitignore` para `.env*` y el archivo `.db`. Permisos restrictivos en el archivo SQLite.
12. **HTTPS siempre**, vía Cloudflare Tunnel. Configura `AUTH_URL`/`NEXTAUTH_URL` con la URL pública HTTPS.
13. **Cabeceras de seguridad** básicas (CSP razonable, `X-Content-Type-Options: nosniff`, `Referrer-Policy`). Configúralas en `next.config` o middleware.

---

## 5. Formulario (participante)

El participante ya está identificado (nombre de la sesión, mostrado en lectura). Campos, en orden:

| # | Pregunta (label) | Campo | Tipo UI | Requerido |
|---|---|---|---|---|
| — | Nombre | (de la sesión) | texto en lectura | — |
| 1 | ¿Qué vas a hacer cuando llegues a tu casa? | `homePlan` | textarea | **Sí**, salvo que se marque el check de abajo |
| 1b | ☐ No voy a llegar a mi casa | `atHome` (invertido) | checkbox | — |
| 1c | ¿Para dónde vas y a qué? | `awayPlan` | textarea | **Sí, solo si** el check está marcado (aparece oculto hasta entonces) |
| 2 | ¿Qué vas a comer? | `food` | texto/textarea | **Sí** |
| 3 | ¿Vas a salir? | `goingOut` | Sí / No (radio o toggle) | **Sí** |
| 3b | ¿A dónde? | `goingOutWhere` | texto | **Sí, solo si** respondió "Sí" (aparece al elegir Sí) |
| 4 | ¿Algo que quieras mencionar? | `note` | textarea | No (opcional) |

### Lógica condicional (aplícala en cliente para UX y **de nuevo en el servidor** para seguridad)
- `atHome = !checkboxNoVoyACasa`.
- Si `atHome === true` → `homePlan` requerido; `awayPlan` se ignora/queda null.
- Si `atHome === false` → mostrar y requerir `awayPlan`; `homePlan` queda null.
- `food` siempre requerido.
- `goingOut` siempre requerido (elección explícita Sí/No).
- Si `goingOut === true` → `goingOutWhere` requerido; si no, queda null.
- `note` siempre opcional.

### Comportamiento
- Al enviar: **upsert** por `(userId, date)` con `date` = fecha local de hoy. Si ya respondió hoy, precarga sus respuestas y permite editarlas.
- Mensaje de confirmación tras guardar.
- Responsive (móvil y escritorio).

---

## 6. Panel de administración (`/admin`, solo rol ADMIN)

Pestañas/secciones:

1. **Respuestas (histórico):** lista de todas las respuestas, filtrable por fecha y por persona. Mostrar quién respondió y quién no en un día dado.
2. **Usuarios:** crear / editar / desactivar usuarios (nombre + correo). El nombre es único (validar y mostrar error claro si se repite). Aquí se arma la lista fija de 15–20 personas. Poder marcar rol ADMIN.
3. **Boletín (componer y previsualizar):** elegir una fecha, ver la vista previa del correo (con toggle móvil/escritorio), y botones para **enviar ahora** y **reenviar**. Mostrar cuántas respuestas y cuántos destinatarios.
4. **Envíos (historial):** registro de `NewsletterSend` (fecha, hora, nº destinatarios, nº respuestas, estado, error si hubo).
5. **Ajustes:** nombre y lema del boletín, **hora de envío** (`sendTime`), interruptor de **envío automático** (`autoSend`), `fromName`/`fromEmail`. Editar los textos/labels de las preguntas es opcional (nice-to-have).

Todo con verificación de rol ADMIN en el servidor.

---

## 7. Motor de boletín y envío de correo

### 7.1 Compilación
- Función `buildNewsletter(date)`: lee todas las `Response` de esa fecha (con su `User.name`), y genera:
  - un **HTML de correo responsive** (tabla centrada de 600px, estilos inline, se ve bien en Gmail/Outlook/móvil), y
  - una versión de texto plano (fallback).
- El diseño: cabecera con el nombre del boletín y la fecha; una "tarjeta" por persona mostrando su plan (en casa o fuera), qué comerá, si sale y a dónde, y su nota si la dejó. Estética cálida tipo "ventana encendida al anochecer" (acento ámbar/dorado sobre fondo claro). Escapar todo el texto de usuario.

### 7.2 Envío
- `sendDailyNewsletter(date)`:
  1. Si ya existe `NewsletterSend` para esa fecha → no reenviar (idempotente), salvo llamada manual explícita de "reenviar".
  2. Construir el HTML una vez.
  3. Enviar un correo **individual a cada usuario `active`** (no BCC masivo: mejor entrega y nada de correos expuestos). Personalizar el saludo con su nombre.
  4. Registrar `NewsletterSend` con conteos y estado (`sent` / `partial` si algunos fallaron / `failed`).
- Manejar errores por destinatario sin abortar todo el lote.

### 7.3 Programación (worker con node-cron)
- Script `worker.ts` (proceso aparte, se mantiene vivo con PM2).
- `node-cron` corriendo **cada minuto**: obtiene `Settings`; si `autoSend` está activo, la hora local `HH:MM` coincide con `sendTime`, y **no existe** `NewsletterSend` para la fecha de hoy → llama `sendDailyNewsletter(today)`.
- Revisar cada minuto + el guardia de `NewsletterSend` permite cambiar la hora desde Ajustes sin reiniciar nada y evita envíos dobles.
- Zona horaria: usa la hora local del servidor (la PC). Documenta que la PC debe estar encendida y despierta a esa hora.

---

## 8. Variables de entorno (`.env`)

```dotenv
# App
AUTH_URL="https://TU-URL-PUBLICA"      # la que da Cloudflare Tunnel (HTTPS)
AUTH_SECRET="genera-32+ bytes aleatorios"   # p. ej. openssl rand -base64 32

# Base de datos
DATABASE_URL="file:./data/app.db"

# SMTP (para magic link y boletín)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="tucorreo@gmail.com"
SMTP_PASS="app-password-de-16-digitos"       # NO tu contraseña normal
EMAIL_FROM="De regreso a casa <tucorreo@gmail.com>"

# Cron (solo si expones una ruta de disparo; si el worker llama la función directo, no hace falta)
CRON_SECRET="otra-cadena-larga-aleatoria"

# Admin inicial (para el seed)
ADMIN_NAME="Tu Nombre"
ADMIN_EMAIL="tucorreo@gmail.com"
```

`.gitignore` debe incluir: `.env*`, `data/`, `*.db`.

---

## 9. Configuración del correo (paso a paso)

### Opción A — Gmail + App Password (más rápido para arrancar)
1. Activa la verificación en dos pasos en la cuenta de Google.
2. Crea una **App Password** (Google Account → Seguridad → Contraseñas de aplicaciones). Son 16 caracteres.
3. Ponla en `SMTP_PASS`. Usa `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465` (SSL) o `587` (STARTTLS).
4. Suficiente para ~20 correos/día. Aviso: pueden caer en spam al principio; pide a tus amigos marcar "no es spam".

### Opción B — Proveedor transaccional (mejor entrega, recomendado a mediano plazo)
- Usa **Resend**, **Postmark** o **Bramble/SES**. Verifica un dominio propio (SPF + DKIM) para que no caiga en spam. Cambia las variables SMTP por las del proveedor (o su SDK). Mantén el resto igual.

Empieza con A; migra a B si la entrega falla.

---

## 10. Instalación y ejecución en la PC

> Requisito: Node.js LTS instalado y una cuenta de Cloudflare (gratis).

```bash
# 1. Crear el proyecto e instalar dependencias (Claude Code lo hace)
#    next, react, typescript, tailwind, prisma, @prisma/client,
#    next-auth@beta (Auth.js v5), @auth/prisma-adapter, nodemailer,
#    node-cron, zod, pm2 (global o dev)

# 2. Base de datos
npx prisma migrate dev --name init
npm run seed          # crea Settings(id=1) y el usuario ADMIN inicial

# 3. Build y arranque
npm run build
pm2 start npm --name newsletter-web -- start        # la web (next start)
pm2 start npm --name newsletter-worker -- run worker # el worker de envío
pm2 save
pm2 startup          # para que arranquen solos al encender la PC

# 4. Exponer a internet con HTTPS (Cloudflare Tunnel)
#    Instala cloudflared, autentícate y crea el túnel apuntando a http://localhost:3000
cloudflared tunnel --url http://localhost:3000        # modo rápido (URL temporal)
#    Para URL estable: crea un túnel con nombre y (opcional) tu dominio, y córrelo con PM2 también.
```

Incluye scripts en `package.json`: `dev`, `build`, `start`, `worker` (ejecuta `worker.ts` con tsx/ts-node), `seed`.

El seed debe:
- Crear la fila `Settings` (id=1).
- Crear el usuario ADMIN desde `ADMIN_NAME`/`ADMIN_EMAIL`.
- (Opcional) aceptar una lista de amigos para pre-cargar los 15–20 usuarios.

---

## 11. Diseño / UI

- Estética cálida "de regreso a casa al anochecer": acento **ámbar/dorado** (lámpara encendida) sobre fondo claro; soporte de modo oscuro. Evita el look genérico (nada de crema + serif + terracota).
- Tipografía: una serif con carácter para títulos (p. ej. Fraunces) + una sans limpia para la interfaz (p. ej. Inter).
- Todo **responsive** (móvil primero). El correo también responsive y probado en cliente móvil.
- Accesible: foco visible por teclado, contraste suficiente, respeta `prefers-reduced-motion`.

---

## 12. Checklist de seguridad (verificar antes de dar por terminado)

- [ ] Solo correos pre-registrados y `active` pueden iniciar sesión (callback `signIn`).
- [ ] `/admin/*` y todas sus mutaciones verifican rol ADMIN en el servidor.
- [ ] Validación Zod en servidor con las reglas condicionales del formulario.
- [ ] Cookies `httpOnly`/`Secure`/`SameSite`; `AUTH_SECRET` fuerte.
- [ ] Rate limiting en magic-link y en guardar respuesta.
- [ ] Contenido de usuario escapado en web y en el HTML del correo.
- [ ] Endpoint de cron protegido con secreto (o worker sin ruta pública).
- [ ] `.env` y `*.db` fuera del repositorio.
- [ ] HTTPS vía Cloudflare Tunnel; `AUTH_URL` correcto.
- [ ] Cabeceras de seguridad configuradas.
- [ ] Restricción `UNIQUE` en `name` y `email` (sin duplicados).
- [ ] Envío idempotente por fecha (`NewsletterSend.date` único).

---

## 13. Orden de construcción sugerido (para Claude Code)

1. **Scaffolding:** Next.js + TypeScript + Tailwind. Estructura de carpetas.
2. **Prisma + SQLite:** schema (incluye modelos de Auth.js), `migrate`, script de seed.
3. **Auth.js (magic link):** Email provider + adaptador Prisma + callback `signIn` que solo admite correos pre-registrados. Página de login. Sesión larga.
4. **Formulario del participante:** UI responsive con la lógica condicional + validación Zod en servidor + upsert por `(userId, date)`.
5. **Panel de admin:** protección por rol; secciones Usuarios, Respuestas, Ajustes.
6. **Motor de boletín:** `buildNewsletter(date)` (HTML responsive + texto) y previsualización en el panel.
7. **Envío:** `sendDailyNewsletter(date)` con Nodemailer (envíos individuales) + registro en `NewsletterSend` + botones de enviar/reenviar en el panel.
8. **Worker:** `worker.ts` con node-cron (chequeo por minuto) respetando `sendTime`/`autoSend` e idempotencia.
9. **Endurecer:** rate limiting, cabeceras de seguridad, repaso del checklist de la sección 12.
10. **Despliegue:** PM2 (web + worker) + Cloudflare Tunnel + documentar el arranque en README.

---

## 14. Fuera de alcance (por ahora)
- Registro público / auto-alta de usuarios.
- Más de ~20 usuarios (SQLite y SMTP de Gmail siguen bien, pero revisa entrega si crece).
- App móvil nativa (la web responsive cubre el caso).
