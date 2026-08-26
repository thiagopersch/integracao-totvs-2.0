import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** No-op (logged) when the organization hasn't configured Email settings (or disabled them) —
 *  configured per organization in the `email_settings` table (see /integrations/email), not .env. */
export async function sendEmail(organizationId: string, to: string, subject: string, text: string): Promise<void> {
  const settings = await prisma.emailSettings.findUnique({ where: { organizationId } });
  if (!settings || !settings.enabled) {
    logger.warn("Email não enviado: integração de e-mail não configurada/desativada", { organizationId, to, subject });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.user, pass: settings.password },
  });

  try {
    await transporter.sendMail({ from: settings.from, to, subject, text });
  } catch (error) {
    logger.error("Falha ao enviar email de notificação", { to, subject, error: (error as Error).message });
  }
}
