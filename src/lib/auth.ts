import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

export type Role = "ADMIN" | "OPERATOR" | "REPAIRMAN"

export interface SessionUser {
  id: string
  username: string
  fullName: string
  role: Role
}

const SECRET = process.env.AUTH_SECRET || "loco-service-dev-secret-change-me"
export const SESSION_COOKIE = "loco_session"
const SESSION_TTL = 60 * 60 * 24 * 7 // 7 days

// ---------- passwords (scrypt, built-in crypto) ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, "hex")
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

// ---------- session token: base64url(payload).hmac ----------

const b64u = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")

function sign(data: string) {
  return b64u(createHmac("sha256", SECRET).update(data).digest())
}

export function createSessionToken(userId: string): string {
  const payload = b64u(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL * 1000 }))
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string): string | null {
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  if (sign(payload) !== sig) return null
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString())
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null
    if (data.exp < Date.now()) return null
    return data.uid
  } catch {
    return null
  }
}

// ---------- route helpers ----------

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const uid = verifySessionToken(token)
  if (!uid) return null
  const user = await db.user.findUnique({ where: { id: uid } })
  if (!user || !user.active) return null
  return { id: user.id, username: user.username, fullName: user.fullName, role: user.role as Role }
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Throws 401/403 unless the caller has one of the allowed roles. */
export async function requireUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new HttpError(401, "ابتدا وارد سیستم شوید")
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new HttpError(403, "شما دسترسی لازم برای این عملیات را ندارید")
  }
  return user
}
