'use client'

import { useEffect } from 'react'

export default function PrintMode() {
  useEffect(() => {
    document.body.classList.add('print-mode')
    return () => {
      document.body.classList.remove('print-mode')
    }
  }, [])

  return null
}
