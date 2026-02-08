import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim()
  const includeInactive = searchParams.get('includeInactive') === '1'

  const items = await prisma.item.findMany({
    where: query
      ? {
          ...(includeInactive ? {} : { isActive: true }),
          OR: [{ name: { contains: query } }],
        }
      : includeInactive
        ? undefined
        : { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(items)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const skuInput = typeof body.sku === 'string' ? body.sku.trim() : ''
    const unit = typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : 'pcs'
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

    if (!name) {
      return NextResponse.json({ error: 'Item name is required.' }, { status: 400 })
    }

    const sku =
      skuInput ||
      `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`

    const item = await prisma.item.create({
      data: {
        name,
        sku,
        unit,
        notes,
        isActive: true,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json({ error: 'SKU already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Unable to save item.' }, { status: 500 })
  }
}
