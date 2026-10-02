import "dotenv/config";
import cron from "node-cron";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getMailer, getFromAddress } from "@/lib/mailer";

// Auto-deploy con validación previa: cada 2 minutos revisa si origin/prod
// avanzó. Si es así, primero intenta compilar el commit nuevo en un clon
// aparte (staging) — si eso falla, el sitio en vivo NO se toca. Solo
// si esa validación pasa se aplica el mismo commit acá y se reinicia PM2.
// Rama y carpeta de staging configurables por .env; por defecto, la rama
// "prod" y un clon hermano llamado "<esta carpeta>-staging".
const LIVE_DIR = process.cwd();
const STAGING_DIR = process.env.DEPLOY_STAGING_DIR || path.resolve(LIVE_DIR, "..", `${path.basename(LIVE_DIR)}-staging`);
const BRANCH = process.env.DEPLOY_BRANCH || "prod";
const STATE_FILE = path.join(LIVE_DIR, ".deploy-state.json");
const FAILURE_COOLDOWN_MS = 15 * 60 * 1000;
// "npm ci" a veces tarda mucho de pura espera de red (ej. descargar el
// binario precompilado de better-sqlite3 cuando cambia de versión) — se
// vio un caso real de 15+ min con casi nada de CPU real usada. 25 min da
// margen de sobra sin dejar de detectar un comando realmente colgado.
const CMD_TIMEOUT_MS = 25 * 60 * 1000;

type State = {
  lastDeployedSha?: string;
  lastAttemptSha?: string;
  lastAttemptStatus?: "success" | "failed";
  lastAttemptAt?: number;
};

function loadState(): State {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state: State) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: "utf8", timeout: CMD_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] });
}

function log(msg: string) {
  console.log(`[deploy] ${new Date().toISOString()} ${msg}`);
}

function errorOutput(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? "";
    return [stdout, stderr, e.message].filter(Boolean).join("\n").trim();
  }
  return String(error);
}

async function notify(subject: string, body: string) {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return;
  try {
    await getMailer().sendMail({
      to,
      from: getFromAddress(),
      subject: `[Servidor] ${subject}`,
      text: body,
    });
  } catch (error) {
    log(`No se pudo enviar la notificación por correo: ${errorOutput(error)}`);
  }
}

function shortLog(cwd: string, sha: string): string {
  try {
    return run(`git log -1 --format=%s ${sha}`, cwd).trim();
  } catch {
    return "";
  }
}

async function checkAndDeploy() {
  if (!fs.existsSync(STAGING_DIR)) {
    log(`No existe el directorio de staging (${STAGING_DIR}). Sáltate este chequeo.`);
    return;
  }

  run(`git fetch origin ${BRANCH}`, STAGING_DIR);
  const remoteSha = run(`git rev-parse origin/${BRANCH}`, STAGING_DIR).trim();
  const liveSha = run(`git rev-parse HEAD`, LIVE_DIR).trim();

  if (remoteSha === liveSha) return; // ya estamos al día

  const state = loadState();
  if (
    state.lastAttemptSha === remoteSha &&
    state.lastAttemptStatus === "failed" &&
    state.lastAttemptAt &&
    Date.now() - state.lastAttemptAt < FAILURE_COOLDOWN_MS
  ) {
    return; // ya sabemos que este commit falla, no lo reintentes cada 2 min
  }

  const commitMsg = shortLog(STAGING_DIR, remoteSha);
  log(`Nuevo commit en origin/${BRANCH}: ${remoteSha} "${commitMsg}". Validando en staging...`);

  try {
    run(`git reset --hard ${remoteSha}`, STAGING_DIR);
    // --include=dev: PM2 corre este proceso con NODE_ENV=production, y ese
    // env llega heredado a "npm ci" — sin esta bandera, npm se salta las
    // devDependencies (tailwind, typescript, etc.) y el build truena.
    run(`npm ci --include=dev`, STAGING_DIR);
    run(`npx prisma generate --schema prisma/schema.prisma`, STAGING_DIR);
    run(`npm run build`, STAGING_DIR);
  } catch (error) {
    const output = errorOutput(error);
    log(`Falló la validación en staging para ${remoteSha}:\n${output}`);
    saveState({ ...state, lastAttemptSha: remoteSha, lastAttemptStatus: "failed", lastAttemptAt: Date.now() });
    await notify(
      "🚨 Deploy falló (no se aplicó nada en vivo)",
      `El commit ${remoteSha} ("${commitMsg}") no compiló en el chequeo de staging, así que el sitio en vivo NO se tocó y sigue corriendo la versión anterior.\n\nError:\n${output.slice(0, 4000)}`
    );
    return;
  }

  log(`Staging validó ${remoteSha} correctamente. Aplicando en vivo...`);

  try {
    run(`git fetch origin ${BRANCH}`, LIVE_DIR);
    run(`git merge --ff-only origin/${BRANCH}`, LIVE_DIR);
    run(`npm ci --include=dev`, LIVE_DIR);
    run(`npx prisma migrate deploy --schema prisma/schema.prisma`, LIVE_DIR);
    run(`npx prisma generate --schema prisma/schema.prisma`, LIVE_DIR);
    run(`npm run build`, LIVE_DIR);
  } catch (error) {
    const output = errorOutput(error);
    log(`CRÍTICO: falló al aplicar ${remoteSha} en el directorio en vivo (ya validado en staging):\n${output}`);
    saveState({ ...state, lastAttemptSha: remoteSha, lastAttemptStatus: "failed", lastAttemptAt: Date.now() });
    await notify(
      "🔥 URGENTE: deploy falló a mitad de camino en el servidor en vivo",
      `El commit ${remoteSha} ("${commitMsg}") pasó la validación en staging pero falló al aplicarse en el directorio en vivo. Esto puede dejar el sitio en un estado inconsistente — revisa el servidor cuanto antes.\n\nError:\n${output.slice(0, 4000)}`
    );
    return;
  }

  run(`pm2 restart newsletter-web newsletter-worker`, LIVE_DIR);

  saveState({
    lastDeployedSha: remoteSha,
    lastAttemptSha: remoteSha,
    lastAttemptStatus: "success",
    lastAttemptAt: Date.now(),
  });
  log(`Desplegado ${remoteSha} ("${commitMsg}") y reiniciado PM2.`);
  await notify(
    "✅ Deploy exitoso",
    `Se desplegó el commit ${remoteSha} ("${commitMsg}") y ya está corriendo en ${process.env.AUTH_URL ?? "el servidor"}`
  );
}

cron.schedule("*/2 * * * *", () => {
  checkAndDeploy().catch((error) => {
    log(`Error inesperado en el chequeo de deploy: ${errorOutput(error)}`);
  });
});

log(`Deploy-watcher iniciado. Revisando origin/${BRANCH} cada 2 minutos (staging: ${STAGING_DIR}).`);
