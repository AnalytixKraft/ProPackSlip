'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/packing-slip/new', label: 'Create Packing Slip' },
  { href: '/vendors', label: 'Customers' },
  { href: '/items/new', label: 'Items' },
  { href: '/shipping-labels/new', label: 'Shipping Labels' },
  { href: '/history', label: 'Reports' },
  { href: '/admin', label: 'Settings' },
]

export default function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="nav">
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href === '/packing-slip/new' &&
            pathname.startsWith('/packing-slip/')) ||
          (link.href === '/shipping-labels/new' &&
            pathname.startsWith('/shipping-labels/'))
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? 'active' : undefined}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
