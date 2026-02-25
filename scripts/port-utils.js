const net = require('net')

const DEFAULT_BASE_PORT = 3205
const MAX_PORT = 65535
const DEFAULT_MAX_ATTEMPTS = 200

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

const resolveStartPort = (defaultPort = DEFAULT_BASE_PORT) => {
  const configuredPort =
    parsePositiveInt(process.env.APP_BASE_PORT) ??
    parsePositiveInt(process.env.PORT) ??
    defaultPort

  if (configuredPort > MAX_PORT) {
    return defaultPort
  }

  return configuredPort
}

const isPortAvailable = (port, host = '127.0.0.1') =>
  new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()

    server.on('error', (error) => {
      if (error && (error.code === 'EADDRINUSE' || error.code === 'EACCES')) {
        resolve(false)
        return
      }
      reject(error)
    })

    server.listen(port, host, () => {
      server.close(() => resolve(true))
    })
  })

const findAvailablePort = async (startPort, options = {}) => {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

  for (
    let attempt = 0;
    attempt < maxAttempts && startPort + attempt <= MAX_PORT;
    attempt += 1
  ) {
    const port = startPort + attempt
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(port)
    if (available) {
      return port
    }
  }

  throw new Error(
    `Unable to find an available port from ${startPort} within ${maxAttempts} attempts.`
  )
}

module.exports = {
  DEFAULT_BASE_PORT,
  findAvailablePort,
  resolveStartPort,
}
