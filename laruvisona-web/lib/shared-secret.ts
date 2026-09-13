import { timingSafeEqual } from 'node:crypto';

export function verifySharedSecret(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
