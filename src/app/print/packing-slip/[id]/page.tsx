import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PrintMode from '@/components/print-mode'
import PrintAuto from '@/components/print-auto'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { id: string }
}

export default async function PrintPackingSlipPage({ params }: PageProps) {
  const slipId = Number(params.id)
  if (!Number.isInteger(slipId)) {
    notFound()
  }

  const slip = await prisma.packingSlip.findUnique({
    where: { id: slipId },
    include: {
      vendor: true,
      lines: {
        include: { item: true },
      },
    },
  })

  if (!slip) {
    notFound()
  }

  const settings = await prisma.companySettings.findFirst()
  const logoSrc = settings?.logoDataUrl || settings?.logoUrl || '/Logo.png'
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(slip.slipDate)
  const addressLines = settings?.address?.split('\n') ?? []

  return (
    <>
      <PrintMode />
      <PrintAuto />
      <div className="print-root sample-print">
      <div className="print-header-row">
        <div className="print-company">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="print-logo"
            src={logoSrc}
            alt={settings?.companyName || 'Company logo'}
          />
          <div>
            <div className="print-company-name">
              {settings?.companyName || 'PackPro Slip'}
            </div>
            {addressLines.length ? (
              <div className="print-company-detail">
                {addressLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            ) : null}
            {settings?.gstNumber ? (
              <div className="print-company-detail">
                GST: {settings.gstNumber}
              </div>
            ) : null}
            {settings?.phone ? (
              <div className="print-company-detail">
                Phone: {settings.phone}
              </div>
            ) : null}
            {settings?.email ? (
              <div className="print-company-detail">
                Email: {settings.email}
              </div>
            ) : null}
          </div>
        </div>
        <div className="print-slip-meta">
          <div className="print-title">PACKING SLIP</div>
          <div className="print-meta-row">
            <span>Date:</span>
            <span>{dateLabel}</span>
          </div>
          <div className="print-meta-row">
            <span>Bill No:</span>
            <span>{slip.poNumber || ''}</span>
          </div>
        </div>
      </div>

      <div className="print-info-row">
        <div className="print-info-block">
          <div className="print-info-label">SHIP TO:</div>
          <div className="print-info-text" style={{ whiteSpace: 'pre-line' }}>
            {slip.customerName}
            {'\n'}
            {slip.shipTo}
          </div>
        </div>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: '8%' }}>Sl No</th>
            <th>Item Name</th>
            <th style={{ width: '16%' }}>Box Name</th>
            <th style={{ width: '14%' }}>Box No</th>
            <th style={{ width: '10%' }}>UOM</th>
            <th style={{ width: '10%' }}>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {slip.lines.map((line, index) => {
            return (
              <tr key={line.id}>
                <td>{index + 1}</td>
                <td>{line.item.name}</td>
                <td>{line.boxName || '-'}</td>
                <td>{line.boxNumber || '-'}</td>
                <td>{line.item.unit}</td>
                <td>{line.qty}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="print-summary-row">
        <div>Total Items: {slip.lines.length}</div>
        <div></div>
      </div>

      <div className="print-footer no-print">
        <a className="btn" href={`/print/packing-slip/${slip.id}?autoprint=1`}>
          Print
        </a>
        <a
          className="btn secondary"
          href={`/shipping-labels/slip/${slip.id}`}
        >
          Generate Labels
        </a>
      </div>

      </div>
    </>
  )
}
