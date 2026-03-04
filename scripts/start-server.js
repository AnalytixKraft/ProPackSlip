#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const projectRoot = path.resolve(__dirname, '..')
const pidFile = path.join(projectRoot, '.next-server.pid')
const logFile = path.join(projectRoot, '.next-server.log')
const serverScript = path.join(__dirname, 'run-next-with-port.js')
const mode = process.argv[2] === 'start' ? 'start' : 'dev'

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

const existingPid = readPid()

if (existingPid !== null) {
  if (isRunning(existingPid)) {
    console.log(`[server] Already running with PID ${existingPid}.`)
    console.log(`[server] Stop it with: npm run server:stop`)
    process.exit(0)
  }

  fs.rmSync(pidFile, { force: true })
}

const outputFd = fs.openSync(logFile, 'a')

const child = spawn(process.execPath, [serverScript, mode], {
  cwd: projectRoot,
  detached: true,
  env: process.env,
  stdio: ['ignore', outputFd, outputFd],
})

child.unref()
fs.closeSync(outputFd)
fs.writeFileSync(pidFile, `${child.pid}\n`, 'utf8')

console.log(`[server] Started ${mode} server in the background (PID ${child.pid}).`)
console.log(`[server] Logs: ${logFile}`)
