'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button, FieldGroup, Input, Label, Select, SectionCard } from '@/components/ui'

type ReportBucket = 'daily' | 'weekly' | 'monthly'

type Vendor = {
  id: number
  name: string
}

type OverviewResponse = {
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

type TimeseriesResponse = {
  points: Array<{ bucket: string; value: number }>
}

type TopCustomersResponse = {
  rows: Array<{ customerName: string; slipCount: number }>
}

type TopVendorsResponse = {
  rows: Array<{ vendorId: number | null; vendorName: string; slipCount: number }>
}

type TopItemsResponse = {
  rows: Array<{
    itemId: number
    itemName: string
    sku: string
    unit: string
    totalQty: number
    lineCount: number
  }>
}

type RevisionInsightsResponse = {
  mostEdited: Array<{
    slipId: number
    slipNo: string
    customerName: string
    revisionCount: number
  }>
  selectedSlip: {
    slipId: number
    slipNo: string
    customerName: string
    totalRevisions: number
    invalidSnapshots: number
    summary: {
      linesAdded: number
      linesRemoved: number
      qtyChanged: number
      customerChanged: number
      trackingChanged: number
      boxChanged: number
    }
    timeline: Array<{
      revisionId: number
      version: number
      createdAt: string
      invalidSnapshot: boolean
      lineCount: number
      customerName: string
      diffSummary: {
        linesAdded: number
        linesRemoved: number
        qtyChanged: number
        customerChanged: boolean
        trackingChanged: boolean
        boxChanged: boolean
      } | null
    }>
  } | null
}

type DashboardData = {
  overview: OverviewResponse
  slipsSeries: TimeseriesResponse
  qtySeries: TimeseriesResponse
  revisionsSeries: TimeseriesResponse
  topCustomers: TopCustomersResponse
  topVendors: TopVendorsResponse
  topItemsQty: TopItemsResponse
  topItemsFreq: TopItemsResponse
  revisionInsights: RevisionInsightsResponse
}

type CacheEntry = {
  at: number
  data: unknown
}

type ReportsDashboardProps = {
  onError?: (message: string) => void
}

const CACHE_TTL_MS = 60000

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10)

const getInitialFilters = () => {
  const now = new Date()
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 29)

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
    bucket: 'weekly' as ReportBucket,
    vendorId: '',
    customer: '',
  }
}

const formatNumber = (value: number, fractionDigits = 0) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value)

const formatPercent = (value: number) => `${formatNumber(value, 1)}%`

const formatTimelineDate = (isoValue: string) =>
  new Date(isoValue).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatBucketLabel = (bucket: string, bucketType: ReportBucket) => {
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

const chartTooltipFormatter = (value: unknown) => formatNumber(Number(value))

const buildReportQuery = (params: URLSearchParams) => params.toString()

export default function ReportsDashboard({ onError }: ReportsDashboardProps) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [filters, setFilters] = useState(getInitialFilters)
  const [selectedSlipId, setSelectedSlipId] = useState<number | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())

  const fetchJson = useCallback(async <T,>(url: string, signal: AbortSignal) => {
    const now = Date.now()
    const cached = cacheRef.current.get(url)
    if (cached && now - cached.at < CACHE_TTL_MS) {
      return cached.data as T
    }

    const response = await fetch(url, { signal })
    if (!response.ok) {
      throw new Error(`Request failed for ${url}`)
    }
    const data = (await response.json()) as T
    cacheRef.current.set(url, { at: now, data })
    return data
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadVendors = async () => {
      try {
        const response = await fetch('/api/vendors?includeInactive=1', {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Unable to load vendors.')
        }
        const data: Vendor[] = await response.json()
        setVendors(data)
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          onError?.('Unable to load vendors for reports.')
        }
      }
    }
    void loadVendors()
    return () => controller.abort()
  }, [onError])

  const baseSearchParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('from', filters.from)
    params.set('to', filters.to)
    params.set('bucket', filters.bucket)
    params.set('limit', '10')
    if (filters.vendorId) params.set('vendorId', filters.vendorId)
    if (filters.customer.trim()) params.set('customer', filters.customer.trim())
    return params
  }, [filters])

  const commonQuery = useMemo(
    () => buildReportQuery(baseSearchParams),
    [baseSearchParams]
  )

  const revisionInsightsQuery = useMemo(() => {
    const params = new URLSearchParams(baseSearchParams)
    if (selectedSlipId) params.set('slipId', String(selectedSlipId))
    return buildReportQuery(params)
  }, [baseSearchParams, selectedSlipId])

  useEffect(() => {
    const controller = new AbortController()

    const loadDashboard = async () => {
      setLoading(true)
      setError(null)
      try {
        const [
          overview,
          slipsSeries,
          qtySeries,
          revisionsSeries,
          topCustomers,
          topVendors,
          topItemsQty,
          topItemsFreq,
          revisionInsights,
        ] = await Promise.all([
          fetchJson<OverviewResponse>(
            `/api/reports/overview?${commonQuery}`,
            controller.signal
          ),
          fetchJson<TimeseriesResponse>(
            `/api/reports/timeseries?${commonQuery}&metric=slips`,
            controller.signal
          ),
          fetchJson<TimeseriesResponse>(
            `/api/reports/timeseries?${commonQuery}&metric=qty`,
            controller.signal
          ),
          fetchJson<TimeseriesResponse>(
            `/api/reports/timeseries?${commonQuery}&metric=revisions`,
            controller.signal
          ),
          fetchJson<TopCustomersResponse>(
            `/api/reports/top-customers?${commonQuery}`,
            controller.signal
          ),
          fetchJson<TopVendorsResponse>(
            `/api/reports/top-vendors?${commonQuery}`,
            controller.signal
          ),
          fetchJson<TopItemsResponse>(
            `/api/reports/top-items?${commonQuery}&mode=qty`,
            controller.signal
          ),
          fetchJson<TopItemsResponse>(
            `/api/reports/top-items?${commonQuery}&mode=freq`,
            controller.signal
          ),
          fetchJson<RevisionInsightsResponse>(
            `/api/reports/revision-insights?${revisionInsightsQuery}`,
            controller.signal
          ),
        ])

        setDashboard({
          overview,
          slipsSeries,
          qtySeries,
          revisionsSeries,
          topCustomers,
          topVendors,
          topItemsQty,
          topItemsFreq,
          revisionInsights,
        })
      } catch (loadError) {
        if ((loadError as Error).name === 'AbortError') return
        setError('Unable to load reports for the selected filters.')
        onError?.('Unable to load reports.')
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
    return () => controller.abort()
  }, [commonQuery, fetchJson, onError, revisionInsightsQuery])

  const resetFilters = () => {
    setFilters(getInitialFilters())
    setSelectedSlipId(null)
  }

  const selectedSummary = dashboard?.revisionInsights.selectedSlip?.summary
  const kpis = dashboard?.overview.kpis

  return (
    <div className="reports-dashboard">
      <SectionCard className="reports-filters-card">
        <div className="page-header">
          <div>
            <h2 className="section-title">Reporting Dashboard</h2>
            <p className="section-subtitle">
              Explore packing slip, quantity, and audit trends.
            </p>
          </div>
          <div className="page-header-actions">
            {loading && dashboard ? <span className="pill">Refreshing...</span> : null}
            <Button variant="ghost" size="sm" type="button" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>

        <div className="reports-filters-grid">
          <FieldGroup>
            <Label htmlFor="report-from">From</Label>
            <Input
              id="report-from"
              type="date"
              value={filters.from}
              onChange={(event) =>
                setFilters((previous) => ({ ...previous, from: event.target.value }))
              }
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="report-to">To</Label>
            <Input
              id="report-to"
              type="date"
              value={filters.to}
              onChange={(event) =>
                setFilters((previous) => ({ ...previous, to: event.target.value }))
              }
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="report-bucket">Grouping</Label>
            <Select
              id="report-bucket"
              value={filters.bucket}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  bucket: event.target.value as ReportBucket,
                }))
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="report-vendor">Vendor</Label>
            <Select
              id="report-vendor"
              value={filters.vendorId}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  vendorId: event.target.value,
                }))
              }
            >
              <option value="">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={String(vendor.id)}>
                  {vendor.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup className="reports-customer-filter">
            <Label htmlFor="report-customer">Customer search</Label>
            <Input
              id="report-customer"
              type="search"
              value={filters.customer}
              placeholder="Type customer name..."
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  customer: event.target.value,
                }))
              }
            />
          </FieldGroup>
        </div>
      </SectionCard>

      {error ? <div className="ui-alert ui-alert--danger">{error}</div> : null}

      {loading && !dashboard ? (
        <div className="skeleton-stack">
          <div className="skeleton-line lg" />
          <div className="skeleton-line md" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ) : null}

      {!loading && dashboard ? (
        <>
          <div className="reports-kpi-grid">
            <div className="report-card report-kpi-card">
              <div className="report-title">Total Slips</div>
              <div className="report-value">{formatNumber(kpis?.totalSlips ?? 0)}</div>
            </div>
            <div className="report-card report-kpi-card">
              <div className="report-title">Total Lines</div>
              <div className="report-value">{formatNumber(kpis?.totalLines ?? 0)}</div>
            </div>
            <div className="report-card report-kpi-card">
              <div className="report-title">Avg Lines / Slip</div>
              <div className="report-value">
                {formatNumber(kpis?.avgLinesPerSlip ?? 0, 2)}
              </div>
            </div>
            <div className="report-card report-kpi-card">
              <div className="report-title">Unique Customers</div>
              <div className="report-value">
                {formatNumber(kpis?.uniqueCustomers ?? 0)}
              </div>
            </div>
            <div className="report-card report-kpi-card">
              <div className="report-title">Unique Vendors</div>
              <div className="report-value">{formatNumber(kpis?.uniqueVendors ?? 0)}</div>
            </div>
            <div className="report-card report-kpi-card">
              <div className="report-title">With Tracking</div>
              <div className="report-value">{formatPercent(kpis?.trackingPercent ?? 0)}</div>
            </div>
            <div className="report-card report-kpi-card">
              <div className="report-title">Total Revisions</div>
              <div className="report-value">
                {formatNumber(kpis?.totalRevisions ?? 0)}
              </div>
            </div>
            <div className="report-card report-kpi-card">
              <div className="report-title">Avg Revisions / Slip</div>
              <div className="report-value">
                {formatNumber(kpis?.avgRevisionsPerSlip ?? 0, 2)}
              </div>
            </div>
          </div>

          <div className="reports-chart-grid">
            <SectionCard className="reports-chart-card">
              <h3 className="section-title">Slips Over Time</h3>
              {dashboard.slipsSeries.points.length === 0 ? (
                <div className="empty-state">No data for this range.</div>
              ) : (
                <div className="reports-chart-area">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={dashboard.slipsSeries.points}>
                      <defs>
                        <linearGradient id="slipsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.42} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" />
                      <XAxis
                        dataKey="bucket"
                        tickFormatter={(value) =>
                          formatBucketLabel(String(value), filters.bucket)
                        }
                        stroke="var(--muted)"
                      />
                      <YAxis allowDecimals={false} stroke="var(--muted)" />
                      <Tooltip formatter={chartTooltipFormatter} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--accent)"
                        fill="url(#slipsFill)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>

            <SectionCard className="reports-chart-card">
              <h3 className="section-title">Qty Shipped Over Time</h3>
              {dashboard.qtySeries.points.length === 0 ? (
                <div className="empty-state">No quantity data for this range.</div>
              ) : (
                <div className="reports-chart-area">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dashboard.qtySeries.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" />
                      <XAxis
                        dataKey="bucket"
                        tickFormatter={(value) =>
                          formatBucketLabel(String(value), filters.bucket)
                        }
                        stroke="var(--muted)"
                      />
                      <YAxis stroke="var(--muted)" />
                      <Tooltip formatter={chartTooltipFormatter} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#16a085"
                        strokeWidth={2.2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard className="reports-chart-card">
            <h3 className="section-title">Revisions Over Time</h3>
            {dashboard.revisionsSeries.points.length === 0 ? (
              <div className="empty-state">No revision data for this range.</div>
            ) : (
              <div className="reports-chart-area">
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={dashboard.revisionsSeries.points}>
                    <defs>
                      <linearGradient id="revisionFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fe8f2d" stopOpacity={0.38} />
                        <stop offset="100%" stopColor="#fe8f2d" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" />
                    <XAxis
                      dataKey="bucket"
                      tickFormatter={(value) =>
                        formatBucketLabel(String(value), filters.bucket)
                      }
                      stroke="var(--muted)"
                    />
                    <YAxis allowDecimals={false} stroke="var(--muted)" />
                    <Tooltip formatter={chartTooltipFormatter} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#fe8f2d"
                      fill="url(#revisionFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <div className="reports-leaderboard-grid">
            <SectionCard className="reports-table-card">
              <h3 className="section-title">Top Customers</h3>
              {dashboard.topCustomers.rows.length === 0 ? (
                <div className="empty-state">No customer data for this range.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Slips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topCustomers.rows.map((row, index) => (
                      <tr key={`${row.customerName}-${index}`}>
                        <td>{row.customerName || 'Unnamed customer'}</td>
                        <td>{formatNumber(row.slipCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>

            <SectionCard className="reports-table-card">
              <h3 className="section-title">Top Vendors</h3>
              {dashboard.topVendors.rows.length === 0 ? (
                <div className="empty-state">No vendor data for this range.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Slips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topVendors.rows.map((row) => (
                      <tr key={`${row.vendorId}-${row.vendorName}`}>
                        <td>{row.vendorName}</td>
                        <td>{formatNumber(row.slipCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>

            <SectionCard className="reports-table-card">
              <h3 className="section-title">Top Items by Qty</h3>
              {dashboard.topItemsQty.rows.length === 0 ? (
                <div className="empty-state">No item quantity data for this range.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topItemsQty.rows.map((row) => (
                      <tr key={`qty-${row.itemId}`}>
                        <td>
                          {row.itemName}
                          {row.sku ? <span className="reports-muted-inline"> ({row.sku})</span> : null}
                        </td>
                        <td>{formatNumber(row.totalQty, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>

            <SectionCard className="reports-table-card">
              <h3 className="section-title">Top Items by Frequency</h3>
              {dashboard.topItemsFreq.rows.length === 0 ? (
                <div className="empty-state">No item frequency data for this range.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topItemsFreq.rows.map((row) => (
                      <tr key={`freq-${row.itemId}`}>
                        <td>
                          {row.itemName}
                          {row.sku ? <span className="reports-muted-inline"> ({row.sku})</span> : null}
                        </td>
                        <td>{formatNumber(row.lineCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>
          </div>

          <SectionCard className="reports-audit-card">
            <div className="page-header">
              <div>
                <h3 className="section-title">Revision Insights</h3>
                <p className="section-subtitle">
                  Most edited slips with lightweight snapshot diffs.
                </p>
              </div>
            </div>

            <div className="reports-audit-grid">
              <div className="reports-audit-left">
                <h4 className="reports-subheading">Most Edited Slips</h4>
                {dashboard.revisionInsights.mostEdited.length === 0 ? (
                  <div className="empty-state">No revisions for this range.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Slip</th>
                        <th>Customer</th>
                        <th>Revisions</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.revisionInsights.mostEdited.map((row) => (
                        <tr key={row.slipId}>
                          <td>{row.slipNo}</td>
                          <td>{row.customerName || '-'}</td>
                          <td>{formatNumber(row.revisionCount)}</td>
                          <td className="table-action-cell">
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => setSelectedSlipId(row.slipId)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="reports-audit-right">
                {dashboard.revisionInsights.selectedSlip ? (
                  <>
                    <h4 className="reports-subheading">
                      {dashboard.revisionInsights.selectedSlip.slipNo}
                    </h4>
                    <p className="reports-muted-block">
                      {dashboard.revisionInsights.selectedSlip.customerName}
                    </p>

                    <div className="reports-kpi-mini-grid">
                      <div className="report-card">
                        <div className="report-title">Lines Added</div>
                        <div className="report-value">
                          {formatNumber(selectedSummary?.linesAdded ?? 0)}
                        </div>
                      </div>
                      <div className="report-card">
                        <div className="report-title">Lines Removed</div>
                        <div className="report-value">
                          {formatNumber(selectedSummary?.linesRemoved ?? 0)}
                        </div>
                      </div>
                      <div className="report-card">
                        <div className="report-title">Qty Changed</div>
                        <div className="report-value">
                          {formatNumber(selectedSummary?.qtyChanged ?? 0)}
                        </div>
                      </div>
                      <div className="report-card">
                        <div className="report-title">Invalid Snapshots</div>
                        <div className="report-value">
                          {formatNumber(
                            dashboard.revisionInsights.selectedSlip.invalidSnapshots
                          )}
                        </div>
                      </div>
                    </div>

                    <table className="table">
                      <thead>
                        <tr>
                          <th>Version</th>
                          <th>Timestamp</th>
                          <th>Lines</th>
                          <th>Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.revisionInsights.selectedSlip.timeline.map((entry) => (
                          <tr key={entry.revisionId}>
                            <td>v{entry.version}</td>
                            <td>{formatTimelineDate(entry.createdAt)}</td>
                            <td>{formatNumber(entry.lineCount)}</td>
                            <td>
                              {entry.invalidSnapshot ? (
                                <span className="reports-danger-text">Invalid snapshot</span>
                              ) : entry.diffSummary ? (
                                <span className="reports-muted-inline">
                                  +{entry.diffSummary.linesAdded} / -
                                  {entry.diffSummary.linesRemoved} / qty{' '}
                                  {entry.diffSummary.qtyChanged}
                                </span>
                              ) : (
                                <span className="reports-muted-inline">Baseline</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <div className="empty-state">Select a slip to inspect revision diffs.</div>
                )}
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  )
}
