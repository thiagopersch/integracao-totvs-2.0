import "dotenv/config";
import { prisma } from "../lib/prisma";
import { decryptSecret, encryptSecret, isEncrypted } from "../lib/secret-box";

/**
 * One-off, idempotent migration: encrypts the TBC (TOTVS RM) and SMTP passwords still stored in
 * plain text, using CREDENTIALS_ENCRYPTION_KEY (lib/secret-box.ts). Already-encrypted values are
 * skipped, so it's safe to re-run.
 *
 * Safety:
 *  - every value is encrypted, decrypted back and compared with the original BEFORE anything is
 *    written; any mismatch aborts the whole run without touching the database;
 *  - all updates run in a single transaction (all or nothing);
 *  - never prints a password — only ids/names and counts.
 *
 * The app keeps working before and after: plain-text values are still accepted when calling the
 * RM, so this can run at any time after deploying with the key configured.
 *
 * Usage:
 *   npx tsx scripts/encrypt-credentials.ts --dry-run   # shows what would change
 *   npx tsx scripts/encrypt-credentials.ts             # applies
 *
 * Back up the database first, and keep the key safe: losing it means re-typing every TBC/SMTP
 * password.
 */

const dryRun = process.argv.includes("--dry-run");

function encryptVerified(plain: string, label: string): string {
  const encrypted = encryptSecret(plain);
  if (decryptSecret(encrypted) !== plain) {
    throw new Error(`Verificação falhou para ${label} — nada foi alterado.`);
  }
  return encrypted;
}

async function main() {
  // Fails fast (before reading anything) if the key is missing/invalid.
  encryptSecret("key-check");

  const tbcs = await prisma.tbc.findMany({ select: { id: true, name: true, password: true } });
  const smtp = await prisma.emailSettings.findMany({ select: { id: true, organizationId: true, password: true } });

  const tbcUpdates = tbcs
    .filter((t) => t.password && !isEncrypted(t.password))
    .map((t) => ({ id: t.id, label: `TBC "${t.name}" (${t.id})`, password: encryptVerified(t.password, `TBC ${t.id}`) }));
  const smtpUpdates = smtp
    .filter((s) => s.password && !isEncrypted(s.password))
    .map((s) => ({
      id: s.id,
      label: `SMTP da organização ${s.organizationId}`,
      password: encryptVerified(s.password, `SMTP ${s.id}`),
    }));

  console.log(`TBCs: ${tbcs.length} no total, ${tbcUpdates.length} em texto puro a criptografar.`);
  console.log(`SMTP: ${smtp.length} no total, ${smtpUpdates.length} em texto puro a criptografar.`);
  for (const u of [...tbcUpdates, ...smtpUpdates]) console.log(`  - ${u.label}`);

  if (dryRun) {
    console.log("\n--dry-run: nenhuma alteração gravada.");
    return;
  }
  if (!tbcUpdates.length && !smtpUpdates.length) {
    console.log("\nNada a fazer.");
    return;
  }

  await prisma.$transaction([
    ...tbcUpdates.map((u) => prisma.tbc.update({ where: { id: u.id }, data: { password: u.password } })),
    ...smtpUpdates.map((u) => prisma.emailSettings.update({ where: { id: u.id }, data: { password: u.password } })),
  ]);

  console.log(`\n✅ ${tbcUpdates.length} TBC(s) e ${smtpUpdates.length} SMTP criptografado(s).`);
  console.log('Teste "Testar conexão" de um TBC em /admin/tbcs para confirmar a autenticação no RM.');
}

main()
  .catch((error) => {
    console.error("❌", (error as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
