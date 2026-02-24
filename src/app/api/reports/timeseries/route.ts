import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  bucketExpression,
  buildRawSlipWhereSql,
  parseReportFilters,
} from '@/lib/reporting'

export const dynamic = 'force-dynamic'

type Row = {
  bucket: string | null
  value: number | null
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
    const slipBucket = bucketExpression(filters.bucket, '"s"."slipDate"')
    const revisionBucket = bucketExpression(filters.bucket, '"r"."createdAt"')

    let rows: Row[] = []

    if (filters.metric === 'qty') {
      rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT
          ${slipBucket} AS "bucket",
          CAST(COALESCE(SUM("l"."qty"), 0) AS REAL) AS "value"
        FROM "PackingSlip" "s"
        INNER JOIN "PackingSlipLine" "l" ON "l"."slipId" = "s"."id"
        ${slipWhereSql}
        GROUP BY "bucket"
        ORDER BY "bucket" ASC
      `)
    } else if (filters.metric === 'revisions') {
      rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT
          ${revisionBucket} AS "bucket",
          CAST(COUNT("r"."id") AS INTEGER) AS "value"
        FROM "PackingSlipRevision" "r"
        INNER JOIN "PackingSlip" "s" ON "s"."id" = "r"."slipId"
        ${slipWhereSql}
        GROUP BY "bucket"
        ORDER BY "bucket" ASC
      `)
    } else {
      rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT
          ${slipBucket} AS "bucket",
          CAST(COUNT("s"."id") AS INTEGER) AS "value"
        FROM "PackingSlip" "s"
        ${slipWhereSql}
        GROUP BY "bucket"
        ORDER BY "bucket" ASC
      `)
    }

    return NextResponse.json({
      filters: {
        from: filters.from,
        to: filters.to,
        vendorId: filters.vendorId,
        customer: filters.customer,
        bucket: filters.bucket,
        metric: filters.metric,
      },
      points: rows.map((row) => ({
        bucket: row.bucket ?? '',
        value: toNumber(row.value),
      })),
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load timeseries report.' },
      { status: 500 }
    )
  }
}

