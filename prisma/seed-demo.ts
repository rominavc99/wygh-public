/**
 * Seed de DATOS DE DEMOSTRACIÓN — separado a propósito de prisma/seed.ts
 * (ese es el seed real, el que crea el admin de producción). Este crea 5
 * usuarios de prueba con correos @example.test (dominio reservado que
 * nunca es una dirección real, RFC 2606), respuestas de los últimos 5
 * días, reacciones y comentarios, para poder ver el boletín interactivo
 * ya poblado.
 *
 * NUNCA se ejecuta como parte del seed real ni del auto-deploy — solo a
 * mano con `npm run seed:demo`, y se niega a correr si NODE_ENV=production
 * como red de seguridad extra (por si alguien lo corriera sin querer en
 * la PC de producción).
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { Role } from "../src/generated/prisma/enums";
import { previousLocalDate, todayLocalDate } from "../src/lib/date";

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "seed-demo.ts crea usuarios y datos falsos — no se corre con NODE_ENV=production. " +
      "Si de verdad quieres correrlo aquí, es porque algo está mal configurado; revisa antes de forzarlo."
  );
}

const DEMO_USERS = [
  { name: "Fer", email: "fer@example.test" },
  { name: "Bruno", email: "bruno@example.test" },
  { name: "Caro", email: "caro@example.test" },
  { name: "Dani", email: "dani@example.test" },
  { name: "Ximena", email: "ximena@example.test" },
];

const QUICK_EMOJIS = ["💖", "💯", "🔥", "🚬", "😂", "💩", "🫪"];
const EXTRA_EMOJIS = ["🎉", "😭", "👀", "🍕"];
const ASCII_SET = [":)", "xD", "¯\\_(ツ)_/¯", "(╯°□°)╯︵ ┻━┻", "ಠ_ಠ"];

const RESPONSE_TEMPLATES = [
  { homeStatus: "onTime" as const, homePlan: "Ver series y dormir temprano.", food: "Tacos de pastor", goingOut: false },
  { homeStatus: "onTime" as const, homePlan: "Terminar un pendiente del trabajo.", food: "Ensalada César", goingOut: true, goingOutWhere: "al gym" },
  { homeStatus: "later" as const, beforeHomePlan: "Junta con el equipo hasta tarde.", homePlan: "Cenar algo ligero y a dormir.", food: "Cereal" },
  { homeStatus: "away" as const, awayPlan: "Voy a cenar a casa de mis papás.", food: "Lo que hayan cocinado" },
  { homeStatus: "stayed" as const, homePlan: "Limpié toda la casa y adelanté trabajo.", tonightPlan: "Ver una película con palomitas.", food: "Pizza congelada" },
];

const NOTES = [
  "Alguien me debe un café ☕",
  "Cumplo años en dos semanas, ya saben",
  null,
  "Casi me quedo dormido en la junta",
  null,
];

const COMMENTS = [
  "jajaja clásico",
  "se antoja eso",
  "ánimo con la chamba",
  "cuídate mucho",
  "yo también quiero",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

async function main() {
  console.log("Borrando demo anterior (si había)...");
  const existing = await prisma.user.findMany({
    where: { email: { in: DEMO_USERS.map((u) => u.email) } },
    select: { id: true },
  });
  if (existing.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: existing.map((u) => u.id) } } });
  }

  console.log("Creando usuarios de demo...");
  const users = await Promise.all(
    DEMO_USERS.map((u) =>
      prisma.user.create({ data: { name: u.name, email: u.email, role: Role.MEMBER, active: true } })
    )
  );

  const dates: string[] = [todayLocalDate()];
  for (let i = 0; i < 4; i++) dates.push(previousLocalDate(dates[dates.length - 1]));
  dates.reverse(); // del más viejo al más nuevo

  // Un par de fotos "de respuesta" tomadas de las curadas del repo, para
  // que se vea cómo lucen las fotos de usuario en un par de tarjetas.
  const curatedDir = path.join(process.cwd(), "public", "IMG");
  const respuestasDir = path.join(curatedDir, "respuestas");
  await fs.mkdir(respuestasDir, { recursive: true });
  const curatedFiles = (await fs.readdir(curatedDir).catch(() => [])).filter((f) =>
    [".jpg", ".jpeg", ".png"].includes(path.extname(f).toLowerCase())
  );

  let seed = 0;

  for (const date of dates) {
    // No todos responden todos los días, para que también se vea "quién faltó".
    const respondents = users.filter((_, i) => (i + dates.indexOf(date)) % 5 !== 4);

    for (const user of respondents) {
      seed++;
      const template = pick(RESPONSE_TEMPLATES, seed);
      const note = pick(NOTES, seed);

      let photoFilename: string | null = null;
      let photoDescription: string | null = null;
      // Solo a dos respuestas en todo el demo, para no saturar.
      if (seed % 7 === 0 && curatedFiles.length > 0) {
        const source = pick(curatedFiles, seed);
        const ext = path.extname(source);
        photoFilename = `IMG/respuestas/demo-${user.id.slice(0, 6)}-${date}${ext}`;
        await fs.copyFile(path.join(curatedDir, source), path.join(process.cwd(), "public", photoFilename));
        photoDescription = "Foto de demo 📸";
        await prisma.heroPhoto.upsert({
          where: { filename: photoFilename },
          create: { filename: photoFilename, description: photoDescription, date, authorId: user.id },
          update: { description: photoDescription, date, authorId: user.id },
        });
      }

      const response = await prisma.response.upsert({
        where: { userId_date: { userId: user.id, date } },
        create: {
          userId: user.id,
          date,
          atHome: template.homeStatus !== "away",
          arrivingLate: template.homeStatus === "later",
          beforeHomePlan: template.homeStatus === "later" ? (template as { beforeHomePlan: string }).beforeHomePlan : null,
          homePlan: template.homeStatus !== "away" ? (template as { homePlan: string }).homePlan : null,
          awayPlan: template.homeStatus === "away" ? (template as { awayPlan: string }).awayPlan : null,
          stayedHome: template.homeStatus === "stayed",
          tonightPlan: template.homeStatus === "stayed" ? (template as { tonightPlan: string }).tonightPlan : null,
          food: template.food,
          goingOut: Boolean((template as { goingOut?: boolean }).goingOut),
          goingOutWhere: (template as { goingOutWhere?: string }).goingOutWhere ?? null,
          note,
          photoFilename,
          photoDescription,
        },
        update: {},
      });

      // Reacciones de 1 a 3 compañeros distintos.
      const reactors = users.filter((u) => u.id !== user.id);
      const reactorCount = 1 + (seed % 3);
      for (let i = 0; i < reactorCount; i++) {
        const reactor = reactors[(seed + i) % reactors.length];
        const useAscii = (seed + i) % 4 === 0;
        const emoji = useAscii ? pick(ASCII_SET, seed + i) : pick([...QUICK_EMOJIS, ...EXTRA_EMOJIS], seed + i);
        await prisma.reaction
          .create({
            data: {
              responseId: response.id,
              userId: reactor.id,
              emoji,
              kind: useAscii ? "ascii" : "emoji",
            },
          })
          .catch(() => {}); // por si el mismo (responseId,userId,emoji) ya salió al azar dos veces
      }

      // Un comentario cada tanto.
      if (seed % 2 === 0) {
        const commenter = reactors[seed % reactors.length];
        await prisma.comment.create({
          data: { responseId: response.id, userId: commenter.id, text: pick(COMMENTS, seed) },
        });
      }
    }

    // Registro de envío para que el día aparezca en /boletines (sin mandar
    // ningún correo real: se crea el registro directo, nunca se llama a
    // sendDailyNewsletter).
    await prisma.newsletterSend.upsert({
      where: { date },
      create: {
        date,
        recipientCount: respondents.length,
        responseCount: respondents.length,
        status: "sent",
      },
      update: {},
    });
  }

  // Un par de frases con autor, para que la portada de algún día muestre algo.
  await prisma.phrase.upsert({
    where: { id: "demo-phrase-1" },
    create: { id: "demo-phrase-1", text: "El que persevera, alcanza (pero llega tarde)", date: dates[dates.length - 1], authorId: users[0].id },
    update: {},
  });

  console.log(`Listo: ${users.length} usuarios, ${dates.length} días (${dates.join(", ")}), con respuestas, reacciones y comentarios.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
