const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const TARGET_DB_VERSION = 1

const normalizeDatabasePath = (databaseUrl) => {
  if (!databaseUrl || typeof databaseUrl !== 'string') {
    throw new Error('Missing DATABASE_URL.')
  }

  const trimmed = databaseUrl.trim()
  if (!trimmed.startsWith('file:')) {
    throw new Error('Only SQLite file: database URLs are supported.')
  }

  const rawPath = trimmed.slice(5)
  if (!rawPath) {
    throw new Error('Invalid SQLite database path.')
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath)
}

const escapeIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`

const timestampLabel = () => {
  const date = new Date()
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ]
  return parts.join('')
}

const createBackupPath = (databasePath, label = 'bak') =>
  `${databasePath}.${label}-${timestampLabel()}`

const copyDatabaseBackup = (databasePath) => {
  if (!fs.existsSync(databasePath)) {
    return null
  }

  const backupPath = createBackupPath(databasePath, 'bak')
  fs.copyFileSync(databasePath, backupPath)
  return backupPath
}

const moveDatabaseBackup = (databasePath) => {
  if (!fs.existsSync(databasePath)) {
    return null
  }

  const backupPath = createBackupPath(databasePath, 'bak-corrupt')
  fs.renameSync(databasePath, backupPath)
  return backupPath
}

const removeDatabaseSidecars = (databasePath) => {
  const suffixes = ['-journal', '-wal', '-shm']
  for (const suffix of suffixes) {
    const sidecarPath = `${databasePath}${suffix}`
    if (!fs.existsSync(sidecarPath)) {
      continue
    }

    fs.unlinkSync(sidecarPath)
  }
}

const ensureDatabaseSchema = async (options = {}) => {
  const logger =
    typeof options.logger === 'function' ? options.logger : () => {}
  const databaseUrl =
    options.databaseUrl || process.env.DATABASE_URL || ''
  const databasePath = normalizeDatabasePath(databaseUrl)

  fs.mkdirSync(path.dirname(databasePath), { recursive: true })

  const prisma = new PrismaClient({
    datasources: {
      db: { url: `file:${databasePath.replace(/\\/g, '/')}` },
    },
    log: ['error'],
  })

  const query = (sql) => prisma.$queryRawUnsafe(sql)
  const exec = (sql) => prisma.$executeRawUnsafe(sql)

  const tableExists = async (tableName) => {
    const rows = await query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=${JSON.stringify(
        tableName
      )} LIMIT 1`
    )
    return rows.length > 0
  }

  const getColumns = async (tableName) => {
    if (!(await tableExists(tableName))) {
      return []
    }
    return query(`PRAGMA table_info(${escapeIdentifier(tableName)})`)
  }

  const getIndexes = async (tableName) => {
    if (!(await tableExists(tableName))) {
      return []
    }
    return query(`PRAGMA index_list(${escapeIdentifier(tableName)})`)
  }

  const currentVersionRows = await query('PRAGMA user_version')
  const currentVersion = Number(currentVersionRows?.[0]?.user_version) || 0

  const actions = []

  const ensureTable = async (tableName, sql) => {
    if (!(await tableExists(tableName))) {
      actions.push({
        description: `Create table ${tableName}`,
        sql,
      })
    }
  }

  const ensureColumn = async (tableName, columnName, sql) => {
    const columns = await getColumns(tableName)
    if (columns.length === 0) {
      return
    }
    if (!columns.some((column) => column.name === columnName)) {
      actions.push({
        description: `Add ${tableName}.${columnName}`,
        sql,
      })
    }
  }

  const ensureIndex = async (tableName, indexName, sql) => {
    const indexes = await getIndexes(tableName)
    if (!indexes.some((index) => index.name === indexName)) {
      actions.push({
        description: `Create index ${indexName}`,
        sql,
      })
    }
  }

  const ensureMissingSchema = async () => {
    await ensureTable(
      'Item',
      `CREATE TABLE "Item" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "sku" TEXT NOT NULL,
        "unit" TEXT NOT NULL,
        "notes" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    await ensureTable(
      'Vendor',
      `CREATE TABLE "Vendor" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "gstNumber" TEXT,
        "address" TEXT NOT NULL,
        "contactName" TEXT,
        "contactPhone" TEXT,
        "email" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    await ensureTable(
      'CompanySettings',
      `CREATE TABLE "CompanySettings" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "companyName" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "gstNumber" TEXT,
        "address" TEXT NOT NULL,
        "slipNumberFormat" TEXT,
        "theme" TEXT,
        "inactivityTimeoutMinutes" INTEGER,
        "logoUrl" TEXT,
        "logoDataUrl" TEXT,
        "loginUsername" TEXT,
        "loginPassword" TEXT,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    await ensureTable(
      'PackingSlip',
      `CREATE TABLE "PackingSlip" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "slipNo" TEXT NOT NULL,
        "customerName" TEXT NOT NULL,
        "shipTo" TEXT NOT NULL,
        "poNumber" TEXT,
        "boxNumber" TEXT,
        "trackingNumber" TEXT,
        "slipDate" DATETIME NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "vendorId" INTEGER,
        CONSTRAINT "PackingSlip_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      )`
    )
    await ensureTable(
      'PackingSlipLine',
      `CREATE TABLE "PackingSlipLine" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "slipId" INTEGER NOT NULL,
        "itemId" INTEGER NOT NULL,
        "qty" REAL NOT NULL,
        "boxName" TEXT,
        "boxNumber" TEXT,
        CONSTRAINT "PackingSlipLine_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "PackingSlip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "PackingSlipLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )`
    )
    await ensureTable(
      'PackingSlipRevision',
      `CREATE TABLE "PackingSlipRevision" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "slipId" INTEGER NOT NULL,
        "version" INTEGER NOT NULL,
        "snapshot" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PackingSlipRevision_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "PackingSlip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )`
    )
    await ensureTable(
      'CleanupLog',
      `CREATE TABLE "CleanupLog" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "action" TEXT NOT NULL,
        "details" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )

    await ensureColumn('Item', 'notes', 'ALTER TABLE "Item" ADD COLUMN "notes" TEXT')
    await ensureColumn(
      'Item',
      'isActive',
      'ALTER TABLE "Item" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT 1'
    )
    await ensureColumn(
      'Item',
      'createdAt',
      `ALTER TABLE "Item" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`
    )

    await ensureColumn('Vendor', 'gstNumber', 'ALTER TABLE "Vendor" ADD COLUMN "gstNumber" TEXT')
    await ensureColumn('Vendor', 'contactName', 'ALTER TABLE "Vendor" ADD COLUMN "contactName" TEXT')
    await ensureColumn('Vendor', 'contactPhone', 'ALTER TABLE "Vendor" ADD COLUMN "contactPhone" TEXT')
    await ensureColumn('Vendor', 'email', 'ALTER TABLE "Vendor" ADD COLUMN "email" TEXT')
    await ensureColumn(
      'Vendor',
      'isActive',
      'ALTER TABLE "Vendor" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT 1'
    )
    await ensureColumn(
      'Vendor',
      'createdAt',
      `ALTER TABLE "Vendor" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`
    )

    await ensureColumn('CompanySettings', 'phone', 'ALTER TABLE "CompanySettings" ADD COLUMN "phone" TEXT')
    await ensureColumn('CompanySettings', 'email', 'ALTER TABLE "CompanySettings" ADD COLUMN "email" TEXT')
    await ensureColumn('CompanySettings', 'gstNumber', 'ALTER TABLE "CompanySettings" ADD COLUMN "gstNumber" TEXT')
    await ensureColumn('CompanySettings', 'slipNumberFormat', 'ALTER TABLE "CompanySettings" ADD COLUMN "slipNumberFormat" TEXT')
    await ensureColumn('CompanySettings', 'theme', 'ALTER TABLE "CompanySettings" ADD COLUMN "theme" TEXT')
    await ensureColumn(
      'CompanySettings',
      'inactivityTimeoutMinutes',
      'ALTER TABLE "CompanySettings" ADD COLUMN "inactivityTimeoutMinutes" INTEGER'
    )
    await ensureColumn('CompanySettings', 'logoUrl', 'ALTER TABLE "CompanySettings" ADD COLUMN "logoUrl" TEXT')
    await ensureColumn('CompanySettings', 'logoDataUrl', 'ALTER TABLE "CompanySettings" ADD COLUMN "logoDataUrl" TEXT')
    await ensureColumn('CompanySettings', 'loginUsername', 'ALTER TABLE "CompanySettings" ADD COLUMN "loginUsername" TEXT')
    await ensureColumn('CompanySettings', 'loginPassword', 'ALTER TABLE "CompanySettings" ADD COLUMN "loginPassword" TEXT')
    await ensureColumn(
      'CompanySettings',
      'updatedAt',
      `ALTER TABLE "CompanySettings" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`
    )

    await ensureColumn('PackingSlip', 'poNumber', 'ALTER TABLE "PackingSlip" ADD COLUMN "poNumber" TEXT')
    await ensureColumn('PackingSlip', 'boxNumber', 'ALTER TABLE "PackingSlip" ADD COLUMN "boxNumber" TEXT')
    await ensureColumn(
      'PackingSlip',
      'trackingNumber',
      'ALTER TABLE "PackingSlip" ADD COLUMN "trackingNumber" TEXT'
    )
    await ensureColumn('PackingSlip', 'vendorId', 'ALTER TABLE "PackingSlip" ADD COLUMN "vendorId" INTEGER')

    await ensureColumn('PackingSlipLine', 'boxName', 'ALTER TABLE "PackingSlipLine" ADD COLUMN "boxName" TEXT')
    await ensureColumn('PackingSlipLine', 'boxNumber', 'ALTER TABLE "PackingSlipLine" ADD COLUMN "boxNumber" TEXT')

    await ensureIndex(
      'Item',
      'Item_sku_key',
      'CREATE UNIQUE INDEX "Item_sku_key" ON "Item"("sku")'
    )
    await ensureIndex(
      'PackingSlip',
      'PackingSlip_slipNo_key',
      'CREATE UNIQUE INDEX "PackingSlip_slipNo_key" ON "PackingSlip"("slipNo")'
    )
    await ensureIndex(
      'PackingSlipRevision',
      'PackingSlipRevision_slipId_version_idx',
      'CREATE INDEX "PackingSlipRevision_slipId_version_idx" ON "PackingSlipRevision"("slipId", "version")'
    )

    const packingSlipIndexes = await getIndexes('PackingSlip')
    if (packingSlipIndexes.some((index) => index.name === 'PackingSlip_poNumber_key')) {
      actions.push({
        description: 'Drop obsolete Bill No unique index',
        sql: 'DROP INDEX "PackingSlip_poNumber_key"',
      })
    }
  }

  try {
    await ensureMissingSchema()

    if (currentVersion < TARGET_DB_VERSION) {
      actions.push({
        description: `Set schema version ${TARGET_DB_VERSION}`,
        sql: `PRAGMA user_version = ${TARGET_DB_VERSION}`,
      })
    }

    if (actions.length === 0) {
      await prisma.$disconnect()
      return {
        changed: false,
        databasePath,
        backupPath: null,
        appliedSteps: [],
        version: Math.max(currentVersion, TARGET_DB_VERSION),
      }
    }

    const backupPath = copyDatabaseBackup(databasePath)

    const appliedSteps = []
    for (const action of actions) {
      logger('[db-repair]', action.description)
      await exec(action.sql)
      appliedSteps.push(action.description)
    }

    await prisma.$disconnect()
    return {
      changed: true,
      databasePath,
      backupPath,
      appliedSteps,
      version: TARGET_DB_VERSION,
    }
  } catch (error) {
    await prisma.$disconnect().catch(() => {})
    throw error
  }
}

const rebuildDatabaseSchema = async (options = {}) => {
  const logger =
    typeof options.logger === 'function' ? options.logger : () => {}
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL || ''
  const databasePath = normalizeDatabasePath(databaseUrl)

  fs.mkdirSync(path.dirname(databasePath), { recursive: true })

  logger('[db-repair]', 'Rebuilding database from a clean schema')
  const backupPath = moveDatabaseBackup(databasePath)
  removeDatabaseSidecars(databasePath)

  const result = await ensureDatabaseSchema({
    ...options,
    databaseUrl,
    logger,
  })

  return {
    ...result,
    changed: true,
    backupPath: backupPath || result.backupPath,
    appliedSteps: ['Create fresh database', ...result.appliedSteps],
    recreated: true,
  }
}

module.exports = {
  TARGET_DB_VERSION,
  ensureDatabaseSchema,
  rebuildDatabaseSchema,
}
