import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { isAdmin } from '@/lib/permissions'

export default async function Home() {
  const session = await getSession()
  if (!session) redirect('/login')
  redirect(isAdmin(session) ? '/admin/patients' : '/patient/dashboard')
}
