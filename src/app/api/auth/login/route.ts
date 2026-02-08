import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const username =
      typeof body.username === 'string' ? body.username.trim() : ''
    const password =
      typeof body.password === 'string' ? body.password.trim() : ''

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required.' },
        { status: 400 }
      )
    }

    const settings = await prisma.companySettings.findFirst({
      select: { loginUsername: true, loginPassword: true },
    })

    if (!settings?.loginUsername || !settings?.loginPassword) {
      if (username === 'admin' && password === 'admin') {
        return NextResponse.json({ success: true, defaultLogin: true })
      }
      return NextResponse.json(
        { error: 'Login credentials are not configured. Use admin/admin.' },
        { status: 400 }
      )
    }

    if (
      settings.loginUsername !== username ||
      settings.loginPassword !== password
    ) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to login.' }, { status: 500 })
  }
}
