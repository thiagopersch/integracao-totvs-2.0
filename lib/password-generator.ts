const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*+-";
const ALL = UPPERCASE + LOWERCASE + DIGITS + SPECIAL;

function randomChar(charset: string): string {
  return charset[Math.floor(Math.random() * charset.length)];
}

/** Generates a random password guaranteed to satisfy `strongPasswordSchema` (8-32 chars, upper+lower+digit+special). */
export function generateTemporaryPassword(length = 12): string {
  const required = [randomChar(UPPERCASE), randomChar(LOWERCASE), randomChar(DIGITS), randomChar(SPECIAL)];
  const rest = Array.from({ length: length - required.length }, () => randomChar(ALL));
  const chars = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = chars[i]
    chars[i] = chars[j]
    chars[j] = temp
  }

  return chars.join("");
}
