'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import type { InventoryItem } from '@/lib/supabase'

type UserSupply = {
  id: string
  part_id: string
  quantity: number
  reorder_level: number
  part: InventoryItem
}

export default function SupplyTrackingPage() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [supplies, setSupplies] = useState<UserSupply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddSupply, setShowAddSupply] = useState(false)
  const [availableParts, setAvailableParts] = useState<InventoryItem[]>([])
  const [selectedPart, setSelectedPart] = useState('')
  const [formData, setFormData] = useState({ quantity: '', reorder_level: '5' })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchSupplies()
      fetchAvailableParts()
    }
  }, [isAuthenticated])

  const fetchSupplies = async () => {
    try {
      const res = await fetch('/api/supplies')
      if (res.ok) {
        const data = await res.json()
        setSupplies(data)
      }
    } catch (err) {
      setError('Failed to fetch supplies')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableParts = async () => {
    try {
      const res = await fetch('/api/inventory?limit=1000')
      if (res.ok) {
        const data = await res.json()
        setAvailableParts(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch parts:', err)
    }
  }

  const handleAddSupply = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedPart) {
      setError('Please select a part')
      return
    }

    try {
      const res = await fetch('/api/supplies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_id: selectedPart,
          quantity: parseInt(formData.quantity),
          reorder_level: parseInt(formData.reorder_level),
        }),
      })

      if (res.ok) {
        const newSupply = await res.json()
        setSupplies([...supplies, newSupply])
        setSelectedPart('')
        setFormData({ quantity: '', reorder_level: '5' })
        setShowAddSupply(false)
      } else {
        setError('Failed to add supply')
      }
    } catch (err) {
      setError('Error adding supply')
    }
  }

  const handleUpdateQuantity = async (id: string, newQuantity: number) => {
    try {
      const res = await fetch(`/api/supplies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQuantity }),
      })

      if (res.ok) {
        setSupplies(
          supplies.map((s) =>
            s.id === id ? { ...s, quantity: newQuantity } : s
          )
        )
      }
    } catch (err) {
      setError('Failed to update quantity')
    }
  }

  const handleDeleteSupply = async (id: string) => {
    if (!confirm('Remove this item from your supply tracking?')) return

    try {
      const res = await fetch(`/api/supplies/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSupplies(supplies.filter((s) => s.id !== id))
      }
    } catch (err) {
      setError('Failed to delete supply')
    }
  }

  if (authLoading) {
    return <div style={{ padding: '2rem', color: '#fff' }}>Loading...</div>
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#fff', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Supply Tracking</h1>
          <button
            onClick={() => setShowAddSupply(!showAddSupply)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#FF4500',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: '600',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {showAddSupply ? 'Cancel' : '+ Add to Supply'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#7F1D1D', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', color: '#FCA5A5' }}>
            {error}
          </div>
        )}

        {showAddSupply && (
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <form onSubmit={handleAddSupply}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa' }}>Select Part</label>
                <select
                  value={selectedPart}
                  onChange={(e) => setSelectedPart(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0A0A0A',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    color: '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">-- Select a part --</option>
                  {availableParts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name} ({part.part_number})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa' }}>Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                    min="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0A0A0A',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#fff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa' }}>Reorder Level</label>
                  <input
                    type="number"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0A0A0A',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#fff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#10B981',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Add Supply
              </button>
            </form>
          </div>
        )}

        <div style={{ display: 'grid', gap: '1rem' }}>
          {supplies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              No supplies tracked yet. Add one to get started!
            </div>
          ) : (
            supplies.map((supply) => (
              <div
                key={supply.id}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>{supply.part?.name}</h3>
                  <p style={{ margin: '0.25rem 0', color: '#999', fontSize: '0.9rem' }}>
                    Part #: {supply.part?.part_number}
                  </p>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '0.5rem' }}>Quantity</div>
                  <input
                    type="number"
                    value={supply.quantity}
                    onChange={(e) => handleUpdateQuantity(supply.id, parseInt(e.target.value))}
                    min="0"
                    style={{
                      width: '80px',
                      padding: '0.5rem',
                      background: '#0A0A0A',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#fff',
                      textAlign: 'center',
                    }}
                  />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '0.5rem' }}>Reorder Level</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3B82F6' }}>
                    {supply.reorder_level}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSupply(supply.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#EF4444',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
