import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Isolated behind this one module so the provider can change (local
// SMTP catcher now, a real transactional provider later) without
// touching call sites — same adapter-isolation principle as
// src/storage.ts (04-tech-stack.md).

let transport: Transporter | undefined;

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    // Port 465 is implicit TLS; everything else (587, Mailpit's 1025, ...)
    // negotiates STARTTLS instead, so secure must stay false there.
    secure: Number(process.env.SMTP_PORT ?? 1025) === 465,
    // Mailpit (dev) takes unauthenticated connections, so auth is only
    // attached once SMTP_USER is set — real providers (Gmail, etc.)
    // always need it.
    ...(process.env.SMTP_USER && {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    }),
  });
  return transport;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  await getTransport().sendMail({
    from: process.env.SMTP_FROM ?? "Akosi Admin <admin@akosi.local>",
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
