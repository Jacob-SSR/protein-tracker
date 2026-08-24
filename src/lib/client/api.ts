/** helper ฝั่ง client — คู่กับรูปแบบ response ของ lib/api.ts */
export async function request<T = unknown>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {}
  const response = await fetch(url, {
    ...rest,
    headers: json ? { 'Content-Type': 'application/json', ...rest.headers } : rest.headers,
    body: json ? JSON.stringify(json) : rest.body,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `เกิดข้อผิดพลาด (${response.status})`)
  }
  return payload.data as T
}
