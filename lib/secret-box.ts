import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Reversible encryption for credentials the app must replay to third parties in clear text —
 * TOTVS TBC passwords (sent as HTTP Basic auth to the RM) and the SMTP password. A hash can't
 * be used here, the original value is required at call time.
 *
 * AES-256-GCM (authenticated: a tampered/foreign value fails to decrypt instead of yielding
 * garbage). Stored format: `enc:v1:<iv>:<authTag>:<ciphertext>` (base64 parts). The version
 * prefix leaves room for key rotation (a future `v2` with another key) without guessing.
 *
 * Values without the `enc:` prefix are legacy plain text and are returned unchanged by
 * `decryptSecret`, so already-stored passwords keep working until scripts/encrypt-credentials.ts
 * migrates them — deploying this never breaks a TOTVS integration by itself.
 */

const PREFIX = "enc:v1:";
const KEY_ENV = "CREDENTIALS_ENCRYPTION_KEY";
const IV_BYTES = 12;

function loadKey(): Buffer {
  const raw = process.env[KEY_ENV]?.trim();
  if (!raw) {
    throw new Error(
      `${KEY_ENV} ausente — configure a chave de criptografia de credenciais (gere com: openssl rand -base64 32).`
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${KEY_ENV} inválida — deve ser exatamente 32 bytes em base64 (gere com: openssl rand -base64 32).`);
  }
  return key;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  if (isEncrypted(plain)) return plain;
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Credencial criptografada em formato inválido.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = loadKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or tampered value — never fall back to sending the ciphertext as a password.
    throw new Error(`Não foi possível descriptografar a credencial — verifique se ${KEY_ENV} é a mesma usada para criptografá-la.`);
  }
}
