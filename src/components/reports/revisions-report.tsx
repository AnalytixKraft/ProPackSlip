import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ReportBucket, ReportsPayload } from '@/components/reports/report-types'
import {
  formatBucketLabel,
  formatDateTime,
  formatNumber,
  toChartTooltipValue,
} from '@/components/reports/report-utils'
import { SectionCard } from '@/components/ui'

type RevisionsReportProps = {
  data: ReportsPayload
  bucket: ReportBucket
}

export default function RevisionsReport({ data, bucket }: RevisionsReportProps) {
  const { kpis } = data.overview
  const mostEdited = data.revisionsTop.slips[0]

  return (
    <div className="reports-content-stack">
      <div className="reports-kpi-grid reports-kpi-grid--revisions">
        <div className="report-card report-kpi-card report-kpi-card--accent">
          <div className="report-title">Total Revisions</div>
          <div className="report-value">{formatNumber(kpis.totalRevisions)}</div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Avg Revisions / Slip</div>
          <div className="report-value">
            {formatNumber(kpis.avgRevisionsPerSlip, 2)}
          </div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Most Edited Slip</div>
          <div className="report-value">{mostEdited?.slipNo ?? '—'}</div>
        </div>
      </div>

      <SectionCard className="reports-chart-card">
        <h3 className="section-title">Revisions Over Time</h3>
        {data.revisionsTrend.points.length === 0 ? (
          <div className="empty-state">No revision activity for this range.</div>
        ) : (
          <div className="reports-chart-area">
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={data.revisionsTrend.points}>
                <defs>
                  <linearGradient id="reportsRevisionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fe8f2d" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#fe8f2d" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(value) => formatBucketLabel(String(value), bucket)}
                  stroke="var(--muted)"
                />
                <YAxis allowDecimals={false} stroke="var(--muted)" />
                <Tooltip formatter={toChartTooltipValue} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#fe8f2d"
                  fill="url(#reportsRevisionFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard className="reports-table-card">
        <h3 className="section-title">Most Edited Slips</h3>
        {data.revisionsTop.slips.length === 0 ? (
          <div className="empty-state">No revision records for this range.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Slip No</th>
                <th>Revisions</th>
                <th>Last Revision</th>
              </tr>
            </thead>
            <tbody>
              {data.revisionsTop.slips.map((row) => (
                <tr key={row.slipId}>
                  <td>{row.slipNo}</td>
                  <td>{formatNumber(row.revisionCount)}</td>
                  <td>{formatDateTime(row.lastRevisionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}
