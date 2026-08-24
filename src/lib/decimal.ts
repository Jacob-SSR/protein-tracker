import { Prisma } from '@prisma/client'

type DecimalLike = Prisma.Decimal | number | string | null | undefined

/** Prisma.Decimal -> number สำหรับส่งออก JSON (JSON.stringify ของ Decimal ได้ string) */
export function num(value: DecimalLike): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

export function optionalNum(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null
  return num(value)
}

/** ปัดทศนิยม 2 ตำแหน่งแบบคงที่ ใช้ก่อนเขียนลง Decimal(x,2) ทุกครั้ง */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value)
}
