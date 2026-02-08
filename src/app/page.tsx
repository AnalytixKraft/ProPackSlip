import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [settings, recentSlips] = await Promise.all([
    prisma.companySettings.findFirst(),
    prisma.packingSlip.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        vendor: true,
        _count: { select: { lines: true } },
      },
    }),
  ])

  const companyName = settings?.companyName || 'PackPro Slip'
  const logoSrc = settings?.logoDataUrl || settings?.logoUrl || '/Logo.png'

  return (
    <>
      <section className="page-card hero-card">
        <h1 className="section-title">Welcome back, {companyName}.</h1>
        <p className="section-subtitle">
          Company details for your slips and labels.
        </p>
        <div className="company-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="company-logo"
            src={logoSrc}
            alt={settings?.companyName || 'Company logo'}
          />
          <div>
            <div className="company-name">{companyName}</div>
            {settings?.address ? (
              <div className="company-detail" style={{ whiteSpace: 'pre-line' }}>
                {settings.address}
              </div>
            ) : (
              <div className="company-detail">Set your address in Admin.</div>
            )}
            {settings?.phone ? (
              <div className="company-detail">Phone: {settings.phone}</div>
            ) : null}
            {settings?.email ? (
              <div className="company-detail">Email: {settings.email}</div>
            ) : null}
            {settings?.gstNumber ? (
              <div className="company-detail">GST: {settings.gstNumber}</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="page-card">
        <h2 className="section-title">Latest Packing Slips</h2>
        <p className="section-subtitle">
          Quick access to the most recent slips.
        </p>
        {recentSlips.length === 0 ? (
          <p className="helper">No slips yet. Create your first one now.</p>
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
              {recentSlips.map((slip) => {
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
                    <td>
                      <div className="actions" style={{ marginTop: 0 }}>
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
        )}
      </section>
    </>
  )
}
