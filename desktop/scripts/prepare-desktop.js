const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..')
const dbPath = path.join(root, 'desktop', 'prisma-template.db')
const devDbPath = path.join(root, 'prisma', 'dev.db')
const prismaClientDir = path.join(root, 'node_modules', '@prisma', 'client')
const prismaRuntimeDir = path.join(root, 'node_modules', '.prisma')
const prismaClientRuntimeDir = path.join(prismaClientDir, '.prisma')
const prismaDefaultEntry = path.join(prismaClientDir, 'default.js')
const prismaIndexEntry = path.join(prismaClientDir, 'index.js')

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const sqliteCmd = process.platform === 'win32' ? 'sqlite3.exe' : 'sqlite3'

const run = (command, args, options = {}) => {
  const stdio =
    options.stdio ?? (options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit')
  const result = spawnSync(command, args, {
    stdio,
    ...options,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const runCapture = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  })

  if (result.status !== 0) {
    process.stderr.write(result.stderr || '')
    process.exit(result.status ?? 1)
  }

  return result.stdout
}

if (!fs.existsSync(devDbPath)) {
  console.error('Missing prisma/dev.db. Run the app once or create the schema.')
  process.exit(1)
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
}

run(npxCmd, ['prisma', 'generate'])

if (fs.existsSync(prismaRuntimeDir)) {
  fs.rmSync(prismaClientRuntimeDir, { recursive: true, force: true })
  if (typeof fs.cpSync === 'function') {
    fs.cpSync(prismaRuntimeDir, prismaClientRuntimeDir, { recursive: true })
  } else {
    const copyRecursive = (src, dest) => {
      const stats = fs.statSync(src)
      if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true })
        for (const entry of fs.readdirSync(src)) {
          copyRecursive(path.join(src, entry), path.join(dest, entry))
        }
      } else {
        fs.copyFileSync(src, dest)
      }
    }
    copyRecursive(prismaRuntimeDir, prismaClientRuntimeDir)
  }
}

const patchRequire = (filePath) => {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  const updated = content.replace(
    "require('.prisma/client/default')",
    "require('./.prisma/client/default')"
  )
  if (updated !== content) {
    fs.writeFileSync(filePath, updated)
  }
}

patchRequire(prismaDefaultEntry)
patchRequire(prismaIndexEntry)

const schemaSql = runCapture(sqliteCmd, [devDbPath, '.schema'])
  .split('\n')
  .filter((line) => !line.includes('sqlite_sequence'))
  .join('\n')
run(sqliteCmd, [dbPath], { input: schemaSql, encoding: 'utf8' })

run(npmCmd, ['run', 'build'])
