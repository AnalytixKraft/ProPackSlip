import { Button, FieldGroup, Input, Label, SectionCard, Select } from '@/components/ui'
import {
  ReportBucket,
  ReportFilters,
  VendorOption,
} from '@/components/reports/report-types'

type ReportFilterBarProps = {
  filters: ReportFilters
  vendors: VendorOption[]
  isRefreshing: boolean
  onUpdate: (next: Partial<ReportFilters>) => void
  onReset: () => void
}

export default function ReportFilterBar({
  filters,
  vendors,
  isRefreshing,
  onUpdate,
  onReset,
}: ReportFilterBarProps) {
  return (
    <SectionCard className="reports-filters-card">
      <div className="page-header">
        <div>
          <h2 className="section-title">Reporting Dashboard</h2>
          <p className="section-subtitle">
            Filter and compare slips, items shipped, and revision activity.
          </p>
        </div>
        <div className="page-header-actions">
          {isRefreshing ? <span className="pill">Refreshing...</span> : null}
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>

      <div className="reports-filters-grid">
        <FieldGroup>
          <Label htmlFor="report-filter-from">From</Label>
          <Input
            id="report-filter-from"
            type="date"
            value={filters.from}
            onChange={(event) => onUpdate({ from: event.target.value })}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="report-filter-to">To</Label>
          <Input
            id="report-filter-to"
            type="date"
            value={filters.to}
            onChange={(event) => onUpdate({ to: event.target.value })}
          />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="report-filter-bucket">Grouping</Label>
          <Select
            id="report-filter-bucket"
            value={filters.bucket}
            onChange={(event) =>
              onUpdate({ bucket: event.target.value as ReportBucket })
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="report-filter-vendor">Vendor</Label>
          <Select
            id="report-filter-vendor"
            value={filters.vendorId}
            onChange={(event) => onUpdate({ vendorId: event.target.value })}
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
          <Label htmlFor="report-filter-customer">Customer Search</Label>
          <Input
            id="report-filter-customer"
            type="search"
            value={filters.customer}
            placeholder="Type customer name..."
            onChange={(event) => onUpdate({ customer: event.target.value })}
          />
        </FieldGroup>
      </div>
    </SectionCard>
  )
}
