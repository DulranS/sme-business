'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '2rem', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
        <h1 style={{ textAlign: 'center', color: '#fff', marginBottom: '2rem' }}>Sign In</h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#0A0A0A',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#aaa', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#0A0A0A',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && <div style={{ color: '#EF4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#3B82F6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#666', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          Don't have an account?{' '}
          <Link href="/signup" style={{ color: '#3B82F6', textDecoration: 'none' }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
