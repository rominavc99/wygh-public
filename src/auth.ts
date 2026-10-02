import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { createTransport } from "nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { magicLinkEmailHtml, magicLinkEmailText } from "@/lib/email-theme";
import { getSmtpConfig } from "@/lib/mailer";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSessionUser;
  }
}

// Reexportado para evitar depender del tipo interno exacto de next-auth.
type DefaultSessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: Role;
    active: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // El generador "prisma-client" de Prisma 7 emite el cliente en una ruta
  // propia del proyecto en vez de node_modules/@prisma/client; @auth/prisma-adapter
  // todavía tipa su parámetro contra el paquete clásico, así que el cast es
  // solo para TypeScript — en tiempo de ejecución el objeto tiene la misma forma.
  adapter: PrismaAdapter(prisma as never),
  // Autoalojado detrás de Cloudflare Tunnel (no es una plataforma
  // reconocida automáticamente por Auth.js) — AUTH_URL ya fija el host
  // esperado, así que esto no abre validación a hosts arbitrarios.
  trustHost: true,
  session: {
    strategy: "database",
    maxAge: 90 * 24 * 60 * 60, // 90 días
  },
  providers: [
    Nodemailer({
      server: getSmtpConfig(),
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url, provider }) {
        // Para desarrollar sin configurar correo: fuera de producción y sin
        // SMTP_HOST, el enlace se imprime en la terminal en vez de enviarse.
        if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST) {
          console.log(`\n🔑 Enlace para entrar como ${identifier}:\n${url}\n`);
          return;
        }
        const user = await prisma.user.findUnique({ where: { email: identifier } });
        // La verificación real de acceso ocurre en callbacks.signIn (que se
        // ejecuta antes que esta función); este chequeo es solo para poder
        // personalizar el saludo con el nombre del usuario.
        const name = user?.name ?? "";
        const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { newsletterName: true } });
        const newsletterName = settings?.newsletterName ?? "De regreso a casa";

        const transport = createTransport(provider.server);
        const result = await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: `Inicia sesión en ${newsletterName}`,
          text: magicLinkEmailText({ name, url }),
          html: magicLinkEmailHtml({ name, url, newsletterName }),
        });
        const failed = (result.rejected ?? []).concat(result.pending ?? []).filter(Boolean);
        if (failed.length) {
          throw new Error(`No se pudo enviar el correo a ${failed.join(", ")}`);
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Único punto de control de acceso: solo correos pre-registrados y
      // activos pueden entrar. Auth.js llama este callback ANTES de enviar
      // el correo con el enlace mágico, así que también evita mandar
      // enlaces a direcciones no registradas y evita la auto-creación de
      // usuarios.
      if (!user?.email) return false;
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
      return Boolean(dbUser?.active);
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = (user as { role: Role }).role;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verificar",
    error: "/login",
  },
});
