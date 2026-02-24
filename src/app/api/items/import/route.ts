import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readFirstValue, readImportedRows } from '@/lib/import-sheet'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ImportError = {
  row: number
  message: string
}

type ParsedRow = {
  rowNumber: number
  name: string
  normalizedName: string
  unit: string
  notes: string | null
  normalizedSku: string
}

const commonUnits = new Set([
  'pc',
  'pcs',
  'piece',
  'pieces',
  'no',
  'nos',
  'unit',
  'units',
  'box',
  'boxes',
  'pack',
  'packs',
  'set',
  'sets',
  'pair',
  'pairs',
  'roll',
  'rolls',
  'carton',
  'cartons',
  'dozen',
  'kg',
  'g',
  'gm',
  'mg',
  'l',
  'ltr',
  'liter',
  'litre',
  'ml',
])

const isLikelyUnit = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  if (commonUnits.has(normalized)) return true
  return /^([0-9]+(\.[0-9]+)?)\s*[a-z]+$/i.test(normalized)
}

const inferNameFromRow = (row: Record<string, string>) => {
  const values = Object.values(row)
    .map((value) => value.trim())
    .filter(Boolean)
  if (values.length === 0) return ''
  const nonUnits = values.filter((value) => !isLikelyUnit(value))
  const pool = nonUnits.length > 0 ? nonUnits : values
  return pool.reduce((best, current) =>
    current.length > best.length ? current : best
  )
}

const inferUnitFromRow = (row: Record<string, string>) => {
  const values = Object.values(row)
    .map((value) => value.trim())
    .filter(Boolean)
  for (const value of values) {
    if (isLikelyUnit(value)) {
      return value
    }
  }
  return ''
}

const createAutoSku = (seed: number) =>
  `SKU-${Date.now().toString(36).toUpperCase()}-${seed.toString(36).toUpperCase()}-${Math.floor(
    100 + Math.random() * 900
  )}`

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Upload a CSV or Excel file.' }, { status: 400 })
    }

    const rows = await readImportedRows(file)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows found in the uploaded file.' }, { status: 400 })
    }

    const existing = await prisma.item.findMany({
      select: { id: true, sku: true, name: true },
    })
    const skuToId = new Map(
      existing.map((item) => [item.sku.trim().toUpperCase(), item.id] as const)
    )
    const nameToId = new Map(
      existing.map((item) => [item.name.trim().toLowerCase(), item.id] as const)
    )

    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0
    const errors: ImportError[] = []
    let skuSeed = 1
    let duplicateNameRowsRemoved = 0

    const latestRowByName = new Map<string, ParsedRow>()

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const rowNumber = index + 2
      const nameFromHeader = readFirstValue(row, [
        'name',
        'item',
        'itemname',
        'product',
        'productname',
      ])
      const unitFromHeader = readFirstValue(row, ['unit', 'uom'])
      const inferredName = inferNameFromRow(row)
      const inferredUnit = inferUnitFromRow(row)
      const name = nameFromHeader || inferredName
      const unit = unitFromHeader || inferredUnit || 'pcs'
      const notes = readFirstValue(row, ['notes', 'description', 'remark']) || null
      const skuInput = readFirstValue(row, ['sku', 'itemcode']).toUpperCase()

      const hasAnyValue = Object.values(row).some((value) => value.trim().length > 0)
      if (!hasAnyValue) {
        skipped += 1
        continue
      }

      if (!name) {
        failed += 1
        errors.push({ row: rowNumber, message: 'Missing item name.' })
        continue
      }

      const normalizedName = name.trim().toLowerCase()
      const normalizedSku = skuInput.trim()
      if (latestRowByName.has(normalizedName)) {
        duplicateNameRowsRemoved += 1
      }
      latestRowByName.set(normalizedName, {
        rowNumber,
        name,
        normalizedName,
        unit,
        notes,
        normalizedSku,
      })
    }

    const rowsToImport = Array.from(latestRowByName.values()).sort(
      (a, b) => a.rowNumber - b.rowNumber
    )

    for (const row of rowsToImport) {
      const { rowNumber, name, normalizedName, unit, notes, normalizedSku } = row

      let matchedId: number | undefined
      if (nameToId.has(normalizedName)) {
        matchedId = nameToId.get(normalizedName)
      } else if (normalizedSku && skuToId.has(normalizedSku)) {
        matchedId = skuToId.get(normalizedSku)
      }

      try {
        if (matchedId) {
          const saved = await prisma.item.update({
            where: { id: matchedId },
            data: {
              name,
              unit,
              notes,
              ...(normalizedSku ? { sku: normalizedSku } : {}),
              isActive: true,
            },
            select: { id: true, sku: true, name: true },
          })
          skuToId.set(saved.sku.trim().toUpperCase(), saved.id)
          nameToId.set(saved.name.trim().toLowerCase(), saved.id)
          updated += 1
          continue
        }

        let sku = normalizedSku
        if (!sku) {
          do {
            sku = createAutoSku(skuSeed)
            skuSeed += 1
          } while (skuToId.has(sku))
        }

        const saved = await prisma.item.create({
          data: {
            name,
            unit,
            notes,
            sku,
            isActive: true,
          },
          select: { id: true, sku: true, name: true },
        })
        skuToId.set(saved.sku.trim().toUpperCase(), saved.id)
        nameToId.set(saved.name.trim().toLowerCase(), saved.id)
        created += 1
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          failed += 1
          errors.push({
            row: rowNumber,
            message: normalizedSku
              ? `SKU "${normalizedSku}" already exists with conflicting data.`
              : 'Could not generate a unique SKU.',
          })
          continue
        }
        throw error
      }
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      failed,
      duplicateNameRowsRemoved,
      rowsAfterDuplicateRemoval: rowsToImport.length,
      loaded: created + updated,
      total: rows.length,
      errors: errors.slice(0, 30),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to import items.' }, { status: 500 })
  }
}
