# De regreso a casa

Boletín diario y privado para un grupo de amigos, autoalojado.

Cada día, cada quien cuenta en un formulario qué va a hacer al llegar a
su casa (o a dónde va, o qué hizo si se quedó en casa), con foto opcional.
A una hora fija sale un correo a todo el grupo con las respuestas del día.
En la web se puede reaccionar y comentar, y el día del cumpleaños de
alguien sale un boletín especial con sus mejores momentos del año.

Pensado para grupos chicos (~20 personas) y para correr en una
computadora propia, sin servicios de pago.

## Funcionalidades

- **Formulario diario** con cuatro flujos (llego a la hora normal, llego
  tarde, no llego, me quedé en casa), foto con descripción y "frase del
  día". Se guarda un borrador en el navegador para no perder nada si
  falla el envío.
- **Boletín diario por correo** con portada tipo periódico (foto, título,
  frase del día) y una tarjeta por respuesta. Recordatorio automático a
  quien no ha respondido.
- **Archivo interactivo** (`/boletines`): reacciones con emojis y
  emoticones de texto, comentarios, reacciones a comentarios y quién
  reaccionó con qué.
- **Boletín de cumpleaños**: portada con una foto de quien cumple años y
  el top 5 de sus respuestas del año con más interacciones.
- **Panel de administración**: usuarios, vista previa y envío del
  boletín, fotos y frases de portada, cumpleaños, historial de envíos,
  comunicaciones (correos sueltos, inmediatos o programados) y ajustes.
- **Login sin contraseña** (enlace mágico por correo). Sin auto-registro:
  solo entra quien un admin dio de alta.

Estética retro a propósito (Windows XP / MSN Messenger + periódico).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
Prisma 7 + SQLite · Auth.js v5 · Nodemailer · node-cron · sharp · Zod.

> ⚠️ **Next.js 16 tiene cambios importantes respecto a versiones
> anteriores** (p. ej. `middleware.ts` ahora es `proxy.ts`). Antes de
> tocar código, revisa la guía correspondiente en
> `node_modules/next/dist/docs/` — ver [`AGENTS.md`](AGENTS.md).

## Empezar en local

Requisito: Node.js 24.

```bash
git clone https://github.com/rominavc99/wygh-public.git
cd wygh-public
npm install
cp .env.example .env          # llena AUTH_SECRET y ADMIN_*; ver abajo
npx prisma migrate deploy     # crea data/app.db
npx prisma generate
npm run seed                  # crea los Ajustes y el admin de ADMIN_EMAIL
npm run seed:demo             # opcional: 5 usuarios y respuestas de ejemplo
npm run dev                   # http://localhost:3000
```

**Para entrar sin configurar correo**: deja `SMTP_HOST` vacío en `.env`.
En desarrollo, el enlace mágico se imprime en la terminal de `npm run dev`
en vez de enviarse. Escribe ahí el correo de `ADMIN_EMAIL` (o uno de los
de `seed:demo`, como `fer@example.test`) y abre el enlace que aparece.

Para probar los envíos programados, en otra terminal:

```bash
npm run worker
```

### Variables de entorno

Todas están en [`.env.example`](.env.example):

| Variable | Para qué |
|---|---|
| `AUTH_URL` | URL pública de la app (en local, `http://localhost:3000`). Se usa en los enlaces de los correos. |
| `AUTH_SECRET` | Secreto de Auth.js: `openssl rand -base64 32`. |
| `DATABASE_URL` | `file:./data/app.db`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Correo para el login y los boletines. Gmail con [contraseña de aplicación](https://support.google.com/accounts/answer/185833) sirve para empezar. |
| `ADMIN_NAME`, `ADMIN_EMAIL` | Admin inicial que crea `npm run seed`; también recibe los avisos del servidor. |
| `CRON_SECRET` | Reservado; hoy el worker no expone ninguna ruta. |
| `DEPLOY_BRANCH`, `DEPLOY_STAGING_DIR` | Opcionales, solo para el auto-deploy (ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)). |

### Fotos de portada

Suelta imágenes en `public/IMG/`: se sincronizan solas con el catálogo de
`/admin/fotos`. Esa carpeta está ignorada por git a propósito (son fotos
de tu grupo). Las fotos que la gente sube en sus respuestas se guardan en
`data/uploads/`, también ignorada.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Compilar / correr en producción. |
| `npm run worker` | Envíos programados (boletín, recordatorio, cumpleaños, comunicaciones). |
| `npm run lint` | ESLint. |
| `npm run typecheck` | Typecheck (genera los tipos de rutas de Next y corre `tsc`). |
| `npm run seed` / `npm run seed:demo` | Datos iniciales / datos de ejemplo. |
| `npm run deploy-watcher` | Auto-deploy opcional (ver `docs/DESPLIEGUE.md`). |

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md): cómo está construido.
- [`docs/BASE-DE-DATOS.md`](docs/BASE-DE-DATOS.md): modelo de datos.
- [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md): cómo hospedarlo en tu propia
  computadora (PM2, Cloudflare Tunnel, auto-deploy).
- [`docs/ESPECIFICACION-de-regreso-a-casa.md`](docs/ESPECIFICACION-de-regreso-a-casa.md):
  especificación original (histórica).

## Contribuir

¡Bienvenidas las contribuciones! Lee [`CONTRIBUTING.md`](CONTRIBUTING.md).
Para reportar una vulnerabilidad, ver [`SECURITY.md`](SECURITY.md).

## Licencia

[MIT](LICENSE).
