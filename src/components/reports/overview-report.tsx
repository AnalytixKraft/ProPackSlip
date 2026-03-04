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
import { ReportBucket, ReportsPayload } from '@/components/reports/report-types'
import {
  formatBucketLabel,
  formatNumber,
  formatPercent,
  toChartTooltipValue,
} from '@/components/reports/report-utils'
import { SectionCard } from '@/components/ui'

type OverviewReportProps = {
  data: ReportsPayload
  bucket: ReportBucket
}

export default function OverviewReport({ data, bucket }: OverviewReportProps) {
  const { kpis } = data.overview

  return (
    <div className="reports-content-stack">
      <div className="reports-kpi-grid">
        <div className="report-card report-kpi-card">
          <div className="report-title">Total Slips</div>
          <div className="report-value">{formatNumber(kpis.totalSlips)}</div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Total Lines</div>
          <div className="report-value">{formatNumber(kpis.totalLines)}</div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Avg Lines / Slip</div>
          <div className="report-value">{formatNumber(kpis.avgLinesPerSlip, 2)}</div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Unique Customers</div>
          <div className="report-value">{formatNumber(kpis.uniqueCustomers)}</div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Unique Vendors</div>
          <div className="report-value">{formatNumber(kpis.uniqueVendors)}</div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">With Tracking</div>
          <div className="report-value">{formatPercent(kpis.trackingPercent)}</div>
        </div>
      </div>

      <div className="reports-chart-grid">
        <SectionCard className="reports-chart-card">
          <h3 className="section-title">Slips Over Time</h3>
          {data.slipsTrend.points.length === 0 ? (
            <div className="empty-state">No slip data for this range.</div>
          ) : (
            <div className="reports-chart-area">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.slipsTrend.points}>
                  <defs>
                    <linearGradient id="reportsSlipsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.03} />
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
                    stroke="var(--accent)"
                    fill="url(#reportsSlipsFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard className="reports-chart-card">
          <h3 className="section-title">Qty Shipped Over Time</h3>
          {data.qtyTrend.points.length === 0 ? (
            <div className="empty-state">No quantity data for this range.</div>
          ) : (
            <div className="reports-chart-area">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.qtyTrend.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke)" />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(value) => formatBucketLabel(String(value), bucket)}
                    stroke="var(--muted)"
                  />
                  <YAxis stroke="var(--muted)" />
                  <Tooltip formatter={toChartTooltipValue} />
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

      <div className="reports-leaderboard-grid">
        <SectionCard className="reports-table-card">
          <h3 className="section-title">Top Customers</h3>
          {data.customersTop.customers.length === 0 ? (
            <div className="empty-state">No customer data for this range.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Slips</th>
                  <th>Total Qty</th>
                  <th>Lines</th>
                </tr>
              </thead>
              <tbody>
                {data.customersTop.customers.map((row) => (
                  <tr key={row.customerName}>
                    <td>{row.customerName}</td>
                    <td>{formatNumber(row.slipCount)}</td>
                    <td>{formatNumber(row.totalQty, 2)}</td>
                    <td>{formatNumber(row.lineCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard className="reports-table-card">
          <h3 className="section-title">Top Vendors</h3>
          {data.vendorsTop.vendors.length === 0 ? (
            <div className="empty-state">No vendor data for this range.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Slips</th>
                  <th>Total Qty</th>
                  <th>Lines</th>
                </tr>
              </thead>
              <tbody>
                {data.vendorsTop.vendors.map((row) => (
                  <tr key={`${row.vendorId ?? 'null'}-${row.vendorName}`}>
                    <td>{row.vendorName}</td>
                    <td>{formatNumber(row.slipCount)}</td>
                    <td>{formatNumber(row.totalQty, 2)}</td>
                    <td>{formatNumber(row.lineCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
