'use client'

import { useEffect, useState } from 'react'
import {
  normalizeGstNumber,
  validateOptionalEmail,
  validateOptionalGstNumber,
  validateOptionalPhone,
} from '@/lib/validators'

type Vendor = {
  id: number
  name: string
  gstNumber: string | null
  address: string
  contactName: string | null
  contactPhone: string | null
  email: string | null
  isActive: boolean
}

const emptyForm = {
  name: '',
  gstNumber: '',
  address: '',
  email: '',
  contactName: '',
  contactPhone: '',
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [query, setQuery] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch(
          `/api/vendors?query=${encodeURIComponent(query)}&includeInactive=1`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          throw new Error('Unable to load customers.')
        }
        const data: Vendor[] = await response.json()
        setVendors(data)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          showToast('Unable to load customers.')
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [query])

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      showToast('Customer name and address are required.')
      return
    }

    const normalizedForm = {
      ...form,
      gstNumber: normalizeGstNumber(form.gstNumber) ?? '',
      email: form.email.trim().toLowerCase(),
      contactPhone: form.contactPhone.trim(),
    }

    const emailError = validateOptionalEmail(normalizedForm.email || null)
    if (emailError) {
      showToast(emailError)
      return
    }

    const phoneError = validateOptionalPhone(normalizedForm.contactPhone || null)
    if (phoneError) {
      showToast(phoneError)
      return
    }

    const gstError = validateOptionalGstNumber(normalizedForm.gstNumber || null)
    if (gstError) {
      showToast(gstError)
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedForm),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to save customer.')
      }
      const saved: Vendor = await response.json()
      setVendors((prev) => [saved, ...prev])
      setForm({ ...emptyForm })
      showToast('Customer saved.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save customer.'
      showToast(message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (vendor: Vendor) => {
    try {
      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !vendor.isActive }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to update customer.')
      }
      const updated = await response.json()
      setVendors((prev) =>
        prev.map((row) => (row.id === vendor.id ? updated : row))
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update customer.'
      showToast(message)
    }
  }

  const deleteVendor = async (vendor: Vendor) => {
    const confirmed = window.confirm(`Delete ${vendor.name}?`)
    if (!confirmed) return
    try {
      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to delete customer.')
      }
      setVendors((prev) => prev.filter((row) => row.id !== vendor.id))
      showToast('Customer deleted.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete customer.'
      showToast(message)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      showToast('Select a CSV or Excel file to import.')
      return
    }

    setImporting(true)
    try {
      const payload = new FormData()
      payload.append('file', importFile)

      const response = await fetch('/api/vendors/import', {
        method: 'POST',
        body: payload,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Unable to import customers.')
      }

      const reloadResponse = await fetch(
        `/api/vendors?query=${encodeURIComponent(query)}&includeInactive=1`
      )
      if (reloadResponse.ok) {
        const rows: Vendor[] = await reloadResponse.json()
        setVendors(rows)
      }

      const summary = `Imported customers: ${data.created ?? 0} created, ${data.updated ?? 0} updated, ${data.skipped ?? 0} skipped, ${data.failed ?? 0} failed.`
      showToast(summary)
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0]
        if (first && typeof first.message === 'string') {
          showToast(`Row ${first.row}: ${first.message}`)
        }
      }
      setImportFile(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import customers.'
      showToast(message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <section className="page-card">
        <h1 className="section-title">Customers</h1>
        <p className="section-subtitle">
          Store customer details once and reuse them on packing slips.
        </p>
        <div className="form-grid">
          <div>
            <label htmlFor="vendor-name">Customer Name</label>
            <input
              id="vendor-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Metro Wholesale"
            />
          </div>
          <div>
            <label htmlFor="vendor-gst">GST No</label>
            <input
              id="vendor-gst"
              value={form.gstNumber}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  gstNumber: normalizeGstNumber(event.target.value) ?? '',
                }))
              }
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="vendor-address">Address</label>
            <input
              id="vendor-address"
              value={form.address}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, address: event.target.value }))
              }
              placeholder="Address lines"
            />
          </div>
          <div>
            <label htmlFor="vendor-email">Email</label>
            <input
              id="vendor-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="vendor-contact">Contact Name</label>
            <input
              id="vendor-contact"
              value={form.contactName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contactName: event.target.value }))
              }
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="vendor-phone">Contact Phone</label>
            <input
              id="vendor-phone"
              type="tel"
              value={form.contactPhone}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  contactPhone: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="actions">
          <button
            className="btn"
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? 'Saving...' : 'Save Customer'}
          </button>
        </div>
      </section>

      <section className="page-card">
        <h2 className="section-title">Customer List</h2>
        <p className="section-subtitle">
          Search by name or GST to quickly pick the right customer.
        </p>
        <div className="table-toolbar">
          <div>
            <label htmlFor="vendor-search">Search</label>
            <input
              id="vendor-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customers"
            />
          </div>
          <div>
            <label htmlFor="vendor-import-file">Bulk Upload (CSV/XLSX)</label>
            <input
              id="vendor-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) =>
                setImportFile(event.target.files?.[0] ?? null)
              }
            />
            <p className="helper">
              Columns: <code>name</code> and <code>address</code> required; optional <code>gst</code>, <code>email</code>, <code>contactName</code>, <code>phone</code>.
            </p>
          </div>
          <div className="toolbar-actions">
            <button
              className="btn secondary"
              type="button"
              disabled={importing}
              onClick={() => void handleImport()}
            >
              {importing ? 'Importing...' : 'Import Customers'}
            </button>
          </div>
        </div>
        {vendors.length === 0 ? (
          <div className="empty-state">No customers found.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>GST</th>
                <th>Address</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td>{vendor.name}</td>
                  <td>{vendor.gstNumber || '-'}</td>
                  <td>{vendor.address}</td>
                  <td>
                    {vendor.contactName
                      ? `${vendor.contactName}${
                          vendor.contactPhone ? ` (${vendor.contactPhone})` : ''
                        }`
                      : vendor.contactPhone || '-'}
                  </td>
                  <td>{vendor.email || '-'}</td>
                  <td>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => void toggleActive(vendor)}
                    >
                      {vendor.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => void deleteVendor(vendor)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  )
}
