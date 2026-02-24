import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPackingSlipWhere, parseReportFilters } from '@/lib/reporting'

export const dynamic = 'force-dynamic'

type SnapshotLine = {
  key: string
  qty: number
}

type SnapshotModel = {
  slipNo: string
  customerName: string
  boxNumber: string
  trackingNumber: string
  lines: SnapshotLine[]
}

type DiffSummary = {
  linesAdded: number
  linesRemoved: number
  qtyChanged: number
  customerChanged: boolean
  trackingChanged: boolean
  boxChanged: boolean
}

type LineAggregate = {
  count: number
  qty: number
}

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const toFiniteNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const buildLineKey = (line: Record<string, unknown>) => {
  const itemId = Number(line.itemId)
  const itemRef =
    Number.isInteger(itemId) && itemId > 0
      ? `id:${itemId}`
      : `name:${normalizeText(line.name).toLowerCase()}`
  const boxName = normalizeText(line.boxName).toLowerCase()
  const boxNumber = normalizeText(line.boxNumber).toLowerCase()
  return `${itemRef}|${boxName}|${boxNumber}`
}

const parseSnapshot = (raw: string): SnapshotModel | null => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null

    const rawLines = Array.isArray(parsed.lines)
      ? (parsed.lines as Array<Record<string, unknown>>)
      : []

    return {
      slipNo: normalizeText(parsed.slipNo),
      customerName: normalizeText(parsed.customerName),
      boxNumber: normalizeText(parsed.boxNumber),
      trackingNumber: normalizeText(parsed.trackingNumber),
      lines: rawLines
        .filter((line) => line && typeof line === 'object')
        .map((line) => ({
          key: buildLineKey(line),
          qty: toFiniteNumber(line.qty),
        })),
    }
  } catch {
    return null
  }
}

const toLineAggregate = (lines: SnapshotLine[]) => {
  const map = new Map<string, LineAggregate>()
  for (const line of lines) {
    const current = map.get(line.key)
    if (!current) {
      map.set(line.key, { count: 1, qty: line.qty })
      continue
    }
    current.count += 1
    current.qty += line.qty
    map.set(line.key, current)
  }
  return map
}

const buildDiffSummary = (
  previous: SnapshotModel,
  current: SnapshotModel
): DiffSummary => {
  const prevMap = toLineAggregate(previous.lines)
  const currentMap = toLineAggregate(current.lines)
  const allKeys = Array.from(
    new Set<string>(
      Array.from(prevMap.keys()).concat(Array.from(currentMap.keys()))
    )
  )

  let linesAdded = 0
  let linesRemoved = 0
  let qtyChanged = 0

  for (let index = 0; index < allKeys.length; index += 1) {
    const key = allKeys[index]
    const prev = prevMap.get(key)
    const next = currentMap.get(key)

    const prevCount = prev?.count ?? 0
    const nextCount = next?.count ?? 0

    if (nextCount > prevCount) linesAdded += nextCount - prevCount
    if (prevCount > nextCount) linesRemoved += prevCount - nextCount

    if (prev && next && Math.abs(prev.qty - next.qty) > 0.000001) {
      qtyChanged += 1
    }
  }

  return {
    linesAdded,
    linesRemoved,
    qtyChanged,
    customerChanged:
      previous.customerName.toLowerCase() !== current.customerName.toLowerCase(),
    trackingChanged:
      previous.trackingNumber.toLowerCase() !== current.trackingNumber.toLowerCase(),
    boxChanged: previous.boxNumber.toLowerCase() !== current.boxNumber.toLowerCase(),
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = parseReportFilters(searchParams)
    const slipWhere = buildPackingSlipWhere(filters)

    const grouped = await prisma.packingSlipRevision.groupBy({
      by: ['slipId'],
      where: { slip: slipWhere },
      _count: { slipId: true },
      orderBy: {
        _count: { slipId: 'desc' },
      },
      take: filters.limit,
    })

    const groupedSlipIds = grouped.map((row) => row.slipId)
    const slips =
      groupedSlipIds.length > 0
        ? await prisma.packingSlip.findMany({
            where: { id: { in: groupedSlipIds } },
            select: { id: true, slipNo: true, customerName: true },
          })
        : []
    const slipMap = new Map(slips.map((slip) => [slip.id, slip]))

    const mostEdited = grouped.map((row) => {
      const slip = slipMap.get(row.slipId)
      return {
        slipId: row.slipId,
        slipNo: slip?.slipNo ?? `#${row.slipId}`,
        customerName: slip?.customerName ?? '',
        revisionCount: row._count.slipId,
      }
    })

    const selectedSlipId = filters.slipId ?? mostEdited[0]?.slipId ?? null

    let selectedSlip: {
      slipId: number
      slipNo: string
      customerName: string
      totalRevisions: number
      invalidSnapshots: number
      summary: {
        linesAdded: number
        linesRemoved: number
        qtyChanged: number
        customerChanged: number
        trackingChanged: number
        boxChanged: number
      }
      timeline: Array<{
        revisionId: number
        version: number
        createdAt: string
        invalidSnapshot: boolean
        lineCount: number
        customerName: string
        diffSummary: DiffSummary | null
      }>
    } | null = null

    if (selectedSlipId) {
      const slip = await prisma.packingSlip.findFirst({
        where: { AND: [slipWhere, { id: selectedSlipId }] },
        select: { id: true, slipNo: true, customerName: true },
      })

      if (slip) {
        const revisions = await prisma.packingSlipRevision.findMany({
          where: { slipId: slip.id },
          orderBy: { version: 'asc' },
          select: { id: true, version: true, createdAt: true, snapshot: true },
        })

        let invalidSnapshots = 0
        let previousSnapshot: SnapshotModel | null = null
        let linesAdded = 0
        let linesRemoved = 0
        let qtyChanged = 0
        let customerChanged = 0
        let trackingChanged = 0
        let boxChanged = 0

        const timeline = revisions.map((revision) => {
          const parsed = parseSnapshot(revision.snapshot)
          if (!parsed) {
            invalidSnapshots += 1
            previousSnapshot = null
            return {
              revisionId: revision.id,
              version: revision.version,
              createdAt: revision.createdAt.toISOString(),
              invalidSnapshot: true,
              lineCount: 0,
              customerName: '',
              diffSummary: null,
            }
          }

          const diffSummary =
            previousSnapshot && revision.version > 1
              ? buildDiffSummary(previousSnapshot, parsed)
              : null

          if (diffSummary) {
            linesAdded += diffSummary.linesAdded
            linesRemoved += diffSummary.linesRemoved
            qtyChanged += diffSummary.qtyChanged
            if (diffSummary.customerChanged) customerChanged += 1
            if (diffSummary.trackingChanged) trackingChanged += 1
            if (diffSummary.boxChanged) boxChanged += 1
          }

          previousSnapshot = parsed

          return {
            revisionId: revision.id,
            version: revision.version,
            createdAt: revision.createdAt.toISOString(),
            invalidSnapshot: false,
            lineCount: parsed.lines.length,
            customerName: parsed.customerName,
            diffSummary,
          }
        })

        selectedSlip = {
          slipId: slip.id,
          slipNo: slip.slipNo,
          customerName: slip.customerName,
          totalRevisions: revisions.length,
          invalidSnapshots,
          summary: {
            linesAdded,
            linesRemoved,
            qtyChanged,
            customerChanged,
            trackingChanged,
            boxChanged,
          },
          timeline,
        }
      }
    }

    return NextResponse.json({
      filters: {
        from: filters.from,
        to: filters.to,
        vendorId: filters.vendorId,
        customer: filters.customer,
        limit: filters.limit,
        slipId: selectedSlipId,
      },
      mostEdited,
      selectedSlip,
    })
  } catch {
    return NextResponse.json(
      { error: 'Unable to load revision insights.' },
      { status: 500 }
    )
  }
}
