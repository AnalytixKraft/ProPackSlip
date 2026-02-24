import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPackingSlipWhere, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = parseReportFilters(searchParams)
    const slipWhere = buildPackingSlipWhere(filters)

    const rows = await prisma.packingSlip.groupBy({
      by: ['customerName'],
      where: slipWhere,
      _count: { customerName: true },
      orderBy: {
        _count: { customerName: 'desc' },
      },
      take: filters.limit,
    })

    return NextResponse.json({
      filters: {
        from: filters.from,
        to: filters.to,
        vendorId: filters.vendorId,
        customer: filters.customer,
        limit: filters.limit,
      },
      rows: rows.map((row) => ({
        customerName: row.customerName,
        slipCount: row._count.customerName,
      })),
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load top customers report.' },
      { status: 500 }
    )
  }
}
