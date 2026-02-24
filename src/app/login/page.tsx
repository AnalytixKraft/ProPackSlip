'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  HelperText,
  Input,
  Label,
} from '@/components/ui'
import styles from '@/app/login/login.module.css'

const STORAGE_KEY = 'packpro-auth'
const USER_KEY = 'packpro-user'
const SESSION_KEY = 'packpro-session-start'
const ACTIVITY_KEY = 'packpro-last-activity'
const TIMEOUT_KEY = 'packpro-timeout-min'
const BOOT_KEY = 'packpro-server-boot'
const MODE_KEY = 'packpro-mode'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formAlert, setFormAlert] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.add('login-route')
    const mode = localStorage.getItem(MODE_KEY)
    if (mode === 'dark' || mode === 'light') {
      document.body.dataset.mode = mode
    }
    return () => {
      document.body.classList.remove('login-route')
    }
  }, [])

  const buildInfo = useMemo(() => {
    const value = process.env.NEXT_PUBLIC_APP_VERSION
    return value ? `v${value}` : null
  }, [])

  const handleLogin = async () => {
    setUsernameError(null)
    setPasswordError(null)
    setFormAlert(null)

    if (!username.trim() || !password.trim()) {
      if (!username.trim()) {
        setUsernameError('Username is required.')
      }
      if (!password.trim()) {
        setPasswordError('Password is required.')
      }
      setFormAlert('Enter username and password.')
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
      setFormAlert(message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className={styles.loginScreen}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={`page-card login-card ${styles.heroCard}`}>
        <header className={styles.brandBlock}>
          <div className={styles.logoWrap} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.logo} src="/Logo.png" alt="" />
          </div>
          <div>
            <h1 className={styles.title}>Pro Pack Slip</h1>
            <p className={styles.subtitle}>Generate packing slips and shipping labels.</p>
          </div>
        </header>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            void handleLogin()
          }}
          noValidate
        >
          {formAlert ? <Alert variant="danger">{formAlert}</Alert> : null}
          <div className={styles.field}>
            <Label htmlFor="login-username">Username</Label>
            <Input
              id="login-username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                if (usernameError) setUsernameError(null)
                if (formAlert) setFormAlert(null)
              }}
              placeholder="Enter username"
              autoComplete="username"
              aria-invalid={usernameError ? 'true' : 'false'}
              aria-describedby={usernameError ? 'login-username-error' : undefined}
            />
            {usernameError ? (
              <HelperText id="login-username-error" tone="danger">
                {usernameError}
              </HelperText>
            ) : null}
          </div>

          <div className={styles.field}>
            <Label htmlFor="login-password">Password</Label>
            <div className={styles.passwordWrap}>
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (passwordError) setPasswordError(null)
                  if (formAlert) setFormAlert(null)
                }}
                placeholder="Enter password"
                autoComplete="current-password"
                className={styles.passwordInput}
                aria-invalid={passwordError ? 'true' : 'false'}
                aria-describedby={passwordError ? 'login-password-error' : undefined}
              />
              <button
                className={styles.toggle}
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordError ? (
              <HelperText id="login-password-error" tone="danger">
                {passwordError}
              </HelperText>
            ) : null}
          </div>

          <Button className={styles.submit} type="submit" disabled={working}>
            <span className={styles.submitInner}>
              {working ? <span className={styles.spinner} aria-hidden="true" /> : null}
              {working ? 'Signing In...' : 'Sign In'}
            </span>
          </Button>
          <p className={styles.assistive}>
            Use your admin credentials to access the workspace.
          </p>
        </form>
        <footer className={styles.watermark}>
          <span className={styles.watermarkBrand}>AnalytixKraft</span>
          {buildInfo ? <span className={styles.watermarkVersion}>{buildInfo}</span> : null}
        </footer>
      </div>
    </section>
  )
}
