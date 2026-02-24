import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
export const dynamic = 'force-dynamic'

type RouteParams = {
  params: { id: string }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const itemId = Number(params.id)
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: 'Invalid item id.' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const isActive =
      typeof body.isActive === 'boolean' ? body.isActive : undefined
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const unit = typeof body.unit === 'string' ? body.unit.trim() : ''
    const notes =
      typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim()
        : null

    if (
      typeof isActive !== 'boolean' &&
      !name &&
      !unit &&
      body.notes === undefined
    ) {
      return NextResponse.json(
        { error: 'No fields provided for update.' },
        { status: 400 }
      )
    }

    if (name) {
      const duplicateByName = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id
        FROM "Item"
        WHERE lower(trim(name)) = lower(trim(${name}))
          AND id <> ${itemId}
        LIMIT 1
      `
      if (duplicateByName.length > 0) {
        return NextResponse.json(
          { error: 'Item name already exists.' },
          { status: 409 }
        )
      }
    }

    const item = await prisma.item.update({
      where: { id: itemId },
      data: {
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(name ? { name } : {}),
        ...(unit ? { unit } : {}),
        ...(body.notes !== undefined ? { notes } : {}),
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to update item.' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const itemId = Number(params.id)
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: 'Invalid item id.' }, { status: 400 })
  }

  try {
    await prisma.item.delete({ where: { id: itemId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json(
        { error: 'Item used in slips. Set inactive instead.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Unable to delete item.' },
      { status: 500 }
    )
  }
}
