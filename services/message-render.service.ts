import { renderBlockTree, wrapEmailDocument } from "@/lib/message-templates/render-email";
import { applyConditionals, htmlToText, interpolate } from "@/lib/message-templates/interpolate";
import { defaultTemplate } from "@/lib/message-templates/defaults";
import { prisma } from "@/lib/prisma";
import { appUrl, buildGeneralVars, buildOrganizationVars, type TemplateVars } from "@/lib/message-templates/vars-builder";
import type { BlockTree } from "@/lib/message-templates/block-types";
import type { MessageTemplateEvent } from "@/lib/message-templates/events";
import { messageTemplateService } from "@/services/message-template.service";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  /** Id of the template used — null when the built-in default was used. */
  templateId: string | null;
}

/** Renders a subject + block tree with the given variables into a sendable email. */
export function renderEmailFromContent(subject: string, content: BlockTree, vars: TemplateVars): Omit<RenderedEmail, "templateId"> {
  const renderedSubject = interpolate(subject, vars, { escape: false }).replace(/\s+/g, " ").trim();
  const body = interpolate(applyConditionals(renderBlockTree(content, { baseUrl: appUrl() }), vars), vars);
  return { subject: renderedSubject, html: wrapEmailDocument(body, renderedSubject), text: htmlToText(body) };
}

/** Variables every email has (general + organization) — event-specific vars override them. */
async function baseVars(organizationId: string): Promise<TemplateVars> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, document: true },
  });
  return { ...buildGeneralVars(), ...buildOrganizationVars(organization) };
}

export const messageRenderService = {
  baseVars,

  /**
   * Email for an event: the organization's newest active EMAIL template, or the built-in default
   * (lib/message-templates/defaults.ts) when none exists. Always re-renders from the block tree
   * (`content`) — `bodyHtml` is only a cache and may predate renderer changes.
   */
  async renderEmail(organizationId: string, event: MessageTemplateEvent, specificVars: TemplateVars): Promise<RenderedEmail> {
    const vars = { ...(await baseVars(organizationId)), ...specificVars };
    const template = await messageTemplateService.findActive(organizationId, event, "EMAIL");
    if (template && Array.isArray(template.content) && template.content.length > 0) {
      return { ...renderEmailFromContent(template.subject, template.content as unknown as BlockTree, vars), templateId: template.id };
    }
    const fallback = defaultTemplate(event);
    return { ...renderEmailFromContent(fallback.subject, fallback.content, vars), templateId: null };
  },

  /** Whether the organization has an active EMAIL template for the event (vs. the plain-text legacy email). */
  async hasActiveEmailTemplate(organizationId: string, event: MessageTemplateEvent): Promise<boolean> {
    return !!(await messageTemplateService.findActive(organizationId, event, "EMAIL"));
  },
};
