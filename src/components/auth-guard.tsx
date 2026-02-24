'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const STORAGE_KEY = 'packpro-auth'
const USER_KEY = 'packpro-user'
const SESSION_KEY = 'packpro-session-start'
const ACTIVITY_KEY = 'packpro-last-activity'
const TIMEOUT_KEY = 'packpro-timeout-min'
const BOOT_KEY = 'packpro-server-boot'

const publicPaths = new Set<string>(['/login'])
const publicPrefixes = ['/print/', '/shipping-labels/slip/']

export default function AuthGuard() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (
      !pathname ||
      publicPaths.has(pathname) ||
      publicPrefixes.some((prefix) => pathname.startsWith(prefix))
    ) {
      return
    }
    let interval: ReturnType<typeof setInterval> | null = null
    let mounted = true

    const clearSession = () => {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(ACTIVITY_KEY)
      localStorage.removeItem(TIMEOUT_KEY)
      localStorage.removeItem(BOOT_KEY)
    }

    const checkSession = () => {
      const authenticated = localStorage.getItem(STORAGE_KEY)
      if (!authenticated) {
        router.replace('/login')
        return
      }
      const sessionStart = Number(localStorage.getItem(SESSION_KEY))
      if (!sessionStart) {
        clearSession()
        router.replace('/login')
        return
      }
      const timeoutMinutes = Number(localStorage.getItem(TIMEOUT_KEY)) || 300
      const lastActivity =
        Number(localStorage.getItem(ACTIVITY_KEY)) || sessionStart
      const now = Date.now()
      if (now - lastActivity > timeoutMinutes * 60_000) {
        clearSession()
        router.replace('/login')
        return
      }
    }

    const touchActivity = () => {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString())
    }

    const init = async () => {
      const authenticated = localStorage.getItem(STORAGE_KEY)
      if (!authenticated) {
        router.replace('/login')
        return
      }
      try {
        const response = await fetch('/api/session-info')
        if (response.ok) {
          const data = await response.json()
          const bootId = String(data.bootId || '')
          const storedBoot = localStorage.getItem(BOOT_KEY)
          if (storedBoot && storedBoot !== bootId) {
            clearSession()
            router.replace('/login')
            return
          }
          if (bootId) {
            localStorage.setItem(BOOT_KEY, bootId)
          }
          if (data.inactivityTimeoutMinutes) {
            localStorage.setItem(
              TIMEOUT_KEY,
              String(data.inactivityTimeoutMinutes)
            )
          }
        }
      } catch {
        // keep existing timeout/boot info
      }
      if (!mounted) return
      checkSession()
      interval = setInterval(checkSession, 60_000)
      window.addEventListener('mousemove', touchActivity)
      window.addEventListener('keydown', touchActivity)
      window.addEventListener('click', touchActivity)
      window.addEventListener('scroll', touchActivity)
      window.addEventListener('touchstart', touchActivity)
    }

    void init()

    return () => {
      mounted = false
      if (interval) {
        clearInterval(interval)
      }
      window.removeEventListener('mousemove', touchActivity)
      window.removeEventListener('keydown', touchActivity)
      window.removeEventListener('click', touchActivity)
      window.removeEventListener('scroll', touchActivity)
      window.removeEventListener('touchstart', touchActivity)
    }
  }, [pathname, router])

  return null
}
