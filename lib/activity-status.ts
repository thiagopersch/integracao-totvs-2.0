/** Non-numeric "Status" filter values for sources with no real HTTP-style code — CRUD is always
 *  successful, blocked deletions are always "skipped", e-mail has its own 3-value enum.
 *
 *  Lives outside `services/activity-log.service.ts` on purpose: that service file pulls in
 *  server-only modules (notification/mailer → nodemailer → Node's `child_process`), so importing
 *  a runtime value from it in a "use client" component (not just a `type`) bundles all of that
 *  into the browser and breaks the build. This file has no server-only imports. */
export const STATUS_SYMBOLS = {
  CRUD_OK: "CRUD_OK",
  EMAIL_SENT: "EMAIL_SENT",
  EMAIL_FAILED: "EMAIL_FAILED",
  EMAIL_SKIPPED: "EMAIL_SKIPPED",
  DELETION_BLOCKED: "DELETION_BLOCKED",
} as const;
