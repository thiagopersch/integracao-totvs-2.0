import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type EmailSendStatus = "SENT" | "SKIPPED" | "FAILED";

/** No-op (logged) when the organization hasn't configured Email settings (or disabled them) —
 *  configured per organization in the `email_settings` table (see /integrations/email), not .env.
 *  Every attempt (skipped, sent, or failed) is persisted to EmailLog so it shows up in the
 *  centralized activity tracking page — `userId` here is the notification's recipient, used only
 *  for tenant/actor bookkeeping on the log row, not for permission checks. `options.cc` recipients
 *  are listed in the log's `to` column as "a@x.com (cc: b@y.com)"; `options.html` is sent as the
 *  HTML part alongside the plain-text `text`. Returns the outcome logged to EmailLog. */
export async function sendEmail(
  organizationId: string,
  to: string,
  subject: string,
  text: string,
  userId?: string,
  options?: { cc?: string[]; html?: string }
): Promise<EmailSendStatus> {
  const cc = options?.cc?.filter(Boolean) ?? [];
  const logTo = cc.length ? `${to} (cc: ${cc.join(", ")})` : to;
  const settings = await prisma.emailSettings.findUnique({ where: { organizationId } });
  if (!settings || !settings.enabled) {
    logger.warn("Email não enviado: integração de e-mail não configurada/desativada", { organizationId, to: logTo, subject });
    await prisma.emailLog.create({ data: { organizationId, userId, to: logTo, subject, status: "SKIPPED" } });
    return "SKIPPED";
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.user, pass: settings.password },
  });

  try {
    await transporter.sendMail({ from: settings.from, to, cc: cc.length ? cc : undefined, subject, text, html: options?.html });
    await prisma.emailLog.create({ data: { organizationId, userId, to: logTo, subject, status: "SENT" } });
    return "SENT";
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error("Falha ao enviar email de notificação", { to: logTo, subject, error: errorMessage });
    await prisma.emailLog.create({ data: { organizationId, userId, to: logTo, subject, status: "FAILED", error: errorMessage } });
    return "FAILED";
  }
}
