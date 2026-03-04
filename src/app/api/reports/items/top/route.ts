import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildRawSlipWhereSql, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

type TopItemsMode = 'qty' | 'freq'

type Row = {
  itemId: number | string | null
  sku: string | null
  name: string | null
  unit: string | null
  totalQty: number | string | bigint | null
  lineCount: number | string | bigint | null
  slipCount: number | string | bigint | null
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
    const mode: TopItemsMode = searchParams.get('mode') === 'freq' ? 'freq' : 'qty'

    const slipWhereSql = buildRawSlipWhereSql(filters, 's')
    const orderBySql =
      mode === 'freq'
        ? Prisma.raw('"lineCount" DESC, "totalQty" DESC')
        : Prisma.raw('"totalQty" DESC, "lineCount" DESC')

    const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        "i"."id" AS "itemId",
        "i"."sku" AS "sku",
        "i"."name" AS "name",
        "i"."unit" AS "unit",
        CAST(COALESCE(SUM("l"."qty"), 0) AS REAL) AS "totalQty",
        CAST(COUNT("l"."id") AS INTEGER) AS "lineCount",
        CAST(COUNT(DISTINCT "s"."id") AS INTEGER) AS "slipCount"
      FROM "PackingSlip" "s"
      INNER JOIN "PackingSlipLine" "l" ON "l"."slipId" = "s"."id"
      INNER JOIN "Item" "i" ON "i"."id" = "l"."itemId"
      ${slipWhereSql}
      GROUP BY "i"."id", "i"."sku", "i"."name", "i"."unit"
      ORDER BY ${orderBySql}
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
        mode,
      },
      items: rows.map((row) => ({
        itemId: toNumber(row.itemId),
        sku: row.sku ?? '',
        name: row.name ?? `Item #${row.itemId ?? ''}`,
        unit: row.unit ?? '',
        totalQty: Number(toNumber(row.totalQty).toFixed(2)),
        lineCount: Math.trunc(toNumber(row.lineCount)),
        slipCount: Math.trunc(toNumber(row.slipCount)),
      })),
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load top shipped items.' },
      { status: 500 }
    )
  }
}
