import { NextResponse } from 'next/server'

type RouteParams = {
  params: { id: string }
}

export async function GET(request: Request, { params }: RouteParams) {
  const slipId = Number(params.id)
  if (!Number.isInteger(slipId)) {
    return NextResponse.json({ error: 'Invalid slip id.' }, { status: 400 })
  }

  const redirectUrl = new URL(`/print/packing-slip/${slipId}?autoprint=1`, request.url)
  return NextResponse.redirect(redirectUrl)
}
