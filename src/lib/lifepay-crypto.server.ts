// Server-only: hashing do PIN do LifePay. Nunca importe no navegador.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function verifyPinHash(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const actual = scryptSync(pin, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
