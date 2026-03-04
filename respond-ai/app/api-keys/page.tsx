'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import type { ApiKey } from '@/lib/auth-context'

const SERVICE_OPTIONS = ['openai', 'whatsapp', 'stripe', 'other'] as const

export default function ApiKeysPage() {
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ key_name: '', key_value: '', service: 'openai' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showKeyValue, setShowKeyValue] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchApiKeys()
    }
  }, [isAuthenticated])

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/api-keys')
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data)
      }
    } catch (err) {
      setError('Failed to fetch API keys')
    } finally {
      setLoading(false)
    }
  }

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const newKey = await res.json()
        setApiKeys([...apiKeys, newKey])
        setFormData({ key_name: '', key_value: '', service: 'openai' })
        setShowForm(false)
      } else {
        setError('Failed to save API key')
      }
    } catch (err) {
      setError('Error saving API key')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setApiKeys(apiKeys.filter((k) => k.id !== id))
      }
    } catch (err) {
      setError('Failed to delete API key')
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
          <h1>API Keys</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3B82F6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            {showForm ? 'Cancel' : 'Add API Key'}
          </button>
        </div>

        {error && <div style={{ background: '#7F1D1D', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', color: '#FCA5A5' }}>{error}</div>}

        {showForm && (
          <div
            style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <form onSubmit={handleAddKey}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa' }}>Key Name</label>
                <input
                  type="text"
                  value={formData.key_name}
                  onChange={(e) => setFormData({ ...formData, key_name: e.target.value })}
                  placeholder="e.g., Production OpenAI"
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
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa' }}>Service</label>
                <select
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value as any })}
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
                  {SERVICE_OPTIONS.map((service) => (
                    <option key={service} value={service}>
                      {service.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#aaa' }}>API Key Value</label>
                <input
                  type="password"
                  value={formData.key_value}
                  onChange={(e) => setFormData({ ...formData, key_value: e.target.value })}
                  placeholder="Paste your API key here"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0A0A0A',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    color: '#fff',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#10B981',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save API Key'}
              </button>
            </form>
          </div>
        )}

        <div style={{ display: 'grid', gap: '1rem' }}>
          {apiKeys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              No API keys yet. Add one to get started!
            </div>
          ) : (
            apiKeys.map((key) => (
              <div
                key={key.id}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>{key.key_name}</h3>
                  <p style={{ margin: '0.25rem 0', color: '#999', fontSize: '0.9rem' }}>Service: {key.service.toUpperCase()}</p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.5rem',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      color: '#999',
                    }}
                  >
                    <span>{showKeyValue[key.id] ? key.key_value : '•'.repeat(Math.min(30, key.key_value.length))}</span>
                    <button
                      onClick={() => setShowKeyValue({ ...showKeyValue, [key.id]: !showKeyValue[key.id] })}
                      style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', padding: '0' }}
                    >
                      {showKeyValue[key.id] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#EF4444',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                    marginLeft: '1rem',
                  }}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
