#!/usr/bin/env node

const { spawn } = require('child_process')
const {
  DEFAULT_BASE_PORT,
  findAvailablePort,
  resolveStartPort,
} = require('./port-utils')

const mode = process.argv[2]
const forwardedArgs = process.argv.slice(3)
const nextBin = require.resolve('next/dist/bin/next')

if (!mode || (mode !== 'dev' && mode !== 'start')) {
  console.error(
    'Usage: node scripts/run-next-with-port.js <dev|start> [additional next args]'
  )
  process.exit(1)
}

const hasExplicitPortArg = (args) =>
  args.some(
    (arg, index) =>
      arg === '-p' ||
      arg === '--port' ||
      arg.startsWith('--port=') ||
      (arg === '-p' && typeof args[index + 1] === 'string')
  )

const launch = async () => {
  let port = null
  let commandArgs = forwardedArgs

  if (!hasExplicitPortArg(forwardedArgs)) {
    const startPort = resolveStartPort(DEFAULT_BASE_PORT)
    port = await findAvailablePort(startPort)
    if (port !== startPort) {
      console.log(`[port] ${startPort} is in use. Starting on ${port}.`)
    } else {
      console.log(`[port] Starting on ${port}.`)
    }
    commandArgs = ['-p', String(port), ...forwardedArgs]
  }

  const env = { ...process.env }
  if (port !== null) {
    env.PORT = String(port)
    env.APP_PORT = String(port)
  }

  const child = spawn(process.execPath, [nextBin, mode, ...commandArgs], {
    stdio: 'inherit',
    env,
  })

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.on('SIGINT', () => forwardSignal('SIGINT'))
  process.on('SIGTERM', () => forwardSignal('SIGTERM'))

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

launch().catch((error) => {
  console.error(
    `[port] Failed to start Next.js: ${
      error instanceof Error ? error.message : String(error)
    }`
  )
  process.exit(1)
})
