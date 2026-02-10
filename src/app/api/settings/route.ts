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

export async function GET() {
  const settings = await prisma.companySettings.findFirst()
  return NextResponse.json(settings)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const allowedThemes = new Set(['sunset', 'ocean', 'forest', 'midnight'])
    const companyName =
      typeof body.companyName === 'string' ? body.companyName.trim() : ''
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    const phone = normalizeOptionalText(body.phone)
    const email = normalizeEmail(body.email)
    const gstNumber = normalizeGstNumber(body.gstNumber)
    const slipNumberFormat =
      typeof body.slipNumberFormat === 'string' &&
      body.slipNumberFormat.trim()
        ? body.slipNumberFormat.trim()
        : null
    const inactivityTimeoutMinutes =
      typeof body.inactivityTimeoutMinutes === 'number' &&
      Number.isFinite(body.inactivityTimeoutMinutes) &&
      body.inactivityTimeoutMinutes > 0
        ? Math.round(body.inactivityTimeoutMinutes)
        : null
    const theme =
      typeof body.theme === 'string' && allowedThemes.has(body.theme)
        ? body.theme
        : null
    const loginUsername =
      typeof body.loginUsername === 'string' && body.loginUsername.trim()
        ? body.loginUsername.trim()
        : null
    const loginPassword =
      typeof body.loginPassword === 'string' && body.loginPassword.trim()
        ? body.loginPassword.trim()
        : null
    const logoUrl =
      typeof body.logoUrl === 'string' && body.logoUrl.trim()
        ? body.logoUrl.trim()
        : null
    const logoDataUrl =
      typeof body.logoDataUrl === 'string' && body.logoDataUrl.trim()
        ? body.logoDataUrl.trim()
        : null

    if (!companyName || !address || !phone || !gstNumber) {
      return NextResponse.json(
        {
          error:
            'Company name, address, phone number, and GST number are required.',
        },
        { status: 400 }
      )
    }

    const emailError = validateOptionalEmail(email)
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 })
    }

    const phoneError = validateOptionalPhone(phone)
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 })
    }

    const gstError = validateOptionalGstNumber(gstNumber)
    if (gstError) {
      return NextResponse.json({ error: gstError }, { status: 400 })
    }

    const existing = await prisma.companySettings.findFirst()
    const payload = {
      companyName,
      address,
      phone,
      email,
      gstNumber,
      slipNumberFormat,
      theme,
      inactivityTimeoutMinutes,
      logoUrl,
      logoDataUrl,
      loginUsername,
      loginPassword,
    }

    const settings = existing
      ? await prisma.companySettings.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.companySettings.create({
          data: payload,
        })

    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to save settings.' },
      { status: 500 }
    )
  }
}
