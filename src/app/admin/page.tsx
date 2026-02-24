'use client'

import { useEffect, useState } from 'react'
import {
  normalizeGstNumber,
  validateOptionalEmail,
  validateOptionalGstNumber,
  validateOptionalPhone,
} from '@/lib/validators'

type Settings = {
  companyName: string
  phone: string
  email: string
  gstNumber: string
  address: string
  slipNumberFormat: string
  theme: string
  inactivityTimeoutMinutes: string
  logoDataUrl: string
  loginUsername: string
  loginPassword: string
}

const emptySettings: Settings = {
  companyName: '',
  phone: '',
  email: '',
  gstNumber: '',
  address: '',
  slipNumberFormat: '',
  theme: 'sunset',
  inactivityTimeoutMinutes: '300',
  logoDataUrl: '',
  loginUsername: '',
  loginPassword: '',
}

export default function AdminPage() {
  const [form, setForm] = useState<Settings>(emptySettings)
  const [existingLogoUrl, setExistingLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    'company' | 'settings' | 'login' | 'cleanup'
  >('company')
  const [cleaning, setCleaning] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{
    action: 'slips' | 'labels' | 'items' | 'customers'
    label: string
  } | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch('/api/settings', {
          signal: controller.signal,
        })
        if (!response.ok) {
          return
        }
        const data = await response.json()
        if (data) {
          if (typeof document !== 'undefined') {
            document.body.dataset.theme = data.theme || 'sunset'
          }
          setForm({
            companyName: data.companyName || '',
            phone: data.phone || '',
            email: data.email || '',
            gstNumber: data.gstNumber || '',
            address: data.address || '',
            slipNumberFormat: data.slipNumberFormat || '',
            theme: data.theme || 'sunset',
            inactivityTimeoutMinutes: data.inactivityTimeoutMinutes
              ? String(Math.max(Number(data.inactivityTimeoutMinutes) || 300, 300))
              : '300',
            logoDataUrl: data.logoDataUrl || '',
            loginUsername: data.loginUsername || '',
            loginPassword: data.loginPassword || '',
          })
          setExistingLogoUrl(data.logoUrl || '')
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          showToast('Unable to load settings.')
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  const handleFileChange = (file: File | null) => {
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setForm((prev) => ({ ...prev, logoDataUrl: result }))
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.companyName.trim() || !form.address.trim() || !form.phone.trim()) {
      showToast('Company name, address, and phone number are required.')
      return
    }

    const normalizedGstNumber = normalizeGstNumber(form.gstNumber) ?? ''
    const normalizedEmail = form.email.trim().toLowerCase()
    const normalizedPhone = form.phone.trim()

    if (!normalizedGstNumber) {
      showToast('GST number is required.')
      return
    }

    const emailError = validateOptionalEmail(normalizedEmail || null)
    if (emailError) {
      showToast(emailError)
      return
    }

    const phoneError = validateOptionalPhone(normalizedPhone || null)
    if (phoneError) {
      showToast(phoneError)
      return
    }

    const gstError = validateOptionalGstNumber(normalizedGstNumber || null)
    if (gstError) {
      showToast(gstError)
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phone: normalizedPhone,
          email: normalizedEmail,
          gstNumber: normalizedGstNumber,
          inactivityTimeoutMinutes: form.inactivityTimeoutMinutes
            ? Number(form.inactivityTimeoutMinutes)
            : null,
          logoUrl: existingLogoUrl || null,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message =
          data && typeof data.error === 'string'
            ? data.error
            : `Unable to save settings (HTTP ${response.status}).`
        throw new Error(message)
      }
      if (typeof document !== 'undefined') {
        document.body.dataset.theme = form.theme || 'sunset'
      }
      showToast('Settings saved.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save settings.'
      showToast(message)
    } finally {
      setSaving(false)
    }
  }

  const handleCleanup = async (
    action: 'slips' | 'labels' | 'items' | 'customers',
    label: string
  ) => {
    setCleaning(action)
    try {
      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || `Unable to delete ${label}.`)
      }
      showToast(data.message || `${label} deleted.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Unable to delete ${label}.`
      showToast(message)
    } finally {
      setCleaning(null)
      setPendingAction(null)
    }
  }

  const logoPreview = form.logoDataUrl || existingLogoUrl

  return (
    <section className="page-card">
      <h1 className="section-title">Admin Settings</h1>
      <p className="section-subtitle">
        Manage company details, themes, and session settings.
      </p>
      <div className="tabs">
        <button
          type="button"
          className={`tab-button${activeTab === 'company' ? ' active' : ''}`}
          onClick={() => setActiveTab('company')}
        >
          Company Details
        </button>
        <button
          type="button"
          className={`tab-button${activeTab === 'settings' ? ' active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          type="button"
          className={`tab-button${activeTab === 'login' ? ' active' : ''}`}
          onClick={() => setActiveTab('login')}
        >
          Login
        </button>
        <button
          type="button"
          className={`tab-button${activeTab === 'cleanup' ? ' active' : ''}`}
          onClick={() => setActiveTab('cleanup')}
        >
          Cleanup
        </button>
      </div>

      {activeTab === 'company' ? (
        <>
          <div className="form-grid">
            <div>
              <label htmlFor="company-name">Company Name</label>
              <input
                id="company-name"
                value={form.companyName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, companyName: event.target.value }))
                }
                placeholder="PackPro Industries"
              />
            </div>
            <div>
              <label htmlFor="company-gst">GST Number *</label>
              <input
                id="company-gst"
                required
                value={form.gstNumber}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    gstNumber: normalizeGstNumber(event.target.value) ?? '',
                  }))
                }
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div>
              <label htmlFor="company-phone">Phone *</label>
              <input
                id="company-phone"
                type="tel"
                required
                value={form.phone}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="Contact numbers"
              />
            </div>
            <div>
              <label htmlFor="company-email">Email</label>
              <input
                id="company-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="contact@company.com"
              />
            </div>
            <div>
              <label htmlFor="company-address">Company Address</label>
              <input
                id="company-address"
                value={form.address}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, address: event.target.value }))
                }
                placeholder="Full address"
              />
            </div>
            <div>
              <label htmlFor="company-logo-file">Upload Logo</label>
              <input
                id="company-logo-file"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] ?? null)
                }
              />
            </div>
          </div>
          {logoPreview ? (
            <div style={{ marginTop: '18px' }}>
              <label>Logo Preview</label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview}
                alt="Logo preview"
                style={{
                  marginTop: '10px',
                  maxWidth: '220px',
                  maxHeight: '120px',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  border: '1px solid var(--stroke)',
                  padding: '10px',
                  background: '#fff',
                }}
              />
            </div>
          ) : null}
        </>
      ) : activeTab === 'settings' ? (
        <div className="form-grid">
          <div>
            <label htmlFor="slip-format">Slip Number Format</label>
            <input
              id="slip-format"
              value={form.slipNumberFormat}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  slipNumberFormat: event.target.value,
                }))
              }
              placeholder="PS-{SEQ}"
            />
            <p className="helper">
              Use {`{SEQ}`} or end with digits (e.g. `PP_25/26-01`) to auto-number.
            </p>
          </div>
          <div>
            <label htmlFor="theme-select">Theme</label>
            <select
              id="theme-select"
              value={form.theme}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  theme: event.target.value,
                }))
              }
            >
              <option value="sunset">Sunset</option>
              <option value="ocean">Ocean</option>
              <option value="forest">Forest</option>
              <option value="midnight">Midnight</option>
            </select>
            <p className="helper">Theme applies across the app.</p>
          </div>
          <div>
            <label htmlFor="inactivity-timeout">Inactivity Timeout (minutes)</label>
            <input
              id="inactivity-timeout"
              type="number"
              min="300"
              value={form.inactivityTimeoutMinutes}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  inactivityTimeoutMinutes: event.target.value,
                }))
              }
              placeholder="300"
            />
            <p className="helper">Auto logout after this many minutes (minimum 300).</p>
          </div>
        </div>
      ) : activeTab === 'login' ? (
        <div className="form-grid">
          <div>
            <label htmlFor="login-username">Login Username</label>
            <input
              id="login-username"
              value={form.loginUsername}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  loginUsername: event.target.value,
                }))
              }
              placeholder="Admin username"
            />
          </div>
          <div>
            <label htmlFor="login-password">Login Password</label>
            <input
              id="login-password"
              type="password"
              value={form.loginPassword}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  loginPassword: event.target.value,
                }))
              }
              placeholder="Admin password"
            />
          </div>
        </div>
      ) : (
        <div className="form-grid full">
          <div className="inline-alert">
            <span>Bulk delete data. This cannot be undone.</span>
          </div>
          <div className="actions">
            <button
              className="btn"
              type="button"
              disabled={cleaning === 'slips'}
              onClick={() => setPendingAction({ action: 'slips', label: 'slips' })}
            >
              {cleaning === 'slips' ? 'Deleting...' : 'Delete All Slips'}
            </button>
            <button
              className="btn"
              type="button"
              disabled={cleaning === 'labels'}
              onClick={() =>
                setPendingAction({ action: 'labels', label: 'labels' })
              }
            >
              {cleaning === 'labels' ? 'Deleting...' : 'Delete All Labels'}
            </button>
            <button
              className="btn"
              type="button"
              disabled={cleaning === 'items'}
              onClick={() => setPendingAction({ action: 'items', label: 'items' })}
            >
              {cleaning === 'items' ? 'Deleting...' : 'Delete All Items'}
            </button>
            <button
              className="btn"
              type="button"
              disabled={cleaning === 'customers'}
              onClick={() =>
                setPendingAction({ action: 'customers', label: 'customers' })
              }
            >
              {cleaning === 'customers'
                ? 'Deleting...'
                : 'Delete All Customers'}
            </button>
          </div>
          {pendingAction ? (
            <div className="inline-alert">
              <span>Are you sure you want to delete all {pendingAction.label}?</span>
              <div className="row-actions">
                <button
                  className="btn"
                  type="button"
                  disabled={cleaning === pendingAction.action}
                  onClick={() =>
                    void handleCleanup(pendingAction.action, pendingAction.label)
                  }
                >
                  {cleaning === pendingAction.action ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={cleaning === pendingAction.action}
                  onClick={() => setPendingAction(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
      {activeTab !== 'cleanup' ? (
        <div className="actions">
          <button
            className="btn"
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </section>
  )
}
