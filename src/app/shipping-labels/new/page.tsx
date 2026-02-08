'use client'

import { useEffect, useMemo, useState } from 'react'

type Settings = {
  companyName: string
  address: string
  phone: string
  email: string
}

const emptySettings: Settings = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
}

export default function ShippingLabelPage() {
  const [fromName, setFromName] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [fromPhone, setFromPhone] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [toName, setToName] = useState('')
  const [toAddress, setToAddress] = useState('')
  const [toPhone, setToPhone] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [boxName, setBoxName] = useState('')
  const [boxNumber, setBoxNumber] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [weight, setWeight] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => {
    const controller = new AbortController()
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings', {
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = (await response.json()) as Settings | null
        if (data) {
          setFromName(data.companyName || '')
          setFromAddress(data.address || '')
          setFromPhone(data.phone || '')
          setFromEmail(data.email || '')
        }
      } catch {
        // ignore
      }
    }
    void loadSettings()
    return () => controller.abort()
  }, [])

  const hasRecipient = useMemo(
    () => toName.trim() || toAddress.trim(),
    [toName, toAddress]
  )

  const handlePrint = () => {
    if (!hasRecipient) {
      showToast('Enter recipient name and address before printing.')
      return
    }
    window.print()
  }

  return (
    <section className="page-card label-page">
      <div className="label-header no-print">
        <div>
          <h1 className="section-title">Create Shipping Label</h1>
          <p className="section-subtitle">
            Fill the sender and recipient details, then print the label.
          </p>
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={handlePrint}>
            Print Label
          </button>
        </div>
      </div>

      <div className="label-grid">
        <div className="label-form no-print">
          <div className="form-grid">
            <div>
              <label htmlFor="from-name">From Name</label>
              <input
                id="from-name"
                value={fromName}
                onChange={(event) => setFromName(event.target.value)}
                placeholder="Company name"
              />
            </div>
            <div>
              <label htmlFor="from-phone">From Phone</label>
              <input
                id="from-phone"
                value={fromPhone}
                onChange={(event) => setFromPhone(event.target.value)}
                placeholder="Contact number"
              />
            </div>
            <div>
              <label htmlFor="from-email">From Email</label>
              <input
                id="from-email"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
                placeholder="Email"
              />
            </div>
            <div>
              <label htmlFor="to-name">To Name</label>
              <input
                id="to-name"
                value={toName}
                onChange={(event) => setToName(event.target.value)}
                placeholder="Recipient name"
              />
            </div>
            <div>
              <label htmlFor="to-phone">To Phone</label>
              <input
                id="to-phone"
                value={toPhone}
                onChange={(event) => setToPhone(event.target.value)}
                placeholder="Recipient phone"
              />
            </div>
            <div>
              <label htmlFor="to-email">To Email</label>
              <input
                id="to-email"
                value={toEmail}
                onChange={(event) => setToEmail(event.target.value)}
                placeholder="Recipient email"
              />
            </div>
          </div>

          <div className="form-grid full" style={{ marginTop: '18px' }}>
            <div>
              <label htmlFor="from-address">From Address</label>
              <textarea
                id="from-address"
                value={fromAddress}
                onChange={(event) => setFromAddress(event.target.value)}
                placeholder="Sender address"
              />
            </div>
            <div>
              <label htmlFor="to-address">To Address</label>
              <textarea
                id="to-address"
                value={toAddress}
                onChange={(event) => setToAddress(event.target.value)}
                placeholder="Recipient address"
              />
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: '18px' }}>
            <div>
              <label htmlFor="box-name">Box Name</label>
              <input
                id="box-name"
                value={boxName}
                onChange={(event) => setBoxName(event.target.value)}
                placeholder="e.g. Carton A"
              />
            </div>
            <div>
              <label htmlFor="box-number">Box Number</label>
              <input
                id="box-number"
                value={boxNumber}
                onChange={(event) => setBoxNumber(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="tracking">Tracking No</label>
              <input
                id="tracking"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="weight">Weight</label>
              <input
                id="weight"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="e.g. 5 kg"
              />
            </div>
            <div>
              <label htmlFor="dimensions">Dimensions</label>
              <input
                id="dimensions"
                value={dimensions}
                onChange={(event) => setDimensions(event.target.value)}
                placeholder="e.g. 20 x 30 x 15 cm"
              />
            </div>
            <div>
              <label htmlFor="notes">Notes</label>
              <input
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        <div className="label-preview">
          <div className="label-card">
            <div className="label-row">
              <div>
                <div className="label-title">From</div>
                <div className="label-text">{fromName || 'Sender Name'}</div>
                <div className="label-text" style={{ whiteSpace: 'pre-line' }}>
                  {fromAddress || 'Sender address'}
                </div>
                {fromPhone ? (
                  <div className="label-text">Phone: {fromPhone}</div>
                ) : null}
                {fromEmail ? (
                  <div className="label-text">Email: {fromEmail}</div>
                ) : null}
              </div>
              <div className="label-meta">
                {boxName ? <div>Box: {boxName}</div> : null}
                {boxNumber ? <div>No: {boxNumber}</div> : null}
                {trackingNumber ? <div>Tracking: {trackingNumber}</div> : null}
                {weight ? <div>Weight: {weight}</div> : null}
                {dimensions ? <div>Dims: {dimensions}</div> : null}
              </div>
            </div>

            <div className="label-divider" />

            <div>
              <div className="label-title">To</div>
              <div className="label-text">{toName || 'Recipient Name'}</div>
              <div className="label-text" style={{ whiteSpace: 'pre-line' }}>
                {toAddress || 'Recipient address'}
              </div>
              {toPhone ? <div className="label-text">Phone: {toPhone}</div> : null}
              {toEmail ? <div className="label-text">Email: {toEmail}</div> : null}
              {notes ? <div className="label-note">Note: {notes}</div> : null}
            </div>
          </div>
        </div>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </section>
  )
}
