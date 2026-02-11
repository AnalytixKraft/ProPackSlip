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

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const rowNumber = index + 2

      const name = readFirstValue(row, ['name', 'item', 'itemname', 'product', 'productname'])
      const unit = readFirstValue(row, ['unit', 'uom']) || 'pcs'
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

      const normalizedName = name.toLowerCase()
      const normalizedSku = skuInput.trim()

      let matchedId: number | undefined
      if (normalizedSku && skuToId.has(normalizedSku)) {
        matchedId = skuToId.get(normalizedSku)
      } else if (nameToId.has(normalizedName)) {
        matchedId = nameToId.get(normalizedName)
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
      total: rows.length,
      errors: errors.slice(0, 30),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to import items.' }, { status: 500 })
  }
}
