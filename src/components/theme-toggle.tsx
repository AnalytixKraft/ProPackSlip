'use client'

import { useEffect, useState } from 'react'

const MODE_KEY = 'packpro-mode'

export default function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const stored = localStorage.getItem(MODE_KEY)
    if (stored === 'dark' || stored === 'light') {
      setMode(stored)
    }
  }, [])

  useEffect(() => {
    document.body.dataset.mode = mode
    localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  return (
    <button
      className="btn ghost"
      type="button"
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
    >
      {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
    </button>
  )
}
