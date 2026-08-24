import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError, forbidden, unauthorized } from '@/lib/errors'
import { getSession } from '@/lib/auth/session'
import type { AccessTokenPayload } from '@/lib/auth/jwt'
import { hasRole } from '@/lib/permissions'
import type { Role } from '@prisma/client'

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    )
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ถูกต้อง', details: error.issues } },
      { status: 400 },
    )
  }
  console.error('[api] unhandled error', error)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' } },
    { status: 500 },
  )
}

/** ครอบทุก route handler เพื่อแปลง error เป็น response รูปแบบเดียวกัน */
export async function handle<T>(fn: () => Promise<NextResponse<T>>) {
  try {
    return await fn()
  } catch (error) {
    return errorResponse(error)
  }
}

/** Authentication + Authorization ชั้นเดียวจบ ก่อนเข้า business logic */
export async function requireSession(roles?: Role[]): Promise<AccessTokenPayload> {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (roles && !hasRole(session, roles)) throw forbidden()
  return session
}
