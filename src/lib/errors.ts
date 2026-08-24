export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details)
export const unauthorized = (message = 'ต้องเข้าสู่ระบบก่อน') =>
  new AppError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้') =>
  new AppError(403, 'FORBIDDEN', message)
export const notFound = (message = 'ไม่พบข้อมูล') => new AppError(404, 'NOT_FOUND', message)
export const conflict = (code: string, message: string) => new AppError(409, code, message)
