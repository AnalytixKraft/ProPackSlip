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
      by: ['vendorId'],
      where: { AND: [slipWhere, { vendorId: { not: null } }] },
      _count: { vendorId: true },
      orderBy: {
        _count: { vendorId: 'desc' },
      },
      take: filters.limit,
    })

    const vendorIds = rows
      .map((row) => row.vendorId)
      .filter((vendorId): vendorId is number => Number.isInteger(vendorId))

    const vendors =
      vendorIds.length > 0
        ? await prisma.vendor.findMany({
            where: { id: { in: vendorIds } },
            select: { id: true, name: true },
          })
        : []

    const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor.name]))

    return NextResponse.json({
      filters: {
        from: filters.from,
        to: filters.to,
        vendorId: filters.vendorId,
        customer: filters.customer,
        limit: filters.limit,
      },
      rows: rows.map((row) => ({
        vendorId: row.vendorId,
        vendorName:
          row.vendorId && vendorMap.get(row.vendorId)
            ? vendorMap.get(row.vendorId)
            : 'Unknown vendor',
        slipCount: row._count.vendorId,
      })),
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load top vendors report.' },
      { status: 500 }
    )
  }
}
