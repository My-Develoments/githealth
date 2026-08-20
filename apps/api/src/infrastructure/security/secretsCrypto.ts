import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function deriveAesKey(rawKey: string): Buffer {
  const normalized = rawKey.trim();

  if (normalized.length === 0) {
    throw new Error("Invalid secret encryption key.");
  }

  // Derive a stable 256-bit key without leaking raw key format constraints.
  return createHash("sha256").update(normalized, "utf8").digest();
}

export function encryptSecret(value: string, rawKey: string): EncryptedSecret {
  const key = deriveAesKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptSecret(payload: EncryptedSecret, rawKey: string): string {
  const key = deriveAesKey(rawKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}
