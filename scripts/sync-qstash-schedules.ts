/**
 * Creates/updates one QStash schedule per periodic task (lib/jobs/cron.ts → /api/cron/<task>) and
 * removes stale ones. Idempotent: run it after the first deploy and whenever a task or its cron
 * expression changes.
 *
 *   QSTASH_TOKEN=... JOBS_BASE_URL=https://seu-dominio npx tsx scripts/sync-qstash-schedules.ts
 *   (or `vercel env pull` first; `--dry-run` only prints what would change)
 *
 * Cron expressions are UTC (QStash). Each tick only enqueues the due work, so running every minute
 * is cheap; the jobs themselves run in /api/jobs/*.
 */
import "dotenv/config";
import { Client } from "@upstash/qstash";
import { CRON_TASKS } from "@/lib/jobs/cron";

const SCHEDULE_PREFIX = "cron-";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const token = process.env.QSTASH_TOKEN;
  const base = (process.env.JOBS_BASE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/+$/, "");
  if (!token) throw new Error("Defina QSTASH_TOKEN (Vercel > Storage/Marketplace > QStash, ou `vercel env pull`).");
  if (!/^https:\/\//.test(base)) throw new Error("Defina JOBS_BASE_URL com a URL pública https do app (ex.: https://app.seudominio.com.br).");

  const client = new Client({ token, baseUrl: process.env.QSTASH_URL || undefined });
  const existing = await client.schedules.list();
  const wanted = new Map(Object.entries(CRON_TASKS).map(([task, def]) => [`${SCHEDULE_PREFIX}${task}`, { task, cron: def.cron }]));

  for (const [scheduleId, { task, cron }] of wanted) {
    const destination = `${base}/api/cron/${task}`;
    const current = existing.find((s) => s.scheduleId === scheduleId);
    if (current && current.cron === cron && current.destination === destination) {
      console.log(`= ${scheduleId} (${cron} → ${destination})`);
      continue;
    }
    console.log(`${current ? "~" : "+"} ${scheduleId} (${cron} → ${destination})`);
    if (!dryRun) await client.schedules.create({ scheduleId, destination, cron, retries: 1, method: "POST" });
  }

  for (const schedule of existing) {
    if (schedule.scheduleId.startsWith(SCHEDULE_PREFIX) && !wanted.has(schedule.scheduleId)) {
      console.log(`- ${schedule.scheduleId} (${schedule.destination})`);
      if (!dryRun) await client.schedules.delete(schedule.scheduleId);
    }
  }
  console.log(dryRun ? "Simulação concluída (nada foi alterado)." : "Agendamentos do QStash sincronizados.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
