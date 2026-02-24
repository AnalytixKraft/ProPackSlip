import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPackingSlipWhere, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = parseReportFilters(searchParams)
    const slipWhere = buildPackingSlipWhere(filters)

    const [
      totalSlips,
      totalLines,
      trackingSlips,
      customers,
      vendors,
      totalRevisions,
    ] = await Promise.all([
      prisma.packingSlip.count({ where: slipWhere }),
      prisma.packingSlipLine.count({ where: { slip: slipWhere } }),
      prisma.packingSlip.count({
        where: {
          AND: [slipWhere, { trackingNumber: { not: null } }, { NOT: { trackingNumber: '' } }],
        },
      }),
      prisma.packingSlip.findMany({
        where: slipWhere,
        distinct: ['customerName'],
        select: { customerName: true },
      }),
      prisma.packingSlip.findMany({
        where: { AND: [slipWhere, { vendorId: { not: null } }] },
        distinct: ['vendorId'],
        select: { vendorId: true },
      }),
      prisma.packingSlipRevision.count({
        where: { slip: slipWhere },
      }),
    ])

    return NextResponse.json({
      filters: {
        from: filters.from,
        to: filters.to,
        vendorId: filters.vendorId,
        customer: filters.customer,
      },
      kpis: {
        totalSlips,
        totalLines,
        avgLinesPerSlip:
          totalSlips > 0 ? Number((totalLines / totalSlips).toFixed(2)) : 0,
        uniqueCustomers: customers.length,
        uniqueVendors: vendors.length,
        trackingPercent:
          totalSlips > 0
            ? Number(((trackingSlips / totalSlips) * 100).toFixed(1))
            : 0,
        totalRevisions,
        avgRevisionsPerSlip:
          totalSlips > 0 ? Number((totalRevisions / totalSlips).toFixed(2)) : 0,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load overview report.' },
      { status: 500 }
    )
  }
}

