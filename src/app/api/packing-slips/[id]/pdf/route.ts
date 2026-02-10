import { NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteParams = {
  params: { id: string }
}

const launchPdfBrowser = async () => {
  const commonOptions = {
    headless: true as const,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }

  try {
    return await chromium.launch(commonOptions)
  } catch (defaultError) {
    try {
      return await chromium.launch({ ...commonOptions, channel: 'chrome' })
    } catch (chromeError) {
      try {
        return await chromium.launch({ ...commonOptions, channel: 'msedge' })
      } catch (edgeError) {
        const message =
          defaultError instanceof Error
            ? defaultError.message
            : edgeError instanceof Error
              ? edgeError.message
              : chromeError instanceof Error
                ? chromeError.message
                : 'Unable to launch browser for PDF generation.'
        throw new Error(message)
      }
    }
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  const slipId = Number(params.id)
  if (!Number.isInteger(slipId)) {
    return NextResponse.json({ error: 'Invalid slip id.' }, { status: 400 })
  }

  const slip = await prisma.packingSlip.findUnique({
    where: { id: slipId },
    select: { id: true, slipNo: true },
  })
  if (!slip) {
    return NextResponse.json({ error: 'Packing slip not found.' }, { status: 404 })
  }

  const printUrl = new URL(`/print/packing-slip/${slipId}`, request.url).toString()

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    browser = await launchPdfBrowser()
    const page = await browser.newPage()
    await page.goto(printUrl, { waitUntil: 'networkidle' })
    await page.emulateMedia({ media: 'print' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: false,
      preferCSSPageSize: true,
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="packing-slip-${slip.slipNo}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to generate PDF.'
    const browserMissing =
      message.includes('Executable does not exist') ||
      message.includes('Please run the following command to download new browsers')

    return NextResponse.json(
      {
        error: browserMissing
          ? 'Playwright Chromium is not installed. Run: npx playwright install chromium'
          : 'Unable to generate PDF.',
      },
      { status: 500 }
    )
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
