import { escapeHtml } from "./interpolate";

/**
 * WhatsApp templates are plain text using WhatsApp's own markup (*bold*, _italic_, ~strike~,
 * ```mono```), so the stored `bodyText` can be sent as-is once a provider is integrated.
 * This renders that markup to HTML for the in-app preview bubble.
 */
export function whatsappToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/```([\s\S]+?)```/g, '<code style="font-family:monospace">$1</code>')
    .replace(/(^|[\s(])\*(\S(?:[^*\n]*\S)?)\*(?=$|[\s.,!?)])/gm, "$1<strong>$2</strong>")
    .replace(/(^|[\s(])_(\S(?:[^_\n]*\S)?)_(?=$|[\s.,!?)])/gm, "$1<em>$2</em>")
    .replace(/(^|[\s(])~(\S(?:[^~\n]*\S)?)~(?=$|[\s.,!?)])/gm, "$1<s>$2</s>")
    .replace(/\n/g, "<br>");
}
