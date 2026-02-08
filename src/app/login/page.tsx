'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'packpro-auth'
const USER_KEY = 'packpro-user'
const SESSION_KEY = 'packpro-session-start'
const ACTIVITY_KEY = 'packpro-last-activity'
const TIMEOUT_KEY = 'packpro-timeout-min'
const BOOT_KEY = 'packpro-server-boot'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showToast('Enter username and password.')
      return
    }
    setWorking(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Login failed.')
      }
      localStorage.setItem(STORAGE_KEY, 'true')
      localStorage.setItem(USER_KEY, username.trim())
      localStorage.setItem(SESSION_KEY, Date.now().toString())
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString())
      try {
        const infoResponse = await fetch('/api/session-info')
        if (infoResponse.ok) {
          const data = await infoResponse.json()
          if (data.bootId) {
            localStorage.setItem(BOOT_KEY, String(data.bootId))
          }
          if (data.inactivityTimeoutMinutes) {
            localStorage.setItem(
              TIMEOUT_KEY,
              String(data.inactivityTimeoutMinutes)
            )
          }
        }
      } catch {
        // ignore session info failures
      }
      router.replace('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed.'
      showToast(message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="page-card login-card">
      <h1 className="section-title">Sign In</h1>
      <p className="section-subtitle">
        Use the admin credentials to access PackPro Slip.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleLogin()
        }}
      >
        <div className="form-grid full">
          <div>
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
            />
          </div>
          <div>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
            />
          </div>
        </div>
        <div className="actions">
          <button className="btn" type="submit" disabled={working}>
            {working ? 'Signing In...' : 'Sign In'}
          </button>
        </div>
      </form>
      {toast ? <div className="toast">{toast}</div> : null}
    </section>
  )
}
