import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const isAbsoluteFilePath = (value: string): boolean =>
  path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value)

const toSqliteUrl = (filePath: string): string =>
  `file:${filePath.replace(/\\/g, '/')}`

const findWorkspaceRoot = (): string | null => {
  const starts = [process.cwd(), __dirname]
  for (const start of starts) {
    let current = start
    for (let depth = 0; depth < 8; depth += 1) {
      if (fs.existsSync(path.join(current, 'prisma', 'schema.prisma'))) {
        return current
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  return null
}

const ensureDatabaseUrl = () => {
  const current = process.env.DATABASE_URL?.trim()
  if (!current || !current.startsWith('file:')) return

  const rawPath = current.slice(5)
  if (!rawPath) {
    return
  }

  if (isAbsoluteFilePath(rawPath)) {
    fs.mkdirSync(path.dirname(rawPath), { recursive: true })
    process.env.DATABASE_URL = toSqliteUrl(rawPath)
    return
  }

  const workspaceRoot = findWorkspaceRoot()
  const base = workspaceRoot || process.cwd()
  const absolutePath = path.resolve(base, rawPath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  process.env.DATABASE_URL = toSqliteUrl(absolutePath)
}

ensureDatabaseUrl()

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
