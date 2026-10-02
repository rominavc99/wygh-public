# Despliegue: hospedarlo en tu propia computadora

> Ver también: [`ARQUITECTURA.md`](./ARQUITECTURA.md). Esto describe la
> forma en que el proyecto se hospeda hoy (una PC con Linux siempre
> prendida); cualquier servidor con Node.js sirve igual.

## Piezas

| Proceso (PM2) | Qué hace |
|---|---|
| `newsletter-web` | `npm start`: la app Next.js. |
| `newsletter-worker` | `npm run worker`: cada minuto revisa si toca mandar el boletín, el recordatorio, un boletín de cumpleaños o una comunicación programada. |
| `newsletter-deploy-watcher` | Opcional. `npm run deploy-watcher`: auto-deploy al hacer push (ver abajo). |
| `cf-tunnel` | Opcional. `cloudflared`: expone la app en internet sin abrir puertos. |

Los tres primeros están en [`ecosystem.config.js`](../ecosystem.config.js).

## 1. Instalar y compilar

```bash
npm ci
cp .env.example .env              # con valores reales (SMTP incluido)
npx prisma migrate deploy
npx prisma generate
npm run seed
npm run build
```

En producción, `AUTH_URL` debe ser la URL pública real (la usan los
enlaces del correo) y el SMTP tiene que estar configurado.

## 2. Correr con PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js     # o --only newsletter-web,newsletter-worker
pm2 save
```

Para que revivan solos al reiniciar la computadora:

```bash
pm2 startup systemd               # imprime un comando con sudo: córrelo
pm2 save
```

- **Cada vez que agregues o quites un proceso, vuelve a correr
  `pm2 save`**: al arrancar, PM2 solo revive la lista guardada.
- Si cambias la versión de Node (p. ej. con `nvm`), corre
  `pm2 unstartup systemd` y repite `pm2 startup`, porque la ruta de Node
  queda fija en el servicio.
- Que la computadora prenda sola cuando vuelve la luz es una opción de la
  BIOS/UEFI ("Restore on AC Power Loss" → Power On).

Comandos útiles: `pm2 status`, `pm2 logs newsletter-web`,
`pm2 logs newsletter-worker`, `pm2 restart ecosystem.config.js`.

## 3. Exponerlo en internet con Cloudflare Tunnel

Necesitas un dominio con los nameservers en Cloudflare (plan gratis).

```bash
cloudflared tunnel login
cloudflared tunnel create <nombre-del-tunel>
cloudflared tunnel route dns <nombre-del-tunel> <subdominio.tu-dominio.com>
pm2 start cloudflared --name cf-tunnel -- tunnel run --url http://localhost:3000 <nombre-del-tunel>
pm2 save
```

Luego pon `AUTH_URL="https://<subdominio.tu-dominio.com>"` en `.env` y
reinicia con `pm2 restart newsletter-web --update-env`.

> **WAF de Cloudflare**: puede bloquear (403, sin llegar a tu servidor ni
> dejar log) peticiones con contenido binario que por azar parezca un
> ataque. Por eso las fotos se suben en base64. Si algo "truena" sin
> dejar rastro en `pm2 logs newsletter-web`, sospecha de esto primero.

## 4. Auto-deploy (opcional)

`deploy-watcher.ts` permite trabajar desde otra computadora: cada 2
minutos revisa si la rama de despliegue avanzó en `origin` y, si es así:

1. Prueba el commit nuevo en un **clon aparte** (staging): `npm ci`,
   `prisma generate` y `npm run build`.
2. **Si falla, no toca nada en vivo**, guarda el estado en
   `.deploy-state.json` y avisa por correo a `ADMIN_EMAIL`. Un commit que
   falla no se reintenta antes de 15 minutos.
3. Si pasa, aplica el commit en la carpeta en vivo (`git merge --ff-only`,
   `npm ci`, `prisma migrate deploy`, `prisma generate`, `npm run build`),
   reinicia la web y el worker, y avisa por correo.

Configuración (en `.env`):

- `DEPLOY_BRANCH`: rama a vigilar (por defecto `prod`).
- `DEPLOY_STAGING_DIR`: clon de staging (por defecto, una carpeta hermana
  llamada `<carpeta>-staging`).

Preparación, una sola vez:

```bash
cd ..
git clone <url-del-repo> <carpeta>-staging
cp <carpeta>/.env <carpeta>-staging/.env    # misma config; su DB queda aislada
cd <carpeta>
pm2 start ecosystem.config.js --only newsletter-deploy-watcher
pm2 save
```

- Si cambias un secreto en `.env`, cópialo también al de staging, o la
  validación puede fallar por eso.
- PM2 corre el watcher con `NODE_ENV=production`, que se hereda a
  `npm ci`; por eso el script usa `npm ci --include=dev` (sin eso se
  salta Tailwind/TypeScript y el build falla).
- **Seguridad**: el watcher ejecuta en tu computadora lo que llegue a esa
  rama. No lo apuntes a una rama en la que pueda escribir gente en quien
  no confíes; lo más seguro es desplegar desde tu propio fork.

## 5. Aviso por correo tras un reinicio (opcional)

`boot-check.ts` espera hasta 10 minutos a que los procesos estén online y
el sitio responda (local y en `AUTH_URL`), y manda el resultado a
`ADMIN_EMAIL`. Va aparte de PM2 para avisar aunque PM2 no levante. Para
que corra al prender la computadora, agrégalo al crontab
(`crontab -e`), ajustando las rutas:

```
@reboot cd /ruta/al/proyecto && PATH=/ruta/a/node/bin:/usr/bin:/bin npx tsx boot-check.ts >> ~/.pm2/logs/boot-check.log 2>&1
```

## Respaldos

Todo el estado vive en `data/` (base SQLite y fotos subidas) y en
`public/IMG/` (fotos de portada). Respaldar esas dos carpetas y `.env`
alcanza. Para copiar la base en caliente sin `sqlite3`:

```bash
node -e "new (require('node:sqlite').DatabaseSync)('data/app.db',{readOnly:true}).exec(\"VACUUM INTO 'respaldo.db'\")"
```
