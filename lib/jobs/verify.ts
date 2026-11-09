import { Receiver } from "@upstash/qstash";
import { timingSafeEqual } from "node:crypto";

/**
 * Who may call `/api/jobs/*` and `/api/cron/*`: QStash (signed with QSTASH_CURRENT/NEXT_SIGNING_KEY)
 * or, for cron only, Vercel Cron / an operator with `Authorization: Bearer $CRON_SECRET`. With
 * neither configured every call is refused — these routes run privileged work for any organization.
 */
const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
const next = process.env.QSTASH_NEXT_SIGNING_KEY;
const receiver = current && next ? new Receiver({ currentSigningKey: current, nextSigningKey: next }) : null;

export async function verifyQstashRequest(request: Request, body: string): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");
  if (!receiver || !signature) return false;
  try {
    return await receiver.verify({ signature, body, clockTolerance: 5 });
  } catch {
    return false;
  }
}

export function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
