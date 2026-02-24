'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type SlipSummary = {
  id: number
  slipNo: string
  poNumber: string | null
  customerName: string
  slipDate: string
  createdAt: string
  _count: { lines: number }
}

type SlipRevision = {
  id: number
  slipId: number
  version: number
  snapshot: string
  createdAt: string
}

export default function HistoryPage() {
  const [slips, setSlips] = useState<SlipSummary[]>([])
  const [revisions, setRevisions] = useState<SlipRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRevisions, setLoadingRevisions] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'recent' | 'versions' | 'reports'>(
    'recent'
  )
  const [activeReport, setActiveReport] = useState<'customers'>('customers')

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch('/api/packing-slips', {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Unable to load history.')
        }
        const data: SlipSummary[] = await response.json()
        setSlips(data)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          showToast('Unable to load history.')
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (activeTab !== 'versions' && activeTab !== 'reports') return
    const controller = new AbortController()
    const loadRevisions = async () => {
      setLoadingRevisions(true)
      try {
        const response = await fetch('/api/packing-slips/revisions', {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Unable to load history.')
        }
        const data: SlipRevision[] = await response.json()
        setRevisions(data)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          showToast('Unable to load history.')
        }
      } finally {
        setLoadingRevisions(false)
      }
    }
    void loadRevisions()
    return () => controller.abort()
  }, [activeTab])

  const getWeekKey = (date: Date) => {
    const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = temp.getUTCDay() || 7
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
  }

  const buildCustomerSummary = (period: 'weekly' | 'monthly' | 'yearly') => {
    const map = new Map<string, number>()
    slips.forEach((slip) => {
      const date = new Date(slip.slipDate)
      let key = ''
      if (period === 'yearly') {
        key = `${date.getFullYear()}`
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      } else {
        key = getWeekKey(date)
      }
      const composite = `${slip.customerName}||${key}`
      map.set(composite, (map.get(composite) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([composite, count]) => {
      const [customer, bucket] = composite.split('||')
      return { customer, bucket, count }
    })
  }

  const weeklySummary = buildCustomerSummary('weekly')
  const monthlySummary = buildCustomerSummary('monthly')
  const yearlySummary = buildCustomerSummary('yearly')

  return (
    <section className="page-card">
      <h1 className="section-title">Reports</h1>
      <p className="section-subtitle">
        Review recent slips, version history, and summary reports.
      </p>
      <div className="tabs">
        <button
          type="button"
          className={`tab-button${activeTab === 'recent' ? ' active' : ''}`}
          onClick={() => setActiveTab('recent')}
        >
          Recent Slips
        </button>
        <button
          type="button"
          className={`tab-button${activeTab === 'versions' ? ' active' : ''}`}
          onClick={() => setActiveTab('versions')}
        >
          Version History
        </button>
        <button
          type="button"
          className={`tab-button${activeTab === 'reports' ? ' active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
      </div>

      {activeTab === 'recent' ? (
        loading ? (
          <div className="skeleton-stack">
            <div className="skeleton-line lg" />
            <div className="skeleton-line md" />
            <div className="skeleton-line" />
            <div className="skeleton-line sm" />
          </div>
        ) : slips.length === 0 ? (
          <div className="empty-state">No packing slips yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Slip No</th>
                <th>Bill No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Lines</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {slips.map((slip) => {
                const dateLabel = new Date(slip.slipDate).toLocaleDateString(
                  'en-US',
                  { year: 'numeric', month: 'short', day: '2-digit' }
                )
                return (
                  <tr key={slip.id}>
                    <td>{slip.slipNo}</td>
                    <td>{slip.poNumber || '-'}</td>
                    <td>{dateLabel}</td>
                    <td>{slip.customerName}</td>
                    <td>{slip._count.lines}</td>
                    <td className="table-action-cell">
                      <div className="actions inline-actions">
                        <a
                          className="btn secondary"
                          href={`/print/packing-slip/${slip.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                        <Link
                          className="btn ghost"
                          href={`/packing-slip/${slip.id}/edit`}
                        >
                          Edit
                        </Link>
                        <a
                          className="btn ghost"
                          href={`/print/packing-slip/${slip.id}?autoprint=1`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Print
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      ) : activeTab === 'versions' ? (
        loadingRevisions ? (
          <div className="skeleton-stack">
            <div className="skeleton-line lg" />
            <div className="skeleton-line md" />
            <div className="skeleton-line" />
          </div>
        ) : revisions.length === 0 ? (
          <div className="empty-state">No version history yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Slip No</th>
                <th>Version</th>
                <th>Timestamp</th>
                <th>Customer</th>
                <th>Lines</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((revision) => {
                let snapshot: {
                  slipNo?: string
                  slipDate?: string
                  customerName?: string
                  shipTo?: string
                  poNumber?: string | null
                  trackingNumber?: string | null
                  lines?: Array<{ qty: number }>
                } = {}
                try {
                  snapshot = JSON.parse(revision.snapshot)
                } catch {
                  snapshot = {}
                }
                const dateLabel = new Date(revision.createdAt).toLocaleString(
                  'en-US',
                  {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )
                return (
                  <tr key={revision.id}>
                    <td>{snapshot.slipNo || `#${revision.slipId}`}</td>
                    <td>v{revision.version}</td>
                    <td>{dateLabel}</td>
                    <td>{snapshot.customerName || '-'}</td>
                    <td>{snapshot.lines?.length ?? 0}</td>
                    <td className="table-action-cell">
                      <div className="actions inline-actions">
                        <a
                          className="btn secondary"
                          href={`/print/packing-slip/${revision.slipId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                        <Link
                          className="btn ghost"
                          href={`/packing-slip/${revision.slipId}/edit`}
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      ) : loading ? (
        <div className="skeleton-stack">
          <div className="skeleton-line lg" />
          <div className="skeleton-line md" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ) : (
        <div className="report-layout">
          <aside className="report-tree">
            <div className="report-tree-title">Customers</div>
            <button
              type="button"
              className={`tree-item${activeReport === 'customers' ? ' active' : ''}`}
              onClick={() => setActiveReport('customers')}
            >
              Packing slips per customer
            </button>
            <div className="tree-subtitle">Shipping labels per customer</div>
            <div className="tree-muted">No shipping label data yet.</div>
          </aside>
          <div className="report-content">
            {activeReport === 'customers' ? (
              <>
                <div className="report-grid">
                  <div className="report-card">
                    <div className="report-title">Total Slips</div>
                    <div className="report-value">{slips.length}</div>
                  </div>
                  <div className="report-card">
                    <div className="report-title">Total Revisions</div>
                    <div className="report-value">{revisions.length}</div>
                  </div>
                  <div className="report-card">
                    <div className="report-title">Latest Slip</div>
                    <div className="report-value">
                      {slips[0]?.slipNo || '—'}
                    </div>
                  </div>
                </div>

                <div className="page-card report-section">
                  <h2 className="section-title">Monthly Summary</h2>
                  {monthlySummary.length === 0 ? (
                    <div className="empty-state">No slip data yet.</div>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Month</th>
                          <th>Slips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlySummary.map((row, index) => (
                          <tr key={`${row.customer}-${row.bucket}-${index}`}>
                            <td>{row.customer}</td>
                            <td>{row.bucket}</td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="page-card report-section">
                  <h2 className="section-title">Weekly Summary</h2>
                  {weeklySummary.length === 0 ? (
                    <div className="empty-state">No slip data yet.</div>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Week</th>
                          <th>Slips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklySummary.map((row, index) => (
                          <tr key={`${row.customer}-${row.bucket}-${index}`}>
                            <td>{row.customer}</td>
                            <td>{row.bucket}</td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="page-card report-section">
                  <h2 className="section-title">Yearly Summary</h2>
                  {yearlySummary.length === 0 ? (
                    <div className="empty-state">No slip data yet.</div>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Year</th>
                          <th>Slips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearlySummary.map((row, index) => (
                          <tr key={`${row.customer}-${row.bucket}-${index}`}>
                            <td>{row.customer}</td>
                            <td>{row.bucket}</td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
      {toast ? <div className="toast">{toast}</div> : null}
    </section>
  )
}
