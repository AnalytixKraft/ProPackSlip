'use client'

import { useEffect, useState } from 'react'

export default function DesktopControls() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    setIsDesktop(Boolean(window.packpro?.isDesktop))
  }, [])

  if (!isDesktop) return null

  const handleQuit = () => {
    if (window.confirm('Quit PackPro Slip?')) {
      window.packpro?.quit?.()
    }
  }

  return (
    <button type="button" className="link-button" onClick={handleQuit}>
      Quit App
    </button>
  )
}
