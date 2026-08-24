import { SignJWT, jwtVerify } from 'jose'
import type { Role } from '@prisma/client'

export type AccessTokenPayload = {
  userId: string
  role: Role
  /** patient.id — มีเฉพาะ role USER */
  patientId?: string
}

const ISSUER = 'protein-tracker'
const AUDIENCE = 'protein-tracker-app'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role, patientId: payload.patientId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? '8h')
    .sign(getSecret())
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    if (!payload.sub || typeof payload.role !== 'string') return null
    return {
      userId: payload.sub,
      role: payload.role as Role,
      patientId: typeof payload.patientId === 'string' ? payload.patientId : undefined,
    }
  } catch {
    return null
  }
}
