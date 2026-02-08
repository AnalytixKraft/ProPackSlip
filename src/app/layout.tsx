import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Cormorant_Garamond, IBM_Plex_Sans } from 'next/font/google'
import { prisma } from '@/lib/prisma'
import AuthGuard from '@/components/auth-guard'
import AuthStatus from '@/components/auth-status'
import NavLinks from '@/components/nav-links'
import DesktopControls from '@/components/desktop-controls'

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
})

export const metadata: Metadata = {
  title: 'PackPro Slip',
  description: 'Create packing slips and generate PDFs fast.',
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await prisma.companySettings.findFirst()
  const companyName = settings?.companyName?.trim() || 'PackPro Slip'
  const companyMeta = settings?.gstNumber?.trim()
    ? `GST: ${settings.gstNumber}`
    : 'GST required'
  const logoSrc = settings?.logoDataUrl || settings?.logoUrl || null
  const theme = settings?.theme || 'sunset'

  return (
    <html lang="en">
      <body
        className={`${plex.variable} ${cormorant.variable}`}
        data-theme={theme}
      >
        <AuthGuard />
        <div className="app-shell">
          <header className="top-bar">
            <Link className="brand" href="/">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="brand-logo" src={logoSrc} alt={`${companyName} logo`} />
              ) : null}
              <span className="brand-copy">
                <span className="brand-title">{companyName}</span>
                <span className="brand-meta">{companyMeta}</span>
              </span>
            </Link>
            <div className="header-right">
              <NavLinks />
              <AuthStatus />
              <DesktopControls />
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
