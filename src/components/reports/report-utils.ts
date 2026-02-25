import { ReportBucket, ReportFilters } from '@/components/reports/report-types'

export const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10)

export const getDefaultReportFilters = (): ReportFilters => {
  const today = new Date()
  const to = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  )
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 29)

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
    bucket: 'weekly',
    vendorId: '',
    customer: '',
  }
}

export const formatNumber = (value: number, fractionDigits = 0) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value)

export const formatPercent = (value: number) => `${formatNumber(value, 1)}%`

export const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatBucketLabel = (bucket: string, bucketType: ReportBucket) => {
  if (bucketType === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
    return new Date(`${bucket}T00:00:00.000Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    })
  }

  if (bucketType === 'monthly' && /^\d{4}-\d{2}$/.test(bucket)) {
    return new Date(`${bucket}-01T00:00:00.000Z`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  }

  return bucket
}

export const toChartTooltipValue = (value: unknown) => formatNumber(Number(value))

export const buildReportQuery = (filters: ReportFilters, limit = 10) => {
  const params = new URLSearchParams()
  params.set('from', filters.from)
  params.set('to', filters.to)
  params.set('bucket', filters.bucket)
  params.set('limit', String(limit))

  if (filters.vendorId) params.set('vendorId', filters.vendorId)
  if (filters.customer.trim()) params.set('customer', filters.customer.trim())

  return params.toString()
}
