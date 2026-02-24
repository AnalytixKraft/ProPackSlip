import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

const globalForBoot = globalThis as typeof globalThis & {
  __packproBootId?: string
}

const bootId =
  globalForBoot.__packproBootId ||
  (globalForBoot.__packproBootId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`)

export async function GET() {
  const settings = await prisma.companySettings.findFirst({
    select: { inactivityTimeoutMinutes: true },
  })
  const timeoutMinutes =
    typeof settings?.inactivityTimeoutMinutes === 'number' &&
    Number.isFinite(settings.inactivityTimeoutMinutes) &&
    settings.inactivityTimeoutMinutes > 0
      ? Math.max(Math.round(settings.inactivityTimeoutMinutes), 300)
      : 300
  return NextResponse.json({
    bootId,
    inactivityTimeoutMinutes: timeoutMinutes,
  })
}
