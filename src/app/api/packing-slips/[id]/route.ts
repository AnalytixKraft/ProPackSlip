import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

type LineInput = {
  itemId?: number | string
  qty?: number | string
  boxName?: string | null
  boxNumber?: string | null
}

type RouteParams = {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
  const slipId = Number(params.id)
  if (!Number.isInteger(slipId)) {
    return NextResponse.json({ error: 'Invalid slip id.' }, { status: 400 })
  }

  const slip = await prisma.packingSlip.findUnique({
    where: { id: slipId },
    include: {
      vendor: true,
      lines: {
        include: { item: true },
      },
    },
  })

  if (!slip) {
    return NextResponse.json({ error: 'Slip not found.' }, { status: 404 })
  }

  return NextResponse.json(slip)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const slipId = Number(params.id)
  if (!Number.isInteger(slipId)) {
    return NextResponse.json({ error: 'Invalid slip id.' }, { status: 400 })
  }

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

    if (poNumber) {
      const existingBill = await prisma.packingSlip.findFirst({
        where: { poNumber, NOT: { id: slipId } },
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
    }

    const slipDate = slipDateInput ? new Date(slipDateInput) : new Date()
    if (Number.isNaN(slipDate.getTime())) {
      return NextResponse.json({ error: 'Invalid slip date.' }, { status: 400 })
    }

    const lines = Array.isArray(body.lines)
      ? (body.lines as LineInput[])
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
              line.qty > 0 &&
              !!line.boxNumber
          )
      : []

    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'Each line requires qty and box number.' },
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
        return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
      }
      resolvedVendorId = vendor.id
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.packingSlip.findUnique({
        where: { id: slipId },
        select: { id: true },
      })
      if (!existing) {
        return null
      }

      const slip = await tx.packingSlip.update({
        where: { id: slipId },
        data: {
          customerName,
          shipTo,
          slipDate,
          vendorId: resolvedVendorId,
          poNumber,
          boxNumber,
          trackingNumber,
        },
      })

      await tx.packingSlipLine.deleteMany({ where: { slipId } })
      await tx.packingSlipLine.createMany({
        data: lines.map((line) => ({
          slipId,
          itemId: line.itemId,
          qty: line.qty,
          boxName: line.boxName ?? null,
          boxNumber: line.boxNumber ?? null,
        })),
      })

      const latestRevision = await tx.packingSlipRevision.aggregate({
        where: { slipId },
        _max: { version: true },
      })

      const fullSlip = await tx.packingSlip.findUnique({
        where: { id: slipId },
        include: {
          lines: { include: { item: true } },
        },
      })

      if (fullSlip) {
        const snapshot = {
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

        await tx.packingSlipRevision.create({
          data: {
            slipId,
            version: (latestRevision._max.version ?? 0) + 1,
            snapshot: JSON.stringify(snapshot),
          },
        })
      }

      return slip
    })

    if (!updated) {
      return NextResponse.json({ error: 'Slip not found.' }, { status: 404 })
    }

    const fullSlip = await prisma.packingSlip.findUnique({
      where: { id: slipId },
      include: {
        vendor: true,
        lines: {
          include: { item: true },
        },
      },
    })

    return NextResponse.json(fullSlip)
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to update packing slip.' },
      { status: 500 }
    )
  }
}
