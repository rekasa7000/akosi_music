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
    secure: false,
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
