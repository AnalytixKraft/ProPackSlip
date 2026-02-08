import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
export const dynamic = 'force-dynamic'

type RouteParams = {
  params: { id: string }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const vendorId = Number(params.id)
  if (!Number.isInteger(vendorId)) {
    return NextResponse.json({ error: 'Invalid customer id.' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const isActive =
      typeof body.isActive === 'boolean' ? body.isActive : undefined

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'isActive is required.' },
        { status: 400 }
      )
    }

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: { isActive },
    })

    return NextResponse.json(vendor)
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to update customer.' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const vendorId = Number(params.id)
  if (!Number.isInteger(vendorId)) {
    return NextResponse.json({ error: 'Invalid customer id.' }, { status: 400 })
  }

  try {
    await prisma.vendor.delete({ where: { id: vendorId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json(
        { error: 'Customer used in slips. Set inactive instead.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Unable to delete customer.' },
      { status: 500 }
    )
  }
}
