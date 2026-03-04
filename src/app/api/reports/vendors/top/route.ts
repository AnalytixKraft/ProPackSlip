import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildRawSlipWhereSql, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

type Row = {
  vendorId: number | string | null
  vendorName: string | null
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
    const includeNullVendor = searchParams.get('includeNullVendor') === '1'

    const slipWhereSql = buildRawSlipWhereSql(filters, 's')
    const nullableVendorSql =
      includeNullVendor || filters.vendorId
        ? Prisma.empty
        : Prisma.sql` AND "s"."vendorId" IS NOT NULL`

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        "s"."vendorId" AS "vendorId",
        COALESCE("v"."name", 'Unknown vendor') AS "vendorName",
        CAST(COUNT(DISTINCT "s"."id") AS INTEGER) AS "slipCount",
        CAST(COALESCE(SUM("l"."qty"), 0) AS REAL) AS "totalQty",
        CAST(COUNT("l"."id") AS INTEGER) AS "lineCount"
      FROM "PackingSlip" "s"
      INNER JOIN "PackingSlipLine" "l" ON "l"."slipId" = "s"."id"
      LEFT JOIN "Vendor" "v" ON "v"."id" = "s"."vendorId"
      ${slipWhereSql}
      ${nullableVendorSql}
      GROUP BY "s"."vendorId", "v"."name"
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
        includeNullVendor,
        limit: filters.limit,
      },
      vendors: rows.map((row) => ({
        vendorId: row.vendorId === null ? null : Math.trunc(toNumber(row.vendorId)),
        vendorName: row.vendorName ?? 'Unknown vendor',
        slipCount: Math.trunc(toNumber(row.slipCount)),
        totalQty: Number(toNumber(row.totalQty).toFixed(2)),
        lineCount: Math.trunc(toNumber(row.lineCount)),
      })),
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load top vendors report.' },
      { status: 500 }
    )
  }
}
