import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** No-op (logged) when the organization hasn't configured Email settings (or disabled them) —
 *  configured per organization in the `email_settings` table (see /integrations/email), not .env.
 *  Every attempt (skipped, sent, or failed) is persisted to EmailLog so it shows up in the
 *  centralized activity tracking page — `userId` here is the notification's recipient, used only
 *  for tenant/actor bookkeeping on the log row, not for permission checks. */
export async function sendEmail(organizationId: string, to: string, subject: string, text: string, userId?: string): Promise<void> {
  const settings = await prisma.emailSettings.findUnique({ where: { organizationId } });
  if (!settings || !settings.enabled) {
    logger.warn("Email não enviado: integração de e-mail não configurada/desativada", { organizationId, to, subject });
    await prisma.emailLog.create({ data: { organizationId, userId, to, subject, status: "SKIPPED" } });
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
    await prisma.emailLog.create({ data: { organizationId, userId, to, subject, status: "SENT" } });
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error("Falha ao enviar email de notificação", { to, subject, error: errorMessage });
    await prisma.emailLog.create({ data: { organizationId, userId, to, subject, status: "FAILED", error: errorMessage } });
  }
}
