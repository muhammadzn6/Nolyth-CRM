import { argon2id, hash, verify } from "argon2";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$F5q8tFrS7EVAm7/JnigLfQ$Yzd1kt17rS2tyWw+I8+OtfWL8vgDnzGbDE5OlBSD5Lw";

export function hashPassword(password: string) {
  return hash(password, { type: argon2id });
}

export async function verifyPassword(passwordHash: string | null | undefined, password: string) {
  const usablePasswordHash = passwordHash?.startsWith("$argon2id$") ? passwordHash : null;
  const hashToVerify = usablePasswordHash ?? DUMMY_PASSWORD_HASH;

  try {
    const matches = await verify(hashToVerify, password);

    return usablePasswordHash !== null && matches;
  } catch {
    await verify(DUMMY_PASSWORD_HASH, password);

    return false;
  }
}
