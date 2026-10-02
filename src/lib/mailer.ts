import { createTransport, type Transporter } from "nodemailer";

export function getSmtpConfig() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return {
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
}

let transporter: Transporter | undefined;

/** Transporte compartido (con pool de conexiones) para el envío masivo del boletín. */
export function getMailer(): Transporter {
  if (!transporter) {
    transporter = createTransport({ ...getSmtpConfig(), pool: true, maxConnections: 3 });
  }
  return transporter;
}

export function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "";
}
