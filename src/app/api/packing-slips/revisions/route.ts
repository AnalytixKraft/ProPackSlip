import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slipIdParam = searchParams.get('slipId')
  const slipId = slipIdParam ? Number(slipIdParam) : null

  const revisions = await prisma.packingSlipRevision.findMany({
    where: slipId && Number.isInteger(slipId) ? { slipId } : undefined,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(revisions)
}
