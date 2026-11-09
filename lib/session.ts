export const SESSION_COOKIE = "uoq_session";

export type Role = "admin" | "user" | "student" | "teacher";

export type SessionIdentity = {
  role: Role;
  studentId?: number;
  teacherId?: number;
};

type SessionPayload = SessionIdentity & {
  exp: number;
};

const SESSION_SECONDS = 60 * 60 * 12;

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function safeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length === rightBytes.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return encode(new Uint8Array(signature));
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set.");
  }
  return secret;
}

export function roleForCredentials(username: string, password: string): Role | null {
  const adminUsername = process.env.ADMIN_USERNAME ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (
    adminUsername &&
    safeEqual(username, adminUsername) &&
    safeEqual(password, adminPassword)
  ) {
    return "admin";
  }

  const userUsername = process.env.USER_USERNAME ?? "";
  const userPassword = process.env.USER_PASSWORD ?? "";
  if (
    userUsername &&
    safeEqual(username, userUsername) &&
    safeEqual(password, userPassword)
  ) {
    return "user";
  }

  return null;
}

export async function createSessionToken(identity: SessionIdentity) {
  const payload: SessionPayload = {
    role: identity.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  if (identity.role === "student") {
    payload.studentId = identity.studentId;
  }
  if (identity.role === "teacher") {
    payload.teacherId = identity.teacherId;
  }
  const encoded = encode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encoded, sessionSecret());
  return `${encoded}.${signature}`;
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = await sign(encoded, sessionSecret());
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(decode(encoded)),
    ) as SessionPayload;
    if (!isSessionPayload(payload)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isSessionPayload(payload: SessionPayload) {
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  if (payload.role === "admin" || payload.role === "user") {
    return true;
  }
  if (payload.role === "student") {
    return isPositiveId(payload.studentId);
  }
  if (payload.role === "teacher") {
    return isPositiveId(payload.teacherId);
  }
  return false;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}
