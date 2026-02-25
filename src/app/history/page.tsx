'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ReportsDashboard from '@/components/reports/reports-dashboard'

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
    if (activeTab !== 'versions') return
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
                <th className="table-action-header">Actions</th>
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
                    <td className="table-action-cell table-action-cell--recent">
                      <div className="table-action-group">
                        <a
                          className="btn secondary table-action-btn"
                          href={`/print/packing-slip/${slip.id}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`View slip ${slip.slipNo}`}
                        >
                          View
                        </a>
                        <Link
                          className="btn ghost table-action-btn"
                          href={`/packing-slip/${slip.id}/edit`}
                          aria-label={`Edit slip ${slip.slipNo}`}
                        >
                          Edit
                        </Link>
                        <a
                          className="btn table-action-btn"
                          href={`/print/packing-slip/${slip.id}?autoprint=1`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Print slip ${slip.slipNo}`}
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
                  customerName?: string
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
      ) : (
        <ReportsDashboard onError={showToast} />
      )}
      {toast ? <div className="toast">{toast}</div> : null}
    </section>
  )
}
