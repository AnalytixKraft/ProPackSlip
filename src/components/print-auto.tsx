'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PrintAuto() {
  const searchParams = useSearchParams()
  const didPrintRef = useRef(false)

  useEffect(() => {
    if (didPrintRef.current) return
    if (searchParams.get('autoprint') !== '1') return

    didPrintRef.current = true
    const timer = window.setTimeout(() => {
      window.print()
    }, 150)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchParams])

  return null
}
