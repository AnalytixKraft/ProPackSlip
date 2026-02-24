import * as XLSX from 'xlsx'

export type ImportedRow = Record<string, string>

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const knownHeaders = new Set(
  [
    'name',
    'item',
    'itemname',
    'product',
    'productname',
    'unit',
    'uom',
    'sku',
    'itemcode',
    'notes',
    'description',
    'remark',
  ].map(normalizeHeader)
)

const normalizeCell = (value: unknown): string => {
  if (value == null) return ''
  return String(value).trim()
}

export const readImportedRows = async (file: File): Promise<ImportedRow[]> => {
  const bytes = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(bytes, {
    type: 'buffer',
    raw: false,
    cellDates: false,
  })

  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) {
    return []
  }

  const sheet = workbook.Sheets[firstSheet]
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  const normalizedRecords = records.map((record) => {
    const normalized: ImportedRow = {}
    Object.entries(record).forEach(([key, value]) => {
      const normalizedKey = normalizeHeader(key)
      if (!normalizedKey) return
      normalized[normalizedKey] = normalizeCell(value)
    })
    return normalized
  })

  const hasKnownHeader = normalizedRecords.some((row) =>
    Object.keys(row).some((key) => knownHeaders.has(key))
  )
  if (hasKnownHeader) {
    return normalizedRecords
  }

  // Fallback for headerless sheets where the first row is actual item data.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  return rows
    .map((cells) => {
      const normalized: ImportedRow = {}
      cells.forEach((value, index) => {
        const key = `col${index + 1}`
        normalized[key] = normalizeCell(value)
      })
      return normalized
    })
    .filter((row) =>
      Object.values(row).some((value) => value.trim().length > 0)
    )
}

export const readFirstValue = (
  row: ImportedRow,
  aliases: string[]
): string => {
  for (const alias of aliases) {
    const key = normalizeHeader(alias)
    const value = row[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}
