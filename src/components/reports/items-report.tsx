import {
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
  toChartTooltipValue,
} from '@/components/reports/report-utils'
import { SectionCard } from '@/components/ui'

type ItemsReportProps = {
  data: ReportsPayload
  bucket: ReportBucket
}

export default function ItemsReport({ data, bucket }: ItemsReportProps) {
  const customersByQty = [...data.customersTop.customers]
    .sort((left, right) => right.totalQty - left.totalQty)
    .slice(0, 10)

  return (
    <div className="reports-content-stack">
      <div className="reports-items-hero">
        <h3 className="section-title">Items Shipped</h3>
        <p className="section-subtitle">
          Track quantity movement, item mix, and customer demand.
        </p>
      </div>

      <div className="reports-kpi-grid reports-kpi-grid--items">
        <div className="report-card report-kpi-card report-kpi-card--accent">
          <div className="report-title">Total Qty Shipped</div>
          <div className="report-value">
            {formatNumber(data.itemsSummary.summary.totalQty, 2)}
          </div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Distinct Items</div>
          <div className="report-value">
            {formatNumber(data.itemsSummary.summary.distinctItems)}
          </div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Avg Qty / Slip</div>
          <div className="report-value">
            {formatNumber(data.itemsSummary.summary.avgQtyPerSlip, 2)}
          </div>
        </div>
        <div className="report-card report-kpi-card">
          <div className="report-title">Avg Qty / Line</div>
          <div className="report-value">
            {formatNumber(data.itemsSummary.summary.avgQtyPerLine, 2)}
          </div>
        </div>
      </div>

      <SectionCard className="reports-chart-card">
        <h3 className="section-title">Quantity Trend</h3>
        {data.qtyTrend.points.length === 0 ? (
          <div className="empty-state">No quantity data for this range.</div>
        ) : (
          <div className="reports-chart-area">
            <ResponsiveContainer width="100%" height={280}>
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
                  stroke="var(--accent)"
                  strokeWidth={2.4}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <div className="reports-leaderboard-grid">
        <SectionCard className="reports-table-card">
          <h3 className="section-title">Top Items by Qty</h3>
          {data.itemsTopQty.items.length === 0 ? (
            <div className="empty-state">No item quantity data for this range.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Lines</th>
                  <th>Slips</th>
                </tr>
              </thead>
              <tbody>
                {data.itemsTopQty.items.map((row) => (
                  <tr key={`qty-${row.itemId}`}>
                    <td>
                      {row.name}
                      {row.unit ? (
                        <span className="reports-muted-inline"> ({row.unit})</span>
                      ) : null}
                    </td>
                    <td>{row.sku || '-'}</td>
                    <td>{formatNumber(row.totalQty, 2)}</td>
                    <td>{formatNumber(row.lineCount)}</td>
                    <td>{formatNumber(row.slipCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard className="reports-table-card">
          <h3 className="section-title">Top Items by Frequency</h3>
          {data.itemsTopFreq.items.length === 0 ? (
            <div className="empty-state">No item frequency data for this range.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Lines</th>
                  <th>Qty</th>
                  <th>Slips</th>
                </tr>
              </thead>
              <tbody>
                {data.itemsTopFreq.items.map((row) => (
                  <tr key={`freq-${row.itemId}`}>
                    <td>
                      {row.name}
                      {row.unit ? (
                        <span className="reports-muted-inline"> ({row.unit})</span>
                      ) : null}
                    </td>
                    <td>{row.sku || '-'}</td>
                    <td>{formatNumber(row.lineCount)}</td>
                    <td>{formatNumber(row.totalQty, 2)}</td>
                    <td>{formatNumber(row.slipCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      <SectionCard className="reports-table-card">
        <h3 className="section-title">Top Customers by Qty</h3>
        {customersByQty.length === 0 ? (
          <div className="empty-state">No customer data for this range.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Total Qty</th>
                <th>Slips</th>
                <th>Lines</th>
              </tr>
            </thead>
            <tbody>
              {customersByQty.map((row) => (
                <tr key={`qty-customer-${row.customerName}`}>
                  <td>{row.customerName}</td>
                  <td>{formatNumber(row.totalQty, 2)}</td>
                  <td>{formatNumber(row.slipCount)}</td>
                  <td>{formatNumber(row.lineCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}
