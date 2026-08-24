import { z } from 'zod'
import { handle, ok, requireSession } from '@/lib/api'
import { prisma } from '@/lib/db/prisma'
import { requestMeta, writeAudit } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/permissions'
import { assertCanManageRole } from '@/lib/users/service'
import { badRequest, notFound } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession(ADMIN_ROLES)
    const { id } = await params
    const body = patchSchema.parse(await request.json())

    const target = await prisma.user.findUnique({
      where: { id },
      include: { patient: true },
    })
    if (!target) throw notFound('ไม่พบผู้ใช้')

    // ต้องมีสิทธิ์ทั้งกับ role เดิมและ role ใหม่ กัน ADMIN เลื่อนขั้นตัวเองผ่านคนอื่น
    assertCanManageRole(session, target.role)
    if (body.role) assertCanManageRole(session, body.role)

    if (body.role === 'USER' && !target.patient) {
      throw badRequest(
        'PATIENT_REQUIRED',
        'เปลี่ยนเป็นบัญชีผู้ป่วยไม่ได้ เพราะยังไม่มีข้อมูลผู้ป่วยผูกอยู่',
      )
    }
    if (body.isActive === false && target.id === session.userId) {
      throw badRequest('SELF_DEACTIVATE', 'ปิดใช้งานบัญชีตัวเองไม่ได้')
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data: body })
      await writeAudit(tx, {
        actorId: session.userId,
        action: 'USER_UPDATE',
        targetType: 'User',
        targetId: id,
        oldValue: {
          fullName: target.fullName,
          role: target.role,
          isActive: target.isActive,
        },
        newValue: {
          fullName: row.fullName,
          role: row.role,
          isActive: row.isActive,
        },
        ...requestMeta(request),
      })
      return row
    })

    return ok({
      user: {
        id: updated.id,
        fullName: updated.fullName,
        role: updated.role,
        isActive: updated.isActive,
      },
    })
  })
}
