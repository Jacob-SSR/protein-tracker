import { NextResponse, type NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/session'
import { ADMIN_ROLES } from '@/lib/permissions'

/**
 * Next.js 16: Middleware ถูกเปลี่ยนชื่อเป็น Proxy (ทำงานเหมือนเดิม, default = Node.js runtime)
 *
 * ตรงนี้เป็นแค่ optimistic check เพื่อ redirect ให้ UX ดี
 * การตรวจสิทธิ์จริงอยู่ที่ requireSession() ใน route handler ทุกตัวเสมอ ห้ามพึ่งไฟล์นี้อย่างเดียว
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  const session = token ? await verifyAccessToken(token) : null

  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith('/admin') && !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.redirect(new URL('/patient/dashboard', request.url))
  }

  if (pathname.startsWith('/patient') && session.role !== 'USER') {
    return NextResponse.redirect(new URL('/admin/patients', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/patient/:path*'],
}
