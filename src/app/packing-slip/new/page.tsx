'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ItemOption = {
  id: number
  name: string
  unit: string
}

type VendorOption = {
  id: number
  name: string
  address: string
  gstNumber: string | null
  email: string | null
  contactName: string | null
  contactPhone: string | null
}

type SlipLine = {
  key: string
  itemId: number | null
  qty: string
  boxName: string
  boxNumber: string
}

type SlipSearchResult = {
  id: number
  slipNo: string
  poNumber: string | null
  customerName: string
  slipDate: string
  _count: { lines: number }
}

type QuickItemForm = {
  name: string
  unit: string
  notes: string
}

const createLine = (): SlipLine => ({
  key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  itemId: null,
  qty: '',
  boxName: '',
  boxNumber: '',
})

const emptyQuickItem: QuickItemForm = {
  name: '',
  unit: 'pcs',
  notes: '',
}

export default function NewPackingSlipPage() {
  const [slipDate, setSlipDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [nextSlipNo, setNextSlipNo] = useState('PS-000001')
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [vendorCache, setVendorCache] = useState<Record<number, VendorOption>>(
    {}
  )
  const [customerName, setCustomerName] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [activeTab, setActiveTab] = useState<'create' | 'search'>('create')
  const [searchBillNo, setSearchBillNo] = useState('')
  const [searchResults, setSearchResults] = useState<SlipSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchAttempted, setSearchAttempted] = useState(false)
  const [items, setItems] = useState<ItemOption[]>([])
  const [itemCache, setItemCache] = useState<Record<number, ItemOption>>({})
  const [quickItemForm, setQuickItemForm] = useState<QuickItemForm>(emptyQuickItem)
  const [showQuickItem, setShowQuickItem] = useState(false)
  const [creatingItem, setCreatingItem] = useState(false)
  const [quickItemLineKey, setQuickItemLineKey] = useState<string | null>(null)
  const [lines, setLines] = useState<SlipLine[]>([createLine()])
  const [working, setWorking] = useState(false)
  const [savedSlipId, setSavedSlipId] = useState<number | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [duplicateSlipId, setDuplicateSlipId] = useState<number | null>(null)
  const [duplicateSlipNo, setDuplicateSlipNo] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const router = useRouter()

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const isDirty =
    customerName.trim() ||
    shipTo.trim() ||
    poNumber.trim() ||
    vendorId !== null ||
    lines.some(
      (line) =>
        line.itemId ||
        line.qty.trim() ||
        line.boxName.trim() ||
        line.boxNumber.trim()
    )

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    if (!savedSlipId || !savedSnapshot) return
    const currentSnapshot = JSON.stringify({
      customerName,
      shipTo,
      poNumber,
      vendorId,
      slipDate,
      lines: lines.map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        boxName: line.boxName,
        boxNumber: line.boxNumber,
      })),
    })
    if (currentSnapshot !== savedSnapshot) {
      setSavedSlipId(null)
      setSavedSnapshot(null)
    }
  }, [customerName, shipTo, poNumber, vendorId, slipDate, lines, savedSlipId, savedSnapshot])

  useEffect(() => {
    if (!duplicateSlipId) return
    setDuplicateSlipId(null)
    setDuplicateSlipNo(null)
  }, [customerName, shipTo, poNumber, vendorId, slipDate, lines, duplicateSlipId])

  useEffect(() => {
    const controller = new AbortController()
    const loadVendors = async () => {
      try {
        const response = await fetch('/api/vendors', { signal: controller.signal })
        if (!response.ok) return
        const data: VendorOption[] = await response.json()
        setVendors(data)
        setVendorCache((prev) => {
          const next = { ...prev }
          data.forEach((vendor) => {
            next[vendor.id] = vendor
          })
          return next
        })
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          showToast('Unable to load customers.')
        }
      }
    }
    const loadItems = async () => {
      try {
        const response = await fetch('/api/items', { signal: controller.signal })
        if (!response.ok) return
        const data: ItemOption[] = await response.json()
        setItems(data)
        setItemCache((prev) => {
          const next = { ...prev }
          data.forEach((item) => {
            next[item.id] = item
          })
          return next
        })
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          showToast('Unable to load items.')
        }
      }
    }
    const loadNextSlip = async () => {
      try {
        const response = await fetch('/api/packing-slips/next-number', {
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = await response.json()
        if (data?.nextSlipNo) {
          setNextSlipNo(String(data.nextSlipNo))
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          // keep fallback value
        }
      }
    }
    void loadVendors()
    void loadItems()
    void loadNextSlip()
    return () => controller.abort()
  }, [])

  const selectOptions = useMemo(() => {
    const map = new Map<number, ItemOption>()
    items.forEach((item) => map.set(item.id, item))
    Object.values(itemCache).forEach((item) => map.set(item.id, item))
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [items, itemCache])

  const vendorOptions = useMemo(() => {
    const map = new Map<number, VendorOption>()
    vendors.forEach((vendor) => map.set(vendor.id, vendor))
    if (vendorId && vendorCache[vendorId]) {
      map.set(vendorId, vendorCache[vendorId])
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [vendors, vendorCache, vendorId])

  const updateLine = (key: string, updates: Partial<SlipLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...updates } : line))
    )
  }

  const handleVendorSelect = (value: string) => {
    const id = value ? Number(value) : null
    setVendorId(Number.isInteger(id) ? id : null)
    if (id && vendorCache[id]) {
      const vendor = vendorCache[id]
      const lines = [vendor.address]
      if (vendor.contactPhone) {
        lines.push(`Phone: ${vendor.contactPhone}`)
      }
      if (vendor.email) {
        lines.push(`Email: ${vendor.email}`)
      }
      setCustomerName(vendor.name)
      setShipTo(lines.filter(Boolean).join('\n'))
    }
  }

  const removeLine = (key: string) => {
    setLines((prev) =>
      prev.length > 1 ? prev.filter((line) => line.key !== key) : prev
    )
  }

  const openQuickItem = (lineKey?: string) => {
    setShowQuickItem(true)
    setQuickItemLineKey(lineKey ?? null)
  }

  const closeQuickItem = () => {
    if (creatingItem) return
    setShowQuickItem(false)
    setQuickItemLineKey(null)
    setQuickItemForm(emptyQuickItem)
  }

  const handleCreateQuickItem = async () => {
    if (!quickItemForm.name.trim()) {
      showToast('Item name is required.')
      return
    }
    setCreatingItem(true)
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickItemForm.name,
          unit: quickItemForm.unit,
          notes: quickItemForm.notes,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Unable to save item.')
      }
      const saved = data as ItemOption
      setItems((prev) =>
        prev.some((item) => item.id === saved.id) ? prev : [...prev, saved]
      )
      setItemCache((prev) => ({ ...prev, [saved.id]: saved }))
      if (quickItemLineKey) {
        updateLine(quickItemLineKey, { itemId: saved.id })
      }
      setQuickItemForm(emptyQuickItem)
      setQuickItemLineKey(null)
      setShowQuickItem(false)
      showToast(`Item ${saved.name} created.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save item.'
      showToast(message)
    } finally {
      setCreatingItem(false)
    }
  }

  const createSlip = async () => {
    if (!customerName.trim() || !shipTo.trim()) {
      showToast('Customer name and Ship To are required.')
      return
    }
    if (!poNumber.trim()) {
      showToast('Bill No is required.')
      return
    }

    const hasLineData = (line: SlipLine) =>
      line.itemId ||
      line.qty.trim() ||
      line.boxName.trim() ||
      line.boxNumber.trim()

    const missingItem = lines.some(
      (line) => !line.itemId && hasLineData(line)
    )
    if (missingItem) {
      showToast('Select an item for each line with box details.')
      return
    }

    const missingQty = lines.some(
      (line) => line.itemId && Number(line.qty) <= 0
    )
    if (missingQty) {
      showToast('Each line needs qty.')
      return
    }

    const cleanedLines = lines
      .map((line) => ({
        itemId: line.itemId,
        qty: Number(line.qty),
        boxName: line.boxName,
        boxNumber: line.boxNumber,
      }))
      .filter((line) => line.itemId && line.qty > 0)

    if (cleanedLines.length === 0) {
      showToast('Add at least one line item.')
      return
    }

    setWorking(true)
    try {
      const response = await fetch('/api/packing-slips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          shipTo,
          slipDate,
          vendorId,
          poNumber,
          lines: cleanedLines,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status === 409 && data?.slipId) {
          setDuplicateSlipId(Number(data.slipId))
          setDuplicateSlipNo(data.slipNo ? String(data.slipNo) : null)
          throw new Error(data.error || 'Bill No already exists.')
        }
        throw new Error(data.error || 'Unable to create packing slip.')
      }
      const slip = await response.json()
      setDuplicateSlipId(null)
      setDuplicateSlipNo(null)
      return slip
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save slip.'
      showToast(message)
    } finally {
      setWorking(false)
    }
  }

  const handleSave = async () => {
    const slip = await createSlip()
    if (slip?.id) {
      const snapshot = JSON.stringify({
        customerName,
        shipTo,
        poNumber,
        vendorId,
        slipDate,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          qty: line.qty,
          boxName: line.boxName,
          boxNumber: line.boxNumber,
        })),
      })
      setSavedSlipId(slip.id)
      setSavedSnapshot(snapshot)
      showToast('Slip saved.')
    }
  }

  const handlePrintSlip = () => {
    if (!savedSlipId) {
      showToast('Save the slip before printing.')
      return
    }
    const printUrl = `/print/packing-slip/${savedSlipId}?autoprint=1`
    const win = window.open(printUrl, '_blank', 'noopener,noreferrer')
    if (!win) {
      showToast('Popup blocked. Open print view from history.')
    } else {
      showToast('Print view opened in a new tab.')
    }
  }

  const handleGenerateLabels = async () => {
    if (!savedSlipId) {
      showToast('Save the slip before generating labels.')
      return
    }
    const labelUrl = `/shipping-labels/slip/${savedSlipId}`
    const win = window.open(labelUrl, '_blank', 'noopener,noreferrer')
    if (!win) {
      showToast('Popup blocked. Open labels from the slip page.')
    } else {
      showToast('Labels opened in a new tab.')
    }
  }

  const handleSearch = async () => {
    const query = searchBillNo.trim()
    if (!query) {
      showToast('Enter a Bill No to search.')
      return
    }
    setSearching(true)
    setSearchAttempted(true)
    try {
      const response = await fetch(
        `/api/packing-slips?billNo=${encodeURIComponent(query)}`
      )
      if (!response.ok) {
        throw new Error('Unable to search slips.')
      }
      const data: SlipSearchResult[] = await response.json()
      setSearchResults(data)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to search slips.'
      showToast(message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <>
      <section className="page-card">
        <h1 className="section-title">Create Packing Slip</h1>
        <p className="section-subtitle">
          Start a new slip or find an existing one by Bill No.
        </p>
        <div className="tabs">
          <button
            type="button"
            className={`tab-button${activeTab === 'create' ? ' active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Slip
          </button>
          <button
            type="button"
            className={`tab-button${activeTab === 'search' ? ' active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Find by Bill No
          </button>
        </div>
      </section>

      {activeTab === 'create' ? (
        <>
          <section className="page-card">
            <div className="form-grid">
              <div>
                <label>Slip No</label>
                <div className="pill">Auto: {nextSlipNo}</div>
              </div>
              <div>
                <label htmlFor="slip-date">Date</label>
                <input
                  id="slip-date"
                  type="date"
                  value={slipDate}
                  onChange={(event) => setSlipDate(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="vendor-select">Customer Directory</label>
                <select
                  id="vendor-select"
                  value={vendorId ?? ''}
                  onChange={(event) => handleVendorSelect(event.target.value)}
                >
                  <option value="">Select customer</option>
                  {vendorOptions.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="po-number">Bill No</label>
                <input
                  id="po-number"
                  value={poNumber}
                  onChange={(event) => setPoNumber(event.target.value)}
                  placeholder="Bill number"
                  required
                />
              </div>
              <div>
                <label htmlFor="customer-name">Customer Name</label>
                <input
                  id="customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Acme Logistics"
                />
              </div>
            </div>
            <div className="form-grid full" style={{ marginTop: '18px' }}>
              <div>
                <label htmlFor="ship-to">Ship To</label>
                <textarea
                  id="ship-to"
                  value={shipTo}
                  onChange={(event) => setShipTo(event.target.value)}
                  placeholder="Warehouse address, attention line, contact number"
                />
              </div>
            </div>
          </section>

          <section className="page-card">
            <h2 className="section-title">Lines</h2>
            <p className="section-subtitle">
              Pick items, add quantities, and keep units consistent.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Item</th>
                  <th>Box Name</th>
                  <th>Box No</th>
                  <th>Unit</th>
                  <th style={{ width: '12%' }}>Qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const item = line.itemId ? itemCache[line.itemId] : null
                  return (
                    <tr key={line.key}>
                      <td>
                        <select
                          value={line.itemId ?? ''}
                          onChange={(event) => {
                            const value = event.target.value
                            if (value === '__new__') {
                              openQuickItem(line.key)
                              return
                            }
                            updateLine(line.key, {
                              itemId: value ? Number(value) : null,
                            })
                          }}
                        >
                          <option value="">Select item</option>
                          <option value="__new__">+ Create item...</option>
                          {selectOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={line.boxName}
                          onChange={(event) =>
                            updateLine(line.key, { boxName: event.target.value })
                          }
                          placeholder="Box name"
                        />
                      </td>
                      <td>
                        <input
                          value={line.boxNumber}
                          onChange={(event) =>
                            updateLine(line.key, {
                              boxNumber: event.target.value,
                            })
                          }
                          placeholder="Box no"
                        />
                      </td>
                      <td>{item?.unit ?? '-'}</td>
                      <td>
                        <input
                          value={line.qty}
                          onChange={(event) =>
                            updateLine(line.key, { qty: event.target.value })
                          }
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </td>
                      <td>
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => removeLine(line.key)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="actions">
              <button
                className="btn"
                type="button"
                onClick={() => setLines((prev) => [...prev, createLine()])}
              >
                Add Line
              </button>
              <button className="btn secondary" type="button" onClick={() => openQuickItem()}>
                Quick Add Item
              </button>
              <button
                className="btn"
                type="button"
                disabled={working}
                onClick={() => void handleSave()}
              >
                {working ? 'Saving...' : 'Save'}
              </button>
              <button
                className="btn"
                type="button"
                disabled={working || !savedSlipId}
                onClick={() => handlePrintSlip()}
              >
                {working ? 'Opening...' : 'Print Slip'}
              </button>
              <button
                className="btn"
                type="button"
                disabled={working || !savedSlipId}
                onClick={() => void handleGenerateLabels()}
              >
                {working ? 'Generating...' : 'Generate Labels'}
              </button>
            </div>
            {duplicateSlipId ? (
              <div className="inline-alert">
                <span>
                  Bill No already exists
                  {duplicateSlipNo ? ` (${duplicateSlipNo})` : ''}.
                </span>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() =>
                    router.push(`/packing-slip/${duplicateSlipId}/edit`)
                  }
                >
                  Edit Existing Slip
                </button>
              </div>
            ) : null}
            {showQuickItem ? (
              <div className="inline-alert">
                <div style={{ width: '100%' }}>
                  <h3 className="section-title" style={{ fontSize: '1.05rem', marginBottom: '8px' }}>
                    Create Item
                  </h3>
                  <div className="form-grid">
                    <div>
                      <label htmlFor="quick-item-name">Item Name</label>
                      <input
                        id="quick-item-name"
                        value={quickItemForm.name}
                        onChange={(event) =>
                          setQuickItemForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Item name"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-item-unit">Unit</label>
                      <input
                        id="quick-item-unit"
                        value={quickItemForm.unit}
                        onChange={(event) =>
                          setQuickItemForm((prev) => ({
                            ...prev,
                            unit: event.target.value,
                          }))
                        }
                        placeholder="pcs, kg, box"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-item-notes">Notes</label>
                      <input
                        id="quick-item-notes"
                        value={quickItemForm.notes}
                        onChange={(event) =>
                          setQuickItemForm((prev) => ({
                            ...prev,
                            notes: event.target.value,
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
                      disabled={creatingItem}
                      onClick={() => void handleCreateQuickItem()}
                    >
                      {creatingItem ? 'Saving...' : 'Save Item'}
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={creatingItem}
                      onClick={closeQuickItem}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <section className="page-card">
          <h2 className="section-title">Find Slip by Bill No</h2>
          <p className="section-subtitle">
            Enter the Bill No to open the slip for editing.
          </p>
          <div className="table-toolbar">
            <div>
              <label htmlFor="search-bill">Bill No</label>
              <input
                id="search-bill"
                value={searchBillNo}
                onChange={(event) => setSearchBillNo(event.target.value)}
                placeholder="Enter Bill No"
              />
            </div>
            <div className="toolbar-actions">
              <button
                className="btn"
                type="button"
                disabled={searching}
                onClick={() => void handleSearch()}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
          {searchAttempted ? (
            searchResults.length === 0 ? (
              <div className="empty-state">No slips found.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Slip No</th>
                    <th>Bill No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Lines</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((slip) => {
                    const dateLabel = new Date(slip.slipDate).toLocaleDateString(
                      'en-US',
                      { year: 'numeric', month: 'short', day: '2-digit' }
                    )
                    return (
                      <tr key={slip.id}>
                        <td>{slip.slipNo}</td>
                        <td>{slip.poNumber || '-'}</td>
                        <td>{dateLabel}</td>
                        <td>{slip.customerName}</td>
                        <td>{slip._count.lines}</td>
                        <td className="table-action-cell">
                          <Link
                            className="btn ghost"
                            href={`/packing-slip/${slip.id}/edit`}
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          ) : null}
        </section>
      )}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  )
}
