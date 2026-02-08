'use client'

import { useCallback, useEffect, useState } from 'react'

type ItemForm = {
  name: string
  unit: string
  notes: string
}

type ItemRow = {
  id: number
  name: string
  unit: string
  notes: string | null
  isActive: boolean
}

const emptyForm: ItemForm = {
  name: '',
  unit: 'pcs',
  notes: '',
}

export default function NewItemPage() {
  const [form, setForm] = useState<ItemForm>(emptyForm)
  const [items, setItems] = useState<ItemRow[]>([])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ItemForm>(emptyForm)
  const [activeTab, setActiveTab] = useState<'items' | 'add'>('items')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(
        `/api/items?query=${encodeURIComponent(query)}&includeInactive=1`,
        { signal }
      )
      if (!response.ok) {
        throw new Error('Unable to load items.')
      }
      const data: ItemRow[] = await response.json()
      setItems(data)
    },
    [query]
  )

  useEffect(() => {
    const controller = new AbortController()
    loadItems(controller.signal).catch((error) => {
      if (error.name !== 'AbortError') {
        showToast('Unable to load items.')
      }
    })
    return () => controller.abort()
  }, [loadItems])

  const handleSubmit = async (resetAfter: boolean) => {
    if (!form.name.trim()) {
      showToast('Item name is required.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to save item.')
      }
      const saved = await response.json()
      showToast(`Saved ${saved.name}.`)
      await loadItems()
      if (resetAfter) {
        setForm(emptyForm)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save item.'
      showToast(message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: ItemRow) => {
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to update item.')
      }
      const updated = await response.json()
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? updated : row))
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update item.'
      showToast(message)
    }
  }

  const startEdit = (item: ItemRow) => {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      unit: item.unit,
      notes: item.notes ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(emptyForm)
  }

  const saveEdit = async (item: ItemRow) => {
    if (!editForm.name.trim()) {
      showToast('Item name is required.')
      return
    }
    if (!editForm.unit.trim()) {
      showToast('Unit is required.')
      return
    }
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          unit: editForm.unit,
          notes: editForm.notes,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to update item.')
      }
      const updated = await response.json()
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? updated : row))
      )
      showToast(`Updated ${updated.name}.`)
      cancelEdit()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update item.'
      showToast(message)
    }
  }

  const deleteItem = async (item: ItemRow) => {
    const confirmed = window.confirm(`Delete ${item.name}?`)
    if (!confirmed) return
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to delete item.')
      }
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      showToast('Item deleted.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete item.'
      showToast(message)
    }
  }

  return (
    <>
      <section className="page-card">
        <h1 className="section-title">Items</h1>
        <p className="section-subtitle">
          Manage your catalog and keep it clean.
        </p>
        <div className="tabs">
          <button
            className={`tab-button${activeTab === 'items' ? ' active' : ''}`}
            type="button"
            onClick={() => setActiveTab('items')}
          >
            Items
          </button>
          <button
            className={`tab-button${activeTab === 'add' ? ' active' : ''}`}
            type="button"
            onClick={() => setActiveTab('add')}
          >
            Add Item
          </button>
        </div>
      </section>

      {activeTab === 'items' ? (
        <section className="page-card">
          <h2 className="section-title">Items</h2>
          <p className="section-subtitle">
            Toggle active status or delete items you no longer use.
          </p>
          <div className="form-grid full">
            <div>
              <label htmlFor="item-search">Search</label>
              <input
                id="item-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items"
              />
            </div>
          </div>
          {items.length === 0 ? (
            <p className="helper">No items found.</p>
          ) : (
            <table className="table">
              <thead>
              <tr>
                <th>Name</th>
                <th>Unit</th>
                <th style={{ width: '14%' }}>Status</th>
                <th style={{ width: '18%' }}></th>
              </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {editingId === item.id ? (
                        <input
                          value={editForm.name}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Item name"
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td>
                      {editingId === item.id ? (
                        <input
                          value={editForm.unit}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              unit: event.target.value,
                            }))
                          }
                          placeholder="Unit"
                        />
                      ) : (
                        item.unit
                      )}
                    </td>
                  <td>
                    <button
                      className="btn ghost"
                      type="button"
                        onClick={() => void toggleActive(item)}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                    <div className="row-actions">
                      {editingId === item.id ? (
                        <>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => void saveEdit(item)}
                          >
                            Save
                          </button>
                          <button
                            className="btn ghost"
                            type="button"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => void deleteItem(item)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <section className="page-card">
          <h2 className="section-title">Add New Item</h2>
          <p className="section-subtitle">
            Keep the catalog clean. SKU auto-generates if left blank.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleSubmit(false)
            }}
          >
            <div className="form-grid">
              <div>
                <label htmlFor="name">Item Name</label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="e.g. Cold Brew Kit"
                  required
                />
              </div>
              <div>
                <label htmlFor="unit">Unit</label>
                <input
                  id="unit"
                  value={form.unit}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, unit: event.target.value }))
                  }
                  placeholder="pcs, kg, box"
                />
              </div>
              <div>
                <label htmlFor="notes">Notes</label>
                <input
                  id="notes"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            <p className="helper">
              Tip: keep units consistent so slip math is quick.
            </p>
            <div className="actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={saving}
                onClick={() => void handleSubmit(true)}
              >
                Save & Add Another
              </button>
            </div>
          </form>
        </section>
      )}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  )
}
