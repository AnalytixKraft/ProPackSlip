import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildRawSlipWhereSql, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

type Row = {
  totalQty: number | string | bigint | null
  lineCount: number | string | bigint | null
  slipCount: number | string | bigint | null
  distinctItems: number | string | bigint | null
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = parseReportFilters(searchParams)
    const slipWhereSql = buildRawSlipWhereSql(filters, 's')

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        CAST(COALESCE(SUM("l"."qty"), 0) AS REAL) AS "totalQty",
        CAST(COUNT("l"."id") AS INTEGER) AS "lineCount",
        CAST(COUNT(DISTINCT "s"."id") AS INTEGER) AS "slipCount",
        CAST(COUNT(DISTINCT "l"."itemId") AS INTEGER) AS "distinctItems"
      FROM "PackingSlip" "s"
      INNER JOIN "PackingSlipLine" "l" ON "l"."slipId" = "s"."id"
      ${slipWhereSql}
    `)

    const summary = rows[0]

    const totalQty = Number(toNumber(summary?.totalQty).toFixed(2))
    const lineCount = Math.trunc(toNumber(summary?.lineCount))
    const slipCount = Math.trunc(toNumber(summary?.slipCount))
    const distinctItems = Math.trunc(toNumber(summary?.distinctItems))

    return NextResponse.json({
      filters: {
        from: filters.from,
        to: filters.to,
        bucket: filters.bucket,
        vendorId: filters.vendorId,
        customer: filters.customer,
      },
      summary: {
        totalQty,
        lineCount,
        slipCount,
        distinctItems,
        avgQtyPerSlip: slipCount > 0 ? Number((totalQty / slipCount).toFixed(2)) : 0,
        avgQtyPerLine: lineCount > 0 ? Number((totalQty / lineCount).toFixed(2)) : 0,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load shipped item summary.' },
      { status: 500 }
    )
  }
}
