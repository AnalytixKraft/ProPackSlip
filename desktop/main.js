const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron')
const fs = require('fs')
const http = require('http')
const path = require('path')
const next = require('next')

const DEFAULT_CONFIG = {
  appUrl: 'http://localhost:3000',
  window: {
    width: 1280,
    height: 800,
  },
}

const configPath = path.join(__dirname, 'app.config.json')

const loadConfig = () => {
  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    return {}
  }
}

const fileConfig = loadConfig()
const config = {
  ...DEFAULT_CONFIG,
  ...fileConfig,
  window: {
    ...DEFAULT_CONFIG.window,
    ...(fileConfig.window || {}),
  },
}

const getOrigin = (value) => {
  try {
    return new URL(value).origin
  } catch (error) {
    return null
  }
}

let logInfo = () => {}
let logError = () => {}
let logStream = null
let isQuitRequested = false

const initLogger = () => {
  const logDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  const logFile = path.join(logDir, 'main.log')
  const stream = fs.createWriteStream(logFile, { flags: 'a' })
  logStream = stream

  const format = (level, args) =>
    `[${new Date().toISOString()}] [${level}] ${args
      .map((value) =>
        value instanceof Error ? value.stack || value.message : String(value)
      )
      .join(' ')}\n`

  const write = (level, args) => {
    stream.write(format(level, args))
  }

  logInfo = (...args) => write('INFO', args)
  logError = (...args) => write('ERROR', args)

  const originalLog = console.log.bind(console)
  const originalError = console.error.bind(console)
  console.log = (...args) => {
    logInfo(...args)
    originalLog(...args)
  }
  console.error = (...args) => {
    logError(...args)
    originalError(...args)
  }

  const wrapWrite = (stream, level) => {
    const originalWrite = stream.write.bind(stream)
    stream.write = (chunk, encoding, callback) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk)
      write(level, [text.trimEnd()])
      return originalWrite(chunk, encoding, callback)
    }
  }

  wrapWrite(process.stdout, 'STDOUT')
  wrapWrite(process.stderr, 'STDERR')

  process.on('uncaughtException', (error) => {
    logError('uncaughtException', error)
  })
  process.on('unhandledRejection', (error) => {
    logError('unhandledRejection', error)
  })

  return logFile
}

const resolveDatabaseUrl = () => {
  const userData = app.getPath('userData')
  const dbDir = path.join(userData, 'db')
  const dbPath = path.join(dbDir, 'packpro-slip.db')
  const templatePath = path.join(__dirname, 'prisma-template.db')

  if (!fs.existsSync(dbPath)) {
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        'Missing prisma-template.db. Run npm run desktop:prepare before packaging.'
      )
    }

    fs.mkdirSync(dbDir, { recursive: true })
    fs.copyFileSync(templatePath, dbPath)
  }

  const normalizedPath = dbPath.replace(/\\/g, '/')
  return `file:${normalizedPath}`
}

const getDatabaseDebugInfo = () => {
  const userData = app.getPath('userData')
  const dbDir = path.join(userData, 'db')
  const dbPath = path.join(dbDir, 'packpro-slip.db')
  let size = 'missing'
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath)
    size = `${stats.size} bytes`
  }
  return { userData, dbPath, size }
}

const startLocalServer = async (appRoot) => {
  process.env.NODE_ENV = 'production'
  process.env.DATABASE_URL = resolveDatabaseUrl()

  logInfo('Starting local server', 'appRoot=', appRoot)
  logInfo('Database URL', process.env.DATABASE_URL)
  const dbInfo = getDatabaseDebugInfo()
  logInfo('Database path', dbInfo.dbPath, 'size=', dbInfo.size)

  const nextApp = next({ dev: false, dir: appRoot })
  try {
    await nextApp.prepare()
  } catch (error) {
    logError('Next prepare error', error)
    throw error
  }

  const handler = nextApp.getRequestHandler()
  const server = http.createServer((req, res) => {
    const startedAt = Date.now()
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        logError(
          'HTTP',
          req.method,
          req.url,
          'status=',
          res.statusCode,
          'durationMs=',
          Date.now() - startedAt
        )
      }
    })

    Promise.resolve(handler(req, res)).catch((error) => {
      logError('Request handler error', req.method, req.url, error)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Internal Server Error')
      }
    })
  })

  const port = await new Promise((resolve, reject) => {
    server.on('error', (error) => {
      logError('server error', error)
      reject(error)
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        resolve(address.port)
      } else {
        reject(new Error('Unable to resolve a local port.'))
      }
    })
  })

  return {
    server,
    url: `http://127.0.0.1:${port}`,
  }
}

let mainWindow
let localServer
let localServerPromise = null
let logFilePath = null

const getLocalServer = async (appRoot) => {
  if (localServer) return localServer
  if (!localServerPromise) {
    localServerPromise = startLocalServer(appRoot)
      .then((server) => {
        localServer = server
        return server
      })
      .catch((error) => {
        localServerPromise = null
        throw error
      })
  }
  return localServerPromise
}

const createWindow = async () => {
  const appRoot = app.getAppPath()
  let appUrl = null
  const isWindows = process.platform === 'win32'

  if (!app.isPackaged) {
    appUrl = process.env.DESKTOP_APP_URL || config.appUrl
  }

  if (!appUrl) {
    try {
      const server = await getLocalServer(appRoot)
      appUrl = server.url
    } catch (error) {
      logError('Failed to start local server', error)
      dialog.showErrorBox(
        'Unable to start PackPro Slip',
        error instanceof Error ? error.message : String(error)
      )
      app.quit()
      return
    }
  }

  logInfo('Launching window', 'url=', appUrl)

  mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#f8f4ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Windows builds can fail to focus/edit inputs with sandboxed renderers.
      // Keep sandbox on for other platforms, use compatibility mode on Windows.
      sandbox: !isWindows,
    },
  })

  if (isWindows) {
    mainWindow.removeMenu()
  }

  const allowedOrigin = getOrigin(appUrl)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (allowedOrigin && getOrigin(url) !== allowedOrigin) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!allowedOrigin) return
    if (getOrigin(url) !== allowedOrigin) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription, validatedURL) => {
      logError('did-fail-load', errorCode, errorDescription, validatedURL)
    }
  )
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logError('render-process-gone', details.reason, details.exitCode)
  })

  mainWindow.loadURL(appUrl)
}

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  if (!gotLock) {
    return
  }

  logFilePath = initLogger()
  logInfo('App starting', 'version=', app.getVersion())

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.packproslip.desktop')
  }

  const requestQuit = () => {
    if (isQuitRequested) return
    isQuitRequested = true
    app.quit()
    setTimeout(() => {
      app.exit(0)
    }, 1500)
  }

  ipcMain.on('app:quit', requestQuit)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  logInfo('App quitting')
  if (localServer?.server) {
    localServer.server.close()
  }
  if (logStream) {
    try {
      logStream.end()
      if (typeof logStream.close === 'function') {
        logStream.close()
      }
    } catch (error) {
      // ignore logging shutdown errors
    }
  }
})

app.on('window-all-closed', () => {
  logInfo('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
