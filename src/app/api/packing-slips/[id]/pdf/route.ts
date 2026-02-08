import { NextResponse } from 'next/server'
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = {
  params: { id: string }
}

const getFallbackExecutables = (): string[] => {
  const platform = process.platform
  const entries: string[] = []

  const envExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim()
  if (envExecutable) {
    entries.push(envExecutable)
  }

  if (platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesX86 =
      process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    const localAppData = process.env.LOCALAPPDATA

    entries.push(
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      path.join(
        programFilesX86,
        'BraveSoftware',
        'Brave-Browser',
        'Application',
        'brave.exe'
      )
    )

    if (localAppData) {
      entries.push(
        path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(
          localAppData,
          'BraveSoftware',
          'Brave-Browser',
          'Application',
          'brave.exe'
        )
      )
    }
  } else if (platform === 'darwin') {
    entries.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
    )
  } else {
    entries.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    )
  }

  const uniqueEntries: string[] = []
  for (const entry of entries) {
    if (uniqueEntries.includes(entry)) continue
    uniqueEntries.push(entry)
  }

  return uniqueEntries
}

export async function GET(request: Request, { params }: RouteParams) {
  const slipId = Number(params.id)
  if (!Number.isInteger(slipId)) {
    return NextResponse.json({ error: 'Invalid slip id.' }, { status: 400 })
  }

  const origin = new URL(request.url).origin
  const printUrl = `${origin}/print/packing-slip/${slipId}`

  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox']
  const fallbackExecutables = getFallbackExecutables()

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  try {
    try {
      browser = await chromium.launch({ args: launchArgs })
    } catch (error) {
      let fallbackError: Error | null = null
      for (const executablePath of fallbackExecutables) {
        if (!fs.existsSync(executablePath)) {
          continue
        }
        try {
          browser = await chromium.launch({ executablePath, args: launchArgs })
          break
        } catch (innerError) {
          fallbackError =
            innerError instanceof Error ? innerError : new Error('Launch failed.')
        }
      }

      if (!browser) {
        const baseMessage =
          error instanceof Error ? error.message : 'Unable to launch Chromium.'
        const extraMessage = fallbackError ? ` Fallback error: ${fallbackError.message}` : ''
        throw new Error(
          `${baseMessage}${extraMessage} Install Microsoft Edge/Chrome or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.`
        )
      }
    }
    const page = await browser.newPage()
    await page.goto(printUrl, { waitUntil: 'networkidle' })
    await page.emulateMedia({ media: 'print' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '16mm',
        bottom: '18mm',
        left: '14mm',
        right: '14mm',
      },
    })

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="packing-slip-${slipId}.pdf"`,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to generate PDF.'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (browser) {
      await browser.close().catch(() => null)
    }
  }
}
