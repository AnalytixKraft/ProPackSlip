#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const pidFile = path.resolve(__dirname, '..', '.next-server.pid')

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const readPid = () => {
  if (!fs.existsSync(pidFile)) {
    return null
  }

  const rawValue = fs.readFileSync(pidFile, 'utf8').trim()
  const pid = Number.parseInt(rawValue, 10)

  if (!Number.isInteger(pid) || pid <= 0) {
    fs.rmSync(pidFile, { force: true })
    return null
  }

  return pid
}

const isRunning = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error && error.code === 'ESRCH') {
      return false
    }

    throw error
  }
}

const waitForExit = async (pid, timeoutMs = 5000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (!isRunning(pid)) {
      return true
    }

    // eslint-disable-next-line no-await-in-loop
    await delay(200)
  }

  return !isRunning(pid)
}

const stop = async () => {
  const pid = readPid()

  if (pid === null) {
    console.log('[server] No running server was found.')
    return
  }

  if (!isRunning(pid)) {
    fs.rmSync(pidFile, { force: true })
    console.log('[server] Removed stale PID file.')
    return
  }

  const targetPid = process.platform === 'win32' ? pid : -pid
  process.kill(targetPid, 'SIGTERM')

  const stopped = await waitForExit(pid)
  fs.rmSync(pidFile, { force: true })

  if (!stopped) {
    console.error(`[server] Process ${pid} did not exit after SIGTERM.`)
    process.exit(1)
  }

  console.log(`[server] Stopped server process ${pid}.`)
}

stop().catch((error) => {
  console.error(
    `[server] Failed to stop the server: ${
      error instanceof Error ? error.message : String(error)
    }`
  )
  process.exit(1)
})
