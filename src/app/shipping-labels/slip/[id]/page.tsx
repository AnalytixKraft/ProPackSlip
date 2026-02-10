import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PrintMode from '@/components/print-mode'
import PrintButton from '@/components/print-button'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { id: string }
}

type BoxSummary = {
  boxNumber: string
  boxName: string | null
  items: Array<{ name: string; qty: number }>
}

export default async function SlipLabelsPage({ params }: PageProps) {
  const slipId = Number(params.id)
  if (!Number.isInteger(slipId)) {
    notFound()
  }

  const slip = await prisma.packingSlip.findUnique({
    where: { id: slipId },
    include: {
      lines: {
        include: { item: true },
      },
    },
  })

  if (!slip) {
    notFound()
  }

  const settings = await prisma.companySettings.findFirst()
  const boxMap = new Map<string, BoxSummary>()

  slip.lines.forEach((line) => {
    const boxNumber = line.boxNumber?.trim()
    if (!boxNumber) return
    const existing = boxMap.get(boxNumber)
    const entry: BoxSummary =
      existing ?? {
        boxNumber,
        boxName: line.boxName?.trim() || null,
        items: [],
      }
    entry.items.push({ name: line.item.name, qty: line.qty })
    if (!existing) {
      boxMap.set(boxNumber, entry)
    }
  })

  const boxes = Array.from(boxMap.values()).sort((a, b) =>
    a.boxNumber.localeCompare(b.boxNumber)
  )

  if (boxes.length === 0) {
    return (
      <>
        <PrintMode />
        <section className="page-card">
          <h1 className="section-title">Shipping Labels</h1>
          <p className="helper">No box numbers found for this slip.</p>
        </section>
      </>
    )
  }

  return (
    <>
      <PrintMode />
      <style>{`
        @media print {
          @page {
            size: 4in 6in;
            margin: 0;
          }
        }
      `}</style>
      <div className="label-sheet">
        <div className="label-toolbar no-print">
          <div>
            <strong>Labels for Slip {slip.slipNo}</strong>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <PrintButton label="Print Labels" />
          </div>
        </div>
        <div className="label-grid-sheet">
          {boxes.map((box, index) => (
            <div className="label-card sheet" key={box.boxNumber}>
              <div className="label-row">
                <div>
                  <div className="label-title">From</div>
                  <div className="label-text">
                    {settings?.companyName || 'Company'}
                  </div>
                  {settings?.address ? (
                    <div
                      className="label-text"
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {settings.address}
                    </div>
                  ) : null}
                  {settings?.phone ? (
                    <div className="label-text">Phone: {settings.phone}</div>
                  ) : null}
                </div>
                <div className="label-meta">
                  <div>
                    {index + 1} of {boxes.length}
                  </div>
                  <div>Slip: {slip.slipNo}</div>
                </div>
              </div>

              <div className="label-divider" />

              <div>
                <div className="label-title">To</div>
                <div className="label-text">{slip.customerName}</div>
                <div className="label-text" style={{ whiteSpace: 'pre-line' }}>
                  {slip.shipTo}
                </div>
              </div>

              <div className="label-divider" />

              <div className="label-row">
                <div>
                  <div className="label-title">Box</div>
                  <div className="label-text">{box.boxName || '-'}</div>
                  <div className="label-text">No: {box.boxNumber}</div>
                </div>
                <div className="label-meta">
                  <div className="label-title">Items</div>
                  {box.items.map((item, itemIndex) => (
                    <div className="label-text" key={`${box.boxNumber}-${itemIndex}`}>
                      {item.name} x {item.qty}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
