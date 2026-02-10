'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PrintAuto() {
  const searchParams = useSearchParams()
  const didPrintRef = useRef(false)

  const triggerPrint = () => {
    const desktopPrint = window.packpro?.print
    if (typeof desktopPrint === 'function') {
      void desktopPrint().catch(() => {
        window.print()
      })
      return
    }
    window.print()
  }

  useEffect(() => {
    if (didPrintRef.current) return
    if (searchParams.get('autoprint') !== '1') return

    const currentUrl = new URL(window.location.href)
    if (currentUrl.searchParams.has('autoprint')) {
      currentUrl.searchParams.delete('autoprint')
      const cleanSearch = currentUrl.searchParams.toString()
      const cleanUrl = `${currentUrl.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${currentUrl.hash}`
      window.history.replaceState(window.history.state, '', cleanUrl)
    }

    didPrintRef.current = true
    const timer = window.setTimeout(() => {
      triggerPrint()
    }, 150)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchParams])

  return null
}
