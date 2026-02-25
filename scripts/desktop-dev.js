#!/usr/bin/env node

const http = require('http')
const { spawn } = require('child_process')
const {
  DEFAULT_BASE_PORT,
  findAvailablePort,
  resolveStartPort,
} = require('./port-utils')

const nextBin = require.resolve('next/dist/bin/next')
const electronBin = require('electron')

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const canReachUrl = (url) =>
  new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume()
      resolve(true)
    })

    request.setTimeout(1500, () => {
      request.destroy()
      resolve(false)
    })

    request.on('error', () => {
      resolve(false)
    })
  })

const waitForServer = async (url, timeoutMs = 120000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const reachable = await canReachUrl(url)
    if (reachable) return
    // eslint-disable-next-line no-await-in-loop
    await delay(400)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

const run = async () => {
  const startPort = resolveStartPort(DEFAULT_BASE_PORT)
  const port = await findAvailablePort(startPort)
  const appUrl = `http://localhost:${port}`

  if (port !== startPort) {
    console.log(`[desktop:dev] ${startPort} is in use. Starting on ${port}.`)
  } else {
    console.log(`[desktop:dev] Starting on ${port}.`)
  }

  const nextEnv = {
    ...process.env,
    PORT: String(port),
    APP_PORT: String(port),
  }

  let shuttingDown = false
  let electronChild = null

  const nextChild = spawn(process.execPath, [nextBin, 'dev', '-p', String(port)], {
    stdio: 'inherit',
    env: nextEnv,
  })

  const shutdown = (exitCode = 0) => {
    if (shuttingDown) return
    shuttingDown = true

    if (electronChild && !electronChild.killed) {
      electronChild.kill('SIGTERM')
    }
    if (!nextChild.killed) {
      nextChild.kill('SIGTERM')
    }

    setTimeout(() => process.exit(exitCode), 50)
  }

  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))

  nextChild.on('exit', (code) => {
    if (shuttingDown) return
    if (electronChild && !electronChild.killed) {
      electronChild.kill('SIGTERM')
    }
    process.exit(code ?? 0)
  })

  await waitForServer(appUrl)
  console.log(`[desktop:dev] Launching Electron against ${appUrl}`)

  electronChild = spawn(electronBin, ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DESKTOP_APP_URL: appUrl,
    },
  })

  electronChild.on('exit', (code) => {
    if (shuttingDown) return
    if (!nextChild.killed) {
      nextChild.kill('SIGTERM')
    }
    process.exit(code ?? 0)
  })
}

run().catch((error) => {
  console.error(
    `[desktop:dev] Failed to start: ${
      error instanceof Error ? error.message : String(error)
    }`
  )
  process.exit(1)
})
