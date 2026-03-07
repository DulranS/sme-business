'use client'

import React, { useState, useCallback } from 'react'
import { bulkOperationsService } from '../lib/bulk-operations'

interface BulkOperationsProps {
  className?: string
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(139, 92, 246, 0.03))',
    borderRadius: '24px',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(139, 92, 246, 0.15)',
    minHeight: 'calc(100vh - 200px)'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
    flexWrap: 'wrap',
    gap: '20px'
  },
  
  title: {
    fontSize: '32px',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '-0.5px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  modeSelector: {
    display: 'flex',
    gap: '8px',
    marginBottom: '32px',
    background: 'rgba(255, 255, 255, 0.08)',
    padding: '6px',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)'
  },
  
  modeButton: {
    padding: '10px 20px',
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: "'Inter', sans-serif",
    transition: 'all 0.3s ease'
  },
  
  modeButtonActive: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff'
  },
  
  uploadArea: {
    border: '2px dashed rgba(139, 92, 246, 0.3)',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.02)',
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },
  
  uploadIcon: {
    fontSize: '48px',
    opacity: 0.6
  },
  
  uploadText: {
    fontSize: '16px',
    color: '#e5e5e5',
    marginBottom: '8px',
    fontFamily: "'Inter', sans-serif"
  },
  
  uploadSubtext: {
    fontSize: '14px',
    color: '#9ca3af',
    fontFamily: "'Inter', sans-serif"
  },
  
  fileInput: {
    display: 'none'
  },
  
  resultsSection: {
    marginTop: '32px'
  },
  
  resultsGrid: {
    display: 'grid',
    gap: '20px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
  },
  
  resultCard: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px'
  },
  
  resultTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '16px',
    fontFamily: "'Inter', sans-serif"
  },
  
  resultStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px'
  },
  
  statLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: "'Inter', sans-serif"
  },
  
  statValue: {
    fontSize: '14px',
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: "'Inter', sans-serif"
  },
  
  actionsSection: {
    marginTop: '32px',
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap'
  },
  
  actionButton: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: "'Inter', sans-serif"
  },
  
  primaryButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff'
  },
  
  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#e5e5e5',
    border: '1px solid rgba(139, 92, 246, 0.3)'
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px',
    fontFamily: "'Inter', sans-serif"
  },
  
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280'
  },
  
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5
  },
  
  emptyText: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#9ca3af',
    fontFamily: "'Inter', sans-serif"
  }
}

export default function BulkOperations({ className = '' }: BulkOperationsProps) {
  const [mode, setMode] = useState<'import' | 'export' | 'edit'>('import')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      setFile(droppedFile)
    }
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const processFile = async () => {
    if (!file) return

    setLoading(true)
    try {
      if (mode === 'import') {
        const result = await bulkOperationsService.bulkImport(file)
        setResults(result)
      } else if (mode === 'export') {
        const result = await bulkOperationsService.bulkExport()
        setResults(result)
      }
    } catch (error) {
      console.error('Bulk operation failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>Bulk Operations</h1>
      </div>

      <div style={styles.modeSelector}>
        {(['import', 'export', 'edit'] as const).map(m => (
          <button
            key={m}
            style={{
              ...styles.modeButton,
              ...(mode === m ? styles.modeButtonActive : {})
            }}
            onClick={() => setMode(m)}
          >
            {m === 'import' ? '📥 Import' : m === 'export' ? '📤 Export' : '✏️ Edit'}
          </button>
        ))}
      </div>

      {mode === 'import' && (
        <div
          style={styles.uploadArea}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileSelect}
            style={styles.fileInput}
          />
          <div style={styles.uploadIcon}>📁</div>
          <div style={styles.uploadText}>
            {file ? file.name : 'Drop your file here or click to browse'}
          </div>
          <div style={styles.uploadSubtext}>
            Supports CSV and Excel files
          </div>
        </div>
      )}

      {mode === 'export' && (
        <div style={styles.uploadArea}>
          <div style={styles.uploadIcon}>📊</div>
          <div style={styles.uploadText}>Export Data</div>
          <div style={styles.uploadSubtext}>
            Generate and download inventory reports
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div style={styles.uploadArea}>
          <div style={styles.uploadIcon}>✏️</div>
          <div style={styles.uploadText}>Bulk Edit</div>
          <div style={styles.uploadSubtext}>
            Update multiple items at once
          </div>
        </div>
      )}

      <div style={styles.actionsSection}>
        <button
          style={{
            ...styles.actionButton,
            ...styles.primaryButton
          }}
          onClick={processFile}
          disabled={!file && mode === 'import'}
        >
          {loading ? 'Processing...' : mode === 'import' ? 'Import File' : mode === 'export' ? 'Export Data' : 'Start Editing'}
        </button>
        
        {mode === 'export' && (
          <button
            style={{
              ...styles.actionButton,
              ...styles.secondaryButton
            }}
          >
            Schedule Export
          </button>
        )}
      </div>

      {results && (
        <div style={styles.resultsSection}>
          <div style={styles.resultsGrid}>
            <div style={styles.resultCard}>
              <h3 style={styles.resultTitle}>Operation Results</h3>
              <div style={styles.resultStats}>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Status</span>
                  <span style={styles.statValue}>
                    {results.success ? '✅ Success' : '❌ Failed'}
                  </span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Records</span>
                  <span style={styles.statValue}>
                    {results.total || results.processed || 0}
                  </span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Duration</span>
                  <span style={styles.statValue}>
                    {results.duration || 'N/A'}
                  </span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Errors</span>
                  <span style={styles.statValue}>
                    {results.errors || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={styles.loading}>Processing bulk operation...</div>
      )}
    </div>
  )
}
