import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const COMMON_EASY_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "admin123",
  "welcome1",
  "uoqlibrary",
  "library123",
  "uoq12345",
  "student123",
  "pakistan123",
]);

export function isTriviallySequentialOrRepeated(password: string): boolean {
  const lower = password.toLowerCase();
  // Repeating characters like aaaaaaaa or 11111111
  if (/^(.)\1+$/.test(lower)) {
    return true;
  }
  // Ascending sequence like 12345678 or abcdefgh
  const digits = "0123456789";
  const alpha = "abcdefghijklmnopqrstuvwxyz";
  if (digits.includes(lower) || alpha.includes(lower)) {
    return true;
  }
  return false;
}

export function validateStrongPassword(password: string, required = true): string | null {
  const value = password.trim();
  if (!value) {
    return required ? "Password is required." : null;
  }
  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (value.length > 72) {
    return "Password must be 72 characters or fewer.";
  }

  const lower = value.toLowerCase();
  if (COMMON_EASY_PASSWORDS.has(lower)) {
    return "This password is too common and easy to guess. Choose a stronger password.";
  }

  if (isTriviallySequentialOrRepeated(value)) {
    return "Password is too easy (avoid repeated or sequential characters).";
  }

  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigitOrSpecial = /[\d\W_]/.test(value);

  if (!hasUpper || !hasLower || !hasDigitOrSpecial) {
    return "Password must not be easy: include uppercase, lowercase, and a number or symbol.";
  }

  return null;
}

export function passwordFieldError(password: string, required: boolean) {
  return validateStrongPassword(password, required);
}

export function readPassword(body: unknown) {
  if (!body || typeof body !== "object" || !("password" in body)) {
    return "";
  }
  return typeof body.password === "string" ? body.password : "";
}

export function passwordForSave(body: unknown, required: boolean) {
  const password = readPassword(body);
  const error = passwordFieldError(password, required);
  if (error || !password.trim()) {
    return { error, hash: undefined as string | undefined };
  }
  return { error: null, hash: hashPassword(password) };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password.trim(), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  try {
    const actual = scryptSync(password.trim(), salt, 32);
    const expected = Buffer.from(hash, "hex");
    if (actual.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
