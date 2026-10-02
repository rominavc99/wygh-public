import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { Role } from "../src/generated/prisma/enums";

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  const adminName = process.env.ADMIN_NAME;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminName || !adminEmail) {
    throw new Error("ADMIN_NAME y ADMIN_EMAIL son obligatorios en .env para el seed.");
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: adminName,
      email: adminEmail,
      role: Role.ADMIN,
      active: true,
    },
    update: {
      role: Role.ADMIN,
      active: true,
    },
  });

  console.log(`Listo: admin "${adminName}" <${adminEmail}> y Settings creados.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
