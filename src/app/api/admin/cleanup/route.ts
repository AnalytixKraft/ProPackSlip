import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
export const dynamic = 'force-dynamic'

type ActionType = 'slips' | 'labels' | 'items' | 'customers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = body?.action as ActionType
    if (!action || !['slips', 'labels', 'items', 'customers'].includes(action)) {
      return NextResponse.json({ error: 'Invalid cleanup action.' }, { status: 400 })
    }

    if (action === 'labels') {
      const log = await prisma.cleanupLog.create({
        data: {
          action,
          details: 'Labels are generated from slips. Nothing stored to delete.',
        },
      })
      return NextResponse.json({
        success: true,
        message: 'Labels are generated from slips. Nothing stored to delete.',
        logId: log.id,
      })
    }

    if (action === 'slips') {
      const result = await prisma.$transaction(async (tx) => {
        await tx.packingSlipLine.deleteMany()
        await tx.packingSlipRevision.deleteMany()
        return tx.packingSlip.deleteMany()
      })
      const log = await prisma.cleanupLog.create({
        data: {
          action,
          details: `Deleted ${result.count} slips.`,
        },
      })
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} slips.`,
        logId: log.id,
      })
    }

    const slipCount = await prisma.packingSlip.count()
    if (slipCount > 0) {
      return NextResponse.json(
        { error: 'Delete all labels and slips before removing this data.' },
        { status: 409 }
      )
    }

    if (action === 'items') {
      const result = await prisma.item.deleteMany()
      const log = await prisma.cleanupLog.create({
        data: {
          action,
          details: `Deleted ${result.count} items.`,
        },
      })
      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} items.`,
        logId: log.id,
      })
    }

    const result = await prisma.vendor.deleteMany()
    const log = await prisma.cleanupLog.create({
      data: {
        action,
        details: `Deleted ${result.count} customers.`,
      },
    })
    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} customers.`,
      logId: log.id,
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json(
        { error: 'Delete slips first to remove dependent records.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Unable to run cleanup.' },
      { status: 500 }
    )
  }
}
