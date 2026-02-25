'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import OverviewReport from '@/components/reports/overview-report'
import ItemsReport from '@/components/reports/items-report'
import ReportFilterBar from '@/components/reports/report-filter-bar'
import RevisionsReport from '@/components/reports/revisions-report'
import {
  ReportFilters,
  ReportsPayload,
  VendorOption,
} from '@/components/reports/report-types'
import {
  buildReportQuery,
  getDefaultReportFilters,
} from '@/components/reports/report-utils'

type CacheEntry = {
  at: number
  data: unknown
}

type ReportsDashboardProps = {
  onError?: (message: string) => void
}

const CACHE_TTL_MS = 60000

type ReportSubTab = 'overview' | 'items' | 'revisions'

const reportsTabs: Array<{ id: ReportSubTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'items', label: 'Items Shipped' },
  { id: 'revisions', label: 'Revisions / Audit' },
]

export default function ReportsDashboard({ onError }: ReportsDashboardProps) {
  const [filters, setFilters] = useState<ReportFilters>(getDefaultReportFilters)
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [activeTab, setActiveTab] = useState<ReportSubTab>('overview')
  const [payload, setPayload] = useState<ReportsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())

  const fetchJson = useCallback(async <T,>(url: string, signal: AbortSignal) => {
    const cached = cacheRef.current.get(url)
    const now = Date.now()

    if (cached && now - cached.at < CACHE_TTL_MS) {
      return cached.data as T
    }

    const response = await fetch(url, { signal })
    if (!response.ok) {
      throw new Error(`Unable to load ${url}`)
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

        const rows: VendorOption[] = await response.json()
        setVendors(rows)
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') return
        onError?.('Unable to load vendors for reports.')
      }
    }

    void loadVendors()
    return () => controller.abort()
  }, [onError])

  const reportQuery = useMemo(() => buildReportQuery(filters, 10), [filters])

  useEffect(() => {
    const controller = new AbortController()

    const loadReports = async () => {
      setLoading(true)
      setError(null)

      try {
        const [
          overview,
          slipsTrend,
          qtyTrend,
          revisionsTrend,
          customersTop,
          vendorsTop,
          itemsTopQty,
          itemsTopFreq,
          itemsSummary,
          revisionsTop,
        ] = await Promise.all([
          fetchJson<ReportsPayload['overview']>(
            `/api/reports/overview?${reportQuery}`,
            controller.signal
          ),
          fetchJson<ReportsPayload['slipsTrend']>(
            `/api/reports/timeseries?${reportQuery}&metric=slips`,
            controller.signal
          ),
          fetchJson<ReportsPayload['qtyTrend']>(
            `/api/reports/timeseries?${reportQuery}&metric=qty`,
            controller.signal
          ),
          fetchJson<ReportsPayload['revisionsTrend']>(
            `/api/reports/timeseries?${reportQuery}&metric=revisions`,
            controller.signal
          ),
          fetchJson<ReportsPayload['customersTop']>(
            `/api/reports/customers/top?${reportQuery}`,
            controller.signal
          ),
          fetchJson<ReportsPayload['vendorsTop']>(
            `/api/reports/vendors/top?${reportQuery}`,
            controller.signal
          ),
          fetchJson<ReportsPayload['itemsTopQty']>(
            `/api/reports/items/top?${reportQuery}&mode=qty`,
            controller.signal
          ),
          fetchJson<ReportsPayload['itemsTopFreq']>(
            `/api/reports/items/top?${reportQuery}&mode=freq`,
            controller.signal
          ),
          fetchJson<ReportsPayload['itemsSummary']>(
            `/api/reports/items/summary?${reportQuery}`,
            controller.signal
          ),
          fetchJson<ReportsPayload['revisionsTop']>(
            `/api/reports/revisions/top?${reportQuery}`,
            controller.signal
          ),
        ])

        setPayload({
          overview,
          slipsTrend,
          qtyTrend,
          revisionsTrend,
          customersTop,
          vendorsTop,
          itemsTopQty,
          itemsTopFreq,
          itemsSummary,
          revisionsTop,
        })
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') return

        setError('Unable to load reports for the selected filters.')
        onError?.('Unable to load reports.')
      } finally {
        setLoading(false)
      }
    }

    void loadReports()
    return () => controller.abort()
  }, [fetchJson, onError, reportQuery])

  const handleFilterUpdate = (next: Partial<ReportFilters>) => {
    setFilters((previous) => ({ ...previous, ...next }))
  }

  const handleFilterReset = () => {
    setFilters(getDefaultReportFilters())
  }

  return (
    <div className="reports-dashboard">
      <ReportFilterBar
        filters={filters}
        vendors={vendors}
        isRefreshing={loading && Boolean(payload)}
        onUpdate={handleFilterUpdate}
        onReset={handleFilterReset}
      />

      <div className="reports-subtabs" role="tablist" aria-label="Reports sections">
        {reportsTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-button reports-subtab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <div className="ui-alert ui-alert--danger">{error}</div> : null}

      {loading && !payload ? (
        <div className="skeleton-stack">
          <div className="skeleton-line lg" />
          <div className="skeleton-line md" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line sm" />
        </div>
      ) : null}

      {payload ? (
        activeTab === 'overview' ? (
          <OverviewReport data={payload} bucket={filters.bucket} />
        ) : activeTab === 'items' ? (
          <ItemsReport data={payload} bucket={filters.bucket} />
        ) : (
          <RevisionsReport data={payload} bucket={filters.bucket} />
        )
      ) : null}
    </div>
  )
}
