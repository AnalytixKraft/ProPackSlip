import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildRawSlipWhereSql, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

type Row = {
  slipId: number | string | null
  slipNo: string | null
  revisionCount: number | string | bigint | null
  lastRevisionAt: number | string | bigint | null
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toIsoString = (value: unknown) => {
  const numericValue = toNumber(value)
  if (numericValue > 0) {
    return new Date(numericValue).toISOString()
  }

  const parsedDate = new Date(String(value ?? ''))
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString()
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = parseReportFilters(searchParams)
    const slipWhereSql = buildRawSlipWhereSql(filters, 's')

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        "s"."id" AS "slipId",
        "s"."slipNo" AS "slipNo",
        CAST(COUNT("r"."id") AS INTEGER) AS "revisionCount",
        MAX("r"."createdAt") AS "lastRevisionAt"
      FROM "PackingSlip" "s"
      INNER JOIN "PackingSlipRevision" "r" ON "r"."slipId" = "s"."id"
      ${slipWhereSql}
      GROUP BY "s"."id", "s"."slipNo"
      ORDER BY "revisionCount" DESC, "lastRevisionAt" DESC
      LIMIT ${filters.limit}
    `)

    return NextResponse.json({
      filters: {
        from: filters.from,
        to: filters.to,
        bucket: filters.bucket,
        vendorId: filters.vendorId,
        customer: filters.customer,
        limit: filters.limit,
      },
      slips: rows.map((row) => ({
        slipId: Math.trunc(toNumber(row.slipId)),
        slipNo: row.slipNo ?? `#${row.slipId ?? ''}`,
        revisionCount: Math.trunc(toNumber(row.revisionCount)),
        lastRevisionAt: toIsoString(row.lastRevisionAt),
      })),
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load revision leaders.' },
      { status: 500 }
    )
  }
}
