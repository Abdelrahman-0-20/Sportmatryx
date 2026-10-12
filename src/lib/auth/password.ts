import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

// scrypt parameters (OWASP-recommended for interactive logins):
// N=16384 (2^14), r=8, p=1 → derived key of 64 bytes.
const SCRYPT_N = 16384; void SCRYPT_N;
const SCRYPT_R = 8; void SCRYPT_R;
const SCRYPT_P = 1; void SCRYPT_P;
const KEY_LENGTH = 64;

const ALGORITHM = "scrypt";

/**
 * Hash a password for storage. Output format:
 *   scrypt$<saltHex>$<hashHex>
 * Verification relies on timingSafeEqual; no plaintext is ever stored.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(
    password.normalize("NFKC"),
    salt,
    KEY_LENGTH,
  );
  return `${ALGORITHM}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verify a password against a stored hash. Returns false for malformed
 * stored values instead of throwing, so legacy/invalid rows fail closed.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== ALGORITHM) return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

/** Cryptographically strong random token, hex-encoded (2*n chars). */
export function generateToken(nBytes = 32): string {
  return randomBytes(nBytes).toString("hex");
}
