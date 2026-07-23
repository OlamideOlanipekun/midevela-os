import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * Password hashing via Node's built-in scrypt — deliberately zero
 * external dependencies (this dev machine has no reliable native
 * module build toolchain). Format: "<hex salt>:<hex derived key>".
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const hash = Buffer.from(hashHex, "hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  if (derivedKey.length !== hash.length) return false;
  return timingSafeEqual(derivedKey, hash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain a special character.";
  return null;
}

/**
 * Not a real account's hash — a fixed, valid-format placeholder so login
 * can run a real scrypt computation against a nonexistent email instead of
 * skipping straight to "invalid". Without this, "no such user" returns
 * near-instantly while "wrong password" costs a real scrypt call, and that
 * timing gap lets an attacker enumerate valid emails even though both
 * cases return the identical error message.
 */
export const DUMMY_PASSWORD_HASH =
  "3267900d63056eb9e7322c93d51caed9:602c204da61a3e13c23febddf580123e7a261992131efa9f78ea0adc84dfd9fec6a4e2d351820ccd52fa0b56a404eb42420d66f5ddab4213481e593e61b6f5cf";
