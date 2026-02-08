'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const STORAGE_KEY = 'packpro-auth'
const USER_KEY = 'packpro-user'
const SESSION_KEY = 'packpro-session-start'
const ACTIVITY_KEY = 'packpro-last-activity'
const TIMEOUT_KEY = 'packpro-timeout-min'
const BOOT_KEY = 'packpro-server-boot'
const MODE_KEY = 'packpro-mode'

export default function AuthStatus() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<string | null>(null)
  const [mode, setMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const authenticated = localStorage.getItem(STORAGE_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    const storedMode = localStorage.getItem(MODE_KEY)
    if (authenticated) {
      setUser(storedUser || 'User')
    } else {
      setUser(null)
    }
    if (storedMode === 'dark' || storedMode === 'light') {
      setMode(storedMode)
      document.body.dataset.mode = storedMode
    }
  }, [pathname])

  useEffect(() => {
    document.body.dataset.mode = mode
    localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(ACTIVITY_KEY)
    localStorage.removeItem(TIMEOUT_KEY)
    localStorage.removeItem(BOOT_KEY)
    router.replace('/login')
  }

  if (!user) return null

  return (
    <div className="auth-status">
      <div className="auth-row">
        <span>Welcome {user}</span>
        <button
          className="icon-button"
          type="button"
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {mode === 'dark' ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
            >
              <path d="M12 18.5a6.5 6.5 0 1 1 6.13-8.64 1 1 0 0 1-.23 1.03 4.5 4.5 0 0 0-5.26 5.26 1 1 0 0 1-1.03-.23A6.47 6.47 0 0 1 12 18.5z" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
            >
              <path d="M12 18.25a6.25 6.25 0 1 1 6.25-6.25A6.26 6.26 0 0 1 12 18.25zm0-11A4.75 4.75 0 1 0 16.75 12 4.75 4.75 0 0 0 12 7.25zM12 2.75a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75zm0 16.75a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75zm9.25-7.25a.75.75 0 0 1-.75.75h-1a.75.75 0 0 1 0-1.5h1a.75.75 0 0 1 .75.75zm-16.75 0a.75.75 0 0 1-.75.75h-1a.75.75 0 0 1 0-1.5h1a.75.75 0 0 1 .75.75zm13.36-5.61a.75.75 0 0 1 0 1.06l-.71.71a.75.75 0 1 1-1.06-1.06l.71-.71a.75.75 0 0 1 1.06 0zm-10.95 10.95a.75.75 0 0 1 0 1.06l-.71.71a.75.75 0 1 1-1.06-1.06l.71-.71a.75.75 0 0 1 1.06 0zm10.95 1.77a.75.75 0 0 1-1.06 0l-.71-.71a.75.75 0 1 1 1.06-1.06l.71.71a.75.75 0 0 1 0 1.06zm-10.95-10.95a.75.75 0 0 1-1.06 0l-.71-.71a.75.75 0 1 1 1.06-1.06l.71.71a.75.75 0 0 1 0 1.06z" />
            </svg>
          )}
        </button>
      </div>
      <button className="link-button" type="button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  )
}
