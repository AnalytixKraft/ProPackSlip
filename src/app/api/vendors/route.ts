import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizeEmail,
  normalizeGstNumber,
  normalizeOptionalText,
  validateOptionalEmail,
  validateOptionalGstNumber,
  validateOptionalPhone,
} from '@/lib/validators'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim()
  const includeInactive = searchParams.get('includeInactive') === '1'

  const vendors = await prisma.vendor.findMany({
    where: query
      ? {
          ...(includeInactive ? {} : { isActive: true }),
          OR: [
            { name: { contains: query } },
            { gstNumber: { contains: query } },
          ],
        }
      : includeInactive
        ? undefined
        : { isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(vendors)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    const gstNumber = normalizeGstNumber(body.gstNumber)
    const email = normalizeEmail(body.email)
    const contactName = normalizeOptionalText(body.contactName)
    const contactPhone = normalizeOptionalText(body.contactPhone)

    if (!name || !address) {
      return NextResponse.json(
        { error: 'Vendor name and address are required.' },
        { status: 400 }
      )
    }

    const emailError = validateOptionalEmail(email)
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 })
    }

    const phoneError = validateOptionalPhone(contactPhone)
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 })
    }

    const gstError = validateOptionalGstNumber(gstNumber)
    if (gstError) {
      return NextResponse.json({ error: gstError }, { status: 400 })
    }

    const vendor = await prisma.vendor.create({
      data: {
        name,
        address,
        gstNumber,
        email,
        contactName,
        contactPhone,
        isActive: true,
      },
    })

    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to save vendor.' },
      { status: 500 }
    )
  }
}
