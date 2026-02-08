import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

const padSlipSequence = (value: number, width = 6) =>
  String(value).padStart(width, '0')

const buildSlipNumber = (format: string | null | undefined, slipId: number) => {
  const template = format && format.trim() ? format.trim() : 'PS-{SEQ}'
  if (template.includes('{SEQ}')) {
    return template.replaceAll('{SEQ}', padSlipSequence(slipId))
  }
  const trailingNumber = template.match(/(\d+)$/)
  if (trailingNumber) {
    const width = trailingNumber[1].length
    return template.slice(0, -width) + padSlipSequence(slipId, width)
  }
  return `${template}${padSlipSequence(slipId)}`
}

export async function GET() {
  const [settings, latest] = await Promise.all([
    prisma.companySettings.findFirst({
      select: { slipNumberFormat: true },
    }),
    prisma.packingSlip.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    }),
  ])

  const nextId = (latest?.id ?? 0) + 1
  const nextSlipNo = buildSlipNumber(settings?.slipNumberFormat, nextId)

  return NextResponse.json({ nextSlipNo })
}
