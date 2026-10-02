import "dotenv/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getMailer, getFromAddress } from "@/lib/mailer";

// Chequeo de arranque: lo lanza cron (@reboot) cada vez que la computadora
// prende — por reinicio o porque volvió la luz. Va aparte de PM2 a propósito:
// si PM2 no logra levantar, este script igual corre y avisa del problema.
// Espera a que los procesos de PM2 estén "online" y a que el sitio responda
// (local y por el túnel de Cloudflare), y manda un correo a ADMIN_EMAIL con
// el resultado.
const LIVE_DIR = process.cwd();
const PUBLIC_URL = process.env.AUTH_URL ?? "http://localhost:3000";
const LOCAL_URL = "http://localhost:3000/";
const EXPECTED_PROCESSES = ["newsletter-web", "newsletter-worker", "newsletter-deploy-watcher", "cf-tunnel"];
// Tras un apagón el módem tarda en volver, y "next start" + el túnel también
// necesitan su rato. 10 min da margen antes de declarar que algo falló.
const DEADLINE_MS = 10 * 60 * 1000;
const POLL_MS = 15 * 1000;
const PM2_PID_FILE = path.join(os.homedir(), ".pm2", "pm2.pid");

type Check = { ok: boolean; detail: string };

function log(msg: string) {
  console.log(`[boot-check] ${new Date().toISOString()} ${msg}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// No llamar "pm2 jlist" si el daemon no está vivo: eso levantaría un daemon
// vacío y le ganaría al "pm2 resurrect" del servicio de systemd.
function pm2DaemonAlive(): boolean {
  try {
    const pid = Number(fs.readFileSync(PM2_PID_FILE, "utf8").trim());
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function checkPm2(): Check {
  if (!pm2DaemonAlive()) return { ok: false, detail: "PM2 no está corriendo (no levantó el servicio de arranque de PM2)." };
  try {
    const list = JSON.parse(execSync("pm2 jlist", { encoding: "utf8", timeout: 30_000 })) as {
      name: string;
      pm2_env: { status: string; restart_time: number };
    }[];
    const lines = EXPECTED_PROCESSES.map((name) => {
      const proc = list.find((p) => p.name === name);
      if (!proc) return { ok: false, text: `${name}: NO EXISTE en PM2` };
      return {
        ok: proc.pm2_env.status === "online",
        text: `${name}: ${proc.pm2_env.status} (reinicios: ${proc.pm2_env.restart_time})`,
      };
    });
    return { ok: lines.every((l) => l.ok), detail: lines.map((l) => l.text).join("\n") };
  } catch (error) {
    return { ok: false, detail: `No se pudo consultar PM2: ${String(error)}` };
  }
}

async function checkUrl(url: string): Promise<Check> {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    return { ok: res.status < 500, detail: `${url} → HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, detail: `${url} → sin respuesta (${error instanceof Error ? error.message : String(error)})` };
  }
}

function runningCommit(): string {
  try {
    return execSync("git log -1 --format='%h %s'", { cwd: LIVE_DIR, encoding: "utf8" }).trim();
  } catch {
    return "desconocido";
  }
}

async function notify(subject: string, body: string) {
  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    log("ADMIN_EMAIL no está definido; no se manda correo.");
    return;
  }
  // La red puede seguir volviendo aunque el sitio ya no responda (o al
  // revés), así que se reintenta el envío un buen rato.
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await getMailer().sendMail({ to, from: getFromAddress(), subject: `[Servidor] ${subject}`, text: body });
      log(`Correo enviado: ${subject}`);
      return;
    } catch (error) {
      log(`Intento ${attempt} de mandar el correo falló: ${error instanceof Error ? error.message : String(error)}`);
      await sleep(30_000);
    }
  }
  log("Se agotaron los intentos de mandar el correo.");
}

// Esta computadora arranca con la hora equivocada y la corrige al sincronizar
// por internet (salto de horas), así que los tiempos se miden con el reloj
// monotónico y la hora de encendido se calcula hasta el final, ya corregida.
const elapsedMs = () => performance.now();

async function main() {
  log("Computadora encendida. Esperando a que el servidor levante...");

  const start = elapsedMs();
  let checks: Check[] = [];
  while (true) {
    checks = [checkPm2(), await checkUrl(LOCAL_URL), await checkUrl(PUBLIC_URL)];
    if (checks.every((c) => c.ok) || elapsedMs() - start > DEADLINE_MS) break;
    await sleep(POLL_MS);
  }

  const ok = checks.every((c) => c.ok);
  const waited = Math.round((elapsedMs() - start) / 1000);
  const bootedAt = new Date(Date.now() - os.uptime() * 1000);
  const report = [
    `Encendido: ${bootedAt.toLocaleString("es-MX")}`,
    `Versión en vivo: ${runningCommit()}`,
    "",
    "Procesos PM2:",
    checks[0].detail,
    "",
    "Sitio:",
    checks[1].detail,
    checks[2].detail,
  ].join("\n");

  log(`${ok ? "Todo arriba" : "Hay problemas"} tras ${waited}s.\n${report}`);
  if (ok) {
    await notify("✅ Servidor reiniciado y funcionando", `La computadora se reinició y el servidor levantó bien en ${waited}s.\n\n${report}`);
  } else {
    await notify(
      "🚨 El servidor se reinició pero algo NO levantó",
      `La computadora se reinició y después de ${waited}s el servidor todavía no está completo. Revisa con "pm2 status" y "pm2 logs".\n\n${report}`
    );
  }
  getMailer().close();
}

main().catch((error) => {
  log(`Error inesperado: ${error instanceof Error ? error.stack : String(error)}`);
  process.exit(1);
});
