import { Prisma } from '@prisma/client'

export type ReportBucket = 'daily' | 'weekly' | 'monthly'
export type ReportMetric = 'slips' | 'qty' | 'revisions'

export type ReportFilterOptions = {
  from: string
  to: string
  fromDate: Date
  toDate: Date
  toExclusive: Date
  vendorId: number | null
  customer: string
  bucket: ReportBucket
  metric: ReportMetric
  limit: number
  slipId: number | null
}

const isoDateOnly = (date: Date) => date.toISOString().slice(0, 10)

const parseDateOnly = (value: string | null): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const normalizeLimit = (value: string | null, fallback = 10) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, 100)
}

export const parseReportFilters = (
  searchParams: URLSearchParams
): ReportFilterOptions => {
  const today = new Date()
  const toDefault = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  )
  const fromDefault = new Date(toDefault)
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 29)

  const fromDate = parseDateOnly(searchParams.get('from')) ?? fromDefault
  const toDate = parseDateOnly(searchParams.get('to')) ?? toDefault

  const normalizedFrom = fromDate <= toDate ? fromDate : toDate
  const normalizedTo = fromDate <= toDate ? toDate : fromDate
  const toExclusive = new Date(normalizedTo)
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)

  const vendorIdRaw = Number(searchParams.get('vendorId'))
  const vendorId =
    Number.isInteger(vendorIdRaw) && vendorIdRaw > 0 ? vendorIdRaw : null
  const customer = (searchParams.get('customer') ?? '').trim()

  const bucketParam = searchParams.get('bucket')
  const bucket: ReportBucket =
    bucketParam === 'daily' || bucketParam === 'monthly' || bucketParam === 'weekly'
      ? bucketParam
      : 'weekly'

  const metricParam = searchParams.get('metric')
  const metric: ReportMetric =
    metricParam === 'slips' || metricParam === 'qty' || metricParam === 'revisions'
      ? metricParam
      : 'slips'

  const limit = normalizeLimit(searchParams.get('limit'))
  const slipIdRaw = Number(searchParams.get('slipId'))
  const slipId = Number.isInteger(slipIdRaw) && slipIdRaw > 0 ? slipIdRaw : null

  return {
    from: isoDateOnly(normalizedFrom),
    to: isoDateOnly(normalizedTo),
    fromDate: normalizedFrom,
    toDate: normalizedTo,
    toExclusive,
    vendorId,
    customer,
    bucket,
    metric,
    limit,
    slipId,
  }
}

export const buildPackingSlipWhere = (
  filters: Pick<
    ReportFilterOptions,
    'fromDate' | 'toExclusive' | 'vendorId' | 'customer'
  >
): Prisma.PackingSlipWhereInput => {
  const where: Prisma.PackingSlipWhereInput = {
    slipDate: {
      gte: filters.fromDate,
      lt: filters.toExclusive,
    },
  }

  if (filters.vendorId) {
    where.vendorId = filters.vendorId
  }

  if (filters.customer) {
    where.customerName = { contains: filters.customer }
  }

  return where
}

export const buildRawSlipWhereSql = (
  filters: Pick<
    ReportFilterOptions,
    'fromDate' | 'toExclusive' | 'vendorId' | 'customer'
  >,
  alias: string
) => {
  const slipDateColumn = Prisma.raw(`"${alias}"."slipDate"`)
  const vendorColumn = Prisma.raw(`"${alias}"."vendorId"`)
  const customerColumn = Prisma.raw(`"${alias}"."customerName"`)

  const conditions: Prisma.Sql[] = [
    Prisma.sql`${slipDateColumn} >= ${filters.fromDate}`,
    Prisma.sql`${slipDateColumn} < ${filters.toExclusive}`,
  ]

  if (filters.vendorId) {
    conditions.push(Prisma.sql`${vendorColumn} = ${filters.vendorId}`)
  }

  if (filters.customer) {
    conditions.push(
      Prisma.sql`LOWER(COALESCE(${customerColumn}, '')) LIKE ${`%${filters.customer.toLowerCase()}%`}`
    )
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
}

export const bucketExpression = (bucket: ReportBucket, qualifiedColumn: string) => {
  const column = Prisma.raw(qualifiedColumn)
  const epochSeconds = Prisma.sql`${column} / 1000`

  if (bucket === 'daily') {
    return Prisma.sql`strftime('%Y-%m-%d', ${epochSeconds}, 'unixepoch')`
  }
  if (bucket === 'monthly') {
    return Prisma.sql`strftime('%Y-%m', ${epochSeconds}, 'unixepoch')`
  }
  return Prisma.sql`strftime('%Y-W%W', ${epochSeconds}, 'unixepoch')`
}
