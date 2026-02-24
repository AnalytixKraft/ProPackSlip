import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

type LineInput = {
  itemId: number
  qty: number
  boxName?: string | null
  boxNumber?: string | null
}

type RawLineInput = {
  itemId?: number | string
  qty?: number | string
  boxName?: string | null
  boxNumber?: string | null
}

type SlipSnapshot = {
  slipNo: string
  slipDate: string
  customerName: string
  shipTo: string
  poNumber: string | null
  boxNumber: string | null
  trackingNumber: string | null
  lines: Array<{
    itemId: number
    name: string
    unit: string
    notes: string | null
    qty: number
    boxName: string | null
    boxNumber: string | null
  }>
}

const padSlipSequence = (value: number, width = 6) =>
  String(value).padStart(width, '0')

const buildSlipNumber = (format: string | null | undefined, slipId: number) => {
  const template = format && format.trim() ? format.trim() : 'PS-{SEQ}'
  if (template.includes('{SEQ}')) {
    return template.replaceAll('{SEQ}', padSlipSequence(slipId))
  }
  const trailingNumber = template.match(/(\d+)$/)
  if (trailingNumber) {
    const width = trailingNumber[1].length
    return template.slice(0, -width) + padSlipSequence(slipId, width)
  }
  return `${template}${padSlipSequence(slipId)}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const billNo = searchParams.get('billNo')?.trim() || null
  const slips = await prisma.packingSlip.findMany({
    where: billNo ? { poNumber: { contains: billNo } } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      vendor: true,
      _count: { select: { lines: true } },
    },
  })

  return NextResponse.json(slips)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const customerName =
      typeof body.customerName === 'string' ? body.customerName.trim() : ''
    const shipTo = typeof body.shipTo === 'string' ? body.shipTo.trim() : ''
    const slipDateInput =
      typeof body.slipDate === 'string' ? body.slipDate : null
    const vendorId = Number(body.vendorId)
    const poNumber =
      typeof body.poNumber === 'string' && body.poNumber.trim()
        ? body.poNumber.trim()
        : null
    const boxNumber =
      typeof body.boxNumber === 'string' && body.boxNumber.trim()
        ? body.boxNumber.trim()
        : null
    const trackingNumber =
      typeof body.trackingNumber === 'string' && body.trackingNumber.trim()
        ? body.trackingNumber.trim()
        : null

    if (!customerName || !shipTo) {
      return NextResponse.json(
        { error: 'Customer name and Ship To are required.' },
        { status: 400 }
      )
    }
    if (!poNumber) {
      return NextResponse.json(
        { error: 'Bill No is required.' },
        { status: 400 }
      )
    }

    const existingBill = await prisma.packingSlip.findFirst({
      where: { poNumber },
      select: { id: true, slipNo: true },
    })
    if (existingBill) {
      return NextResponse.json(
        {
          error: 'Bill No already exists.',
          slipId: existingBill.id,
          slipNo: existingBill.slipNo,
        },
        { status: 409 }
      )
    }

    const slipDate = slipDateInput ? new Date(slipDateInput) : new Date()
    if (Number.isNaN(slipDate.getTime())) {
      return NextResponse.json({ error: 'Invalid slip date.' }, { status: 400 })
    }

    const lines: LineInput[] = Array.isArray(body.lines)
      ? (body.lines as RawLineInput[])
          .map((line) => ({
            itemId: Number(line.itemId),
            qty: Number(line.qty),
            boxName:
              typeof line.boxName === 'string' && line.boxName.trim()
                ? line.boxName.trim()
                : null,
            boxNumber:
              typeof line.boxNumber === 'string' && line.boxNumber.trim()
                ? line.boxNumber.trim()
                : null,
          }))
          .filter(
            (line) =>
              Number.isInteger(line.itemId) &&
              line.itemId > 0 &&
              line.qty > 0
          )
      : []

    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'Each line requires item and qty.' },
        { status: 400 }
      )
    }

    let resolvedVendorId: number | undefined
    if (Number.isInteger(vendorId) && vendorId > 0) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true },
      })
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 })
      }
      resolvedVendorId = vendor.id
    }

    const settings = await prisma.companySettings.findFirst({
      select: { slipNumberFormat: true },
    })

    const created = await prisma.$transaction(async (tx) => {
      const slip = await tx.packingSlip.create({
        data: {
          slipNo: 'PS-000000',
          customerName,
          shipTo,
          slipDate,
          vendorId: resolvedVendorId,
          poNumber,
          boxNumber,
          trackingNumber,
        },
      })

      const slipNo = buildSlipNumber(settings?.slipNumberFormat, slip.id)
      const updatedSlip = await tx.packingSlip.update({
        where: { id: slip.id },
        data: { slipNo },
      })

      await tx.packingSlipLine.createMany({
        data: lines.map((line) => ({
          slipId: slip.id,
          itemId: line.itemId,
          qty: line.qty,
          boxName: line.boxName ?? null,
          boxNumber: line.boxNumber ?? null,
        })),
      })

      return updatedSlip
    })

    const fullSlip = await prisma.packingSlip.findUnique({
      where: { id: created.id },
      include: {
        vendor: true,
        lines: {
          include: { item: true },
        },
      },
    })

    if (fullSlip) {
      const snapshot: SlipSnapshot = {
        slipNo: fullSlip.slipNo,
        slipDate: fullSlip.slipDate.toISOString(),
        customerName: fullSlip.customerName,
        shipTo: fullSlip.shipTo,
        poNumber: fullSlip.poNumber,
        boxNumber: fullSlip.boxNumber,
        trackingNumber: fullSlip.trackingNumber,
        lines: fullSlip.lines.map((line) => ({
          itemId: line.itemId,
          name: line.item.name,
          unit: line.item.unit,
          notes: line.item.notes,
          qty: line.qty,
          boxName: line.boxName ?? null,
          boxNumber: line.boxNumber ?? null,
        })),
      }
      await prisma.packingSlipRevision.create({
        data: {
          slipId: fullSlip.id,
          version: 1,
          snapshot: JSON.stringify(snapshot),
        },
      })
    }

    return NextResponse.json(fullSlip, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to create packing slip.' },
      { status: 500 }
    )
  }
}
