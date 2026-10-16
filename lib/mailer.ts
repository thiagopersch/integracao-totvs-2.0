import { decryptSecret } from "@/lib/secret-box";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type EmailSendStatus = "SENT" | "SKIPPED" | "FAILED";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/** No-op (logged) when the organization hasn't configured Email settings (or disabled them) —
 *  configured per organization in the `email_settings` table (see /integrations/email), not .env.
 *  Every attempt (skipped, sent, or failed) is persisted to EmailLog so it shows up in the
 *  centralized activity tracking page — `userId` here is the notification's recipient, used only
 *  for tenant/actor bookkeeping on the log row, not for permission checks. `options.cc` recipients
 *  are listed in the log's `to` column as "a@x.com (cc: b@y.com)"; `options.html` is sent as the
 *  HTML part alongside the plain-text `text`; `options.attachments` file names are appended to the
 *  log's subject as "[anexos: a.xlsx]". `to` may list several recipients. Returns the outcome
 *  logged to EmailLog. */
export async function sendEmail(
  organizationId: string,
  to: string | string[],
  subject: string,
  text: string,
  userId?: string,
  options?: { cc?: string[]; html?: string; attachments?: EmailAttachment[] }
): Promise<EmailSendStatus> {
  const toList = (Array.isArray(to) ? to : [to]).filter(Boolean);
  const cc = options?.cc?.filter(Boolean) ?? [];
  const attachments = options?.attachments ?? [];
  const toLabel = toList.join(", ");
  const logTo = cc.length ? `${toLabel} (cc: ${cc.join(", ")})` : toLabel;
  const logSubject = attachments.length ? `${subject} [anexos: ${attachments.map((a) => a.filename).join(", ")}]` : subject;
  const settings = await prisma.emailSettings.findUnique({ where: { organizationId } });
  if (!settings || !settings.enabled) {
    logger.warn("Email não enviado: integração de e-mail não configurada/desativada", { organizationId, to: logTo, subject: logSubject });
    await prisma.emailLog.create({ data: { organizationId, userId, to: logTo, subject: logSubject, status: "SKIPPED" } });
    return "SKIPPED";
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.user, pass: decryptSecret(settings.password) },
  });

  try {
    await transporter.sendMail({
      from: settings.from,
      to: toList,
      cc: cc.length ? cc : undefined,
      subject,
      text,
      html: options?.html,
      attachments: attachments.length ? attachments : undefined,
    });
    await prisma.emailLog.create({ data: { organizationId, userId, to: logTo, subject: logSubject, status: "SENT" } });
    return "SENT";
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error("Falha ao enviar email de notificação", { to: logTo, subject: logSubject, error: errorMessage });
    await prisma.emailLog.create({ data: { organizationId, userId, to: logTo, subject: logSubject, status: "FAILED", error: errorMessage } });
    return "FAILED";
  }
}
