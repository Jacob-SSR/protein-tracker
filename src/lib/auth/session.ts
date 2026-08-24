import { cookies } from 'next/headers'
import { verifyAccessToken, type AccessTokenPayload } from './jwt'

export const ACCESS_TOKEN_COOKIE = 'access_token'

/** ห้ามเก็บ token ใน localStorage — HttpOnly cookie เท่านั้น */
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export async function setSessionCookie(token: string, maxAgeSeconds = 8 * 60 * 60) {
  const store = await cookies()
  store.set(ACCESS_TOKEN_COOKIE, token, {
    ...cookieOptions,
    maxAge: maxAgeSeconds,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.set(ACCESS_TOKEN_COOKIE, '', { ...cookieOptions, maxAge: 0 })
}

/** Authentication อย่างเดียว — "มึงคือใคร" ไม่ตัดสินสิทธิ์ */
export async function getSession(): Promise<AccessTokenPayload | null> {
  const store = await cookies()
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value
  if (!token) return null
  return verifyAccessToken(token)
}
