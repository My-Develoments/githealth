import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const PASSWORD_HASH_PREFIX = "scrypt";

function toBuffer(value: string): Buffer {
  return Buffer.from(value, "hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return [PASSWORD_HASH_PREFIX, salt, derivedKey.toString("hex")].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, salt, expectedHex] = storedHash.split("$");
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !expectedHex) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  const expected = toBuffer(expectedHex);

  if (expected.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expected, derivedKey);
}