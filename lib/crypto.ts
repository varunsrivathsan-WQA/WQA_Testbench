import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { SECRET } from "./config";

function secret() {
  if (!SECRET) throw new Error("NEXTAUTH_SECRET is not set");
  return SECRET;
}

export function b64url(buf: Buffer) {
  return buf.toString("base64url");
}

export function sign(value: string) {
  return b64url(createHmac("sha256", secret()).update(value).digest()).slice(0, 32);
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function randomId(len = 12) {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = scryptSync(pw, salt, 32);
  return `scrypt$${b64url(salt)}$${b64url(key)}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [, saltB64, keyB64] = stored.split("$");
  if (!saltB64 || !keyB64) return false;
  const key = scryptSync(pw, Buffer.from(saltB64, "base64url"), 32);
  return timingSafeEqual(key, Buffer.from(keyB64, "base64url"));
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** Short-lived token that lets the player's iframe load a drop's files. */
export function assetToken(slug: string, version: number, ttlMs = 12 * 3600_000) {
  const exp = Math.floor((Date.now() + ttlMs) / 1000).toString(36);
  return `${exp}.${sign(`asset:${slug}:${version}:${exp}`)}`;
}

export function checkAssetToken(token: string, slug: string, version: number) {
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (parseInt(exp, 36) * 1000 < Date.now()) return false;
  return safeEqual(sig, sign(`asset:${slug}:${version}:${exp}`));
}

export function unlockValue(slug: string, passwordVersion: number) {
  return sign(`unlock:${slug}:${passwordVersion}`);
}
