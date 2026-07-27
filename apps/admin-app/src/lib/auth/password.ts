import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const hash = Buffer.from(hashHex, "hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  if (derivedKey.length !== hash.length) return false;
  return timingSafeEqual(derivedKey, hash);
}

export const DUMMY_PASSWORD_HASH =
  "3267900d63056eb9e7322c93d51caed9:602c204da61a3e13c23febddf580123e7a261992131efa9f78ea0adc84dfd9fec6a4e2d351820ccd52fa0b56a404eb42420d66f5ddab4213481e593e61b6f5cf";
