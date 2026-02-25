export type ReportBucket = 'daily' | 'weekly' | 'monthly'

export type ReportFilters = {
  from: string
  to: string
  bucket: ReportBucket
  vendorId: string
  customer: string
}

export type VendorOption = {
  id: number
  name: string
}

export type OverviewResponse = {
  kpis: {
    totalSlips: number
    totalLines: number
    avgLinesPerSlip: number
    uniqueCustomers: number
    uniqueVendors: number
    trackingPercent: number
    totalRevisions: number
    avgRevisionsPerSlip: number
  }
}

export type TimeseriesResponse = {
  points: Array<{ bucket: string; value: number }>
}

export type CustomersTopResponse = {
  customers: Array<{
    customerName: string
    slipCount: number
    totalQty: number
    lineCount: number
  }>
}

export type VendorsTopResponse = {
  vendors: Array<{
    vendorId: number | null
    vendorName: string
    slipCount: number
    totalQty: number
    lineCount: number
  }>
}

export type ItemsTopResponse = {
  items: Array<{
    itemId: number
    sku: string
    name: string
    unit: string
    totalQty: number
    lineCount: number
    slipCount: number
  }>
}

export type ItemsSummaryResponse = {
  summary: {
    totalQty: number
    lineCount: number
    slipCount: number
    distinctItems: number
    avgQtyPerSlip: number
    avgQtyPerLine: number
  }
}

export type RevisionsTopResponse = {
  slips: Array<{
    slipId: number
    slipNo: string
    revisionCount: number
    lastRevisionAt: string | null
  }>
}

export type ReportsPayload = {
  overview: OverviewResponse
  slipsTrend: TimeseriesResponse
  qtyTrend: TimeseriesResponse
  revisionsTrend: TimeseriesResponse
  customersTop: CustomersTopResponse
  vendorsTop: VendorsTopResponse
  itemsTopQty: ItemsTopResponse
  itemsTopFreq: ItemsTopResponse
  itemsSummary: ItemsSummaryResponse
  revisionsTop: RevisionsTopResponse
}
