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
  return NextResponse.json({
    bootId,
    inactivityTimeoutMinutes: settings?.inactivityTimeoutMinutes ?? 30,
  })
}
