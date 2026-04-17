import { timingSafeEqual, createHash } from "node:crypto";

export function safeTokenMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(actualBytes, expectedBytes);
}

export function hashAccessCode(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
