/** How a backup filter is identified across the UI and notifications: `CLIENTE | TBC | FILTRO`. */
export function formatBackupFilterLabel(parts: { clientName: string; tbcName: string; filter: string }): string {
  return `${parts.clientName} | ${parts.tbcName} | ${parts.filter}`;
}
