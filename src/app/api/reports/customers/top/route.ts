import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildRawSlipWhereSql, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

type Row = {
  customerName: string | null
  slipCount: number | string | bigint | null
  totalQty: number | string | bigint | null
  lineCount: number | string | bigint | null
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
        COALESCE("s"."customerName", '') AS "customerName",
        CAST(COUNT(DISTINCT "s"."id") AS INTEGER) AS "slipCount",
        CAST(COALESCE(SUM("l"."qty"), 0) AS REAL) AS "totalQty",
        CAST(COUNT("l"."id") AS INTEGER) AS "lineCount"
      FROM "PackingSlip" "s"
      INNER JOIN "PackingSlipLine" "l" ON "l"."slipId" = "s"."id"
      ${slipWhereSql}
      GROUP BY "s"."customerName"
      ORDER BY "slipCount" DESC, "totalQty" DESC
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
      customers: rows.map((row) => ({
        customerName: row.customerName || 'Unnamed customer',
        slipCount: Math.trunc(toNumber(row.slipCount)),
        totalQty: Number(toNumber(row.totalQty).toFixed(2)),
        lineCount: Math.trunc(toNumber(row.lineCount)),
      })),
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load top customers report.' },
      { status: 500 }
    )
  }
}
