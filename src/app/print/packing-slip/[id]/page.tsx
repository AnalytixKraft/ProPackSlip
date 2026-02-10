import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PrintMode from '@/components/print-mode'
import PrintAuto from '@/components/print-auto'
import PrintButton from '@/components/print-button'

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
  const logoSrc = settings?.logoDataUrl || settings?.logoUrl
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(slip.slipDate)
  const generatedOnLabel = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
  const addressLines =
    settings?.address
      ?.split('\n')
      .map((line) => line.trim())
      .filter(Boolean) ?? []
  const companyName = settings?.companyName || 'PackPro Slip'
  const companyGst = settings?.gstNumber?.trim() || '-'
  const companyPhone = settings?.phone?.trim() || '-'
  const shipToText = `${slip.customerName}\n${slip.shipTo}`
  const billNumber = slip.poNumber || '-'

  return (
    <>
      <PrintMode />
      <PrintAuto />
      <div className="print-root sample-print">
        <div className="print-actions no-print">
          <PrintButton label="Print" />
          <a className="btn secondary" href={`/api/packing-slips/${slip.id}/pdf`}>
            Save PDF
          </a>
          <a
            className="btn secondary"
            href={`/shipping-labels/slip/${slip.id}`}
          >
            Generate Labels
          </a>
        </div>

        <div className="print-header-row">
          <div className="print-company">
            <div className="print-logo-slot">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="print-logo" src={logoSrc} alt={`${companyName} logo`} />
              ) : (
                <div className="print-logo-placeholder">LOGO</div>
              )}
            </div>
            <div className="print-company-copy">
              <div className="print-company-name">{companyName}</div>
              <div className="print-company-detail">
                <div>
                  <span className="print-company-field">GST:</span> {companyGst}
                </div>
                {addressLines.length ? (
                  addressLines.map((line) => <div key={line}>{line}</div>)
                ) : (
                  <div>-</div>
                )}
                <div>
                  <span className="print-company-field">☎</span>{' '}
                  {companyPhone}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="print-title-wrap">
          <div className="print-title">PACKING SLIP</div>
          <div className="print-title-divider" />
        </div>

        <div className="print-meta-grid">
          <div className="print-meta-inline">
            <span className="print-meta-label">Date:</span>
            <span className="print-meta-value">{dateLabel}</span>
          </div>
          <div className="print-meta-inline align-right">
            <span className="print-meta-label">Bill No:</span>
            <span className="print-meta-value">{billNumber}</span>
          </div>
        </div>

        <div className="print-info-row">
          <div className="print-info-block">
            <div className="print-info-label">SHIP TO</div>
            <div className="print-info-box">
              <div className="print-info-text" style={{ whiteSpace: 'pre-line' }}>
                {shipToText}
              </div>
            </div>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '8%' }} className="align-right">Sl No</th>
              <th>Item Name</th>
              <th style={{ width: '16%' }}>Box Name</th>
              <th style={{ width: '14%' }} className="align-right">Box No</th>
              <th style={{ width: '10%' }} className="align-center">UOM</th>
              <th style={{ width: '10%' }} className="align-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {slip.lines.map((line, index) => {
              return (
                <tr key={line.id}>
                  <td className="align-right">{index + 1}</td>
                  <td>{line.item.name}</td>
                  <td>{line.boxName || '-'}</td>
                  <td className="align-right">{line.boxNumber || '-'}</td>
                  <td className="align-center">{line.item.unit}</td>
                  <td className="align-right">{line.qty}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="print-summary-row">
          <div>Total Items: {slip.lines.length}</div>
          <div></div>
        </div>

        <div className="print-footer">
          <div className="print-footer-right">
            <div>Generated on {generatedOnLabel}</div>
            <div>PackPro Slip</div>
          </div>
        </div>

      </div>
    </>
  )
}
