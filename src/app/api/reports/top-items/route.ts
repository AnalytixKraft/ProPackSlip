import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPackingSlipWhere, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

type TopItemsMode = 'qty' | 'freq'

const parseMode = (raw: string | null): TopItemsMode =>
  raw === 'freq' ? 'freq' : 'qty'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = parseReportFilters(searchParams)
    const mode = parseMode(searchParams.get('mode'))
    const slipWhere = buildPackingSlipWhere(filters)

    const grouped = await prisma.packingSlipLine.groupBy({
      by: ['itemId'],
      where: { slip: slipWhere },
      _sum: { qty: true },
      _count: { itemId: true },
      orderBy:
        mode === 'freq'
          ? { _count: { itemId: 'desc' } }
          : { _sum: { qty: 'desc' } },
      take: filters.limit,
    })

    const itemIds = grouped.map((row) => row.itemId)
    const items =
      itemIds.length > 0
        ? await prisma.item.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, name: true, sku: true, unit: true },
          })
        : []
    const itemMap = new Map(items.map((item) => [item.id, item]))

    return NextResponse.json({
      filters: {
        from: filters.from,
        to: filters.to,
        vendorId: filters.vendorId,
        customer: filters.customer,
        limit: filters.limit,
        mode,
      },
      rows: grouped.map((row) => {
        const item = itemMap.get(row.itemId)
        return {
          itemId: row.itemId,
          itemName: item?.name ?? `Item #${row.itemId}`,
          sku: item?.sku ?? '',
          unit: item?.unit ?? '',
          totalQty: Number(row._sum.qty ?? 0),
          lineCount: row._count.itemId,
        }
      }),
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load top items report.' },
      { status: 500 }
    )
  }
}
