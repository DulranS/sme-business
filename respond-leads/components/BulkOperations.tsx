'use client'

import React, { useState, useRef } from 'react'
import { bulkOperationsService, ImportResult } from '../lib/bulk-operations'

interface BulkOperationsProps {
  onRefresh: () => void
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
    marginBottom: '32px'
  },
  
  title: {
    fontSize: '32px',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '-0.5px',
    fontFamily:  Inter -apple-system BlinkMacSystemFont Segoe UI sans-serif
  },
  
  modeSelector: {
    display: 'flex',
    gap: '8px',
    marginBottom: '32px',
    background: 'rgba(255, 255, 255, 0.08)',
    padding: '6px',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    flexWrap: 'wrap'
  },
  
  modeButton: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: 'transparent',
    color: '#9ca3af',
    fontFamily: Inter sans-serif
  },
  
  modeButtonActive: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
  },
  
  contentArea: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px',
    marginBottom: '32px'
  },
  
  uploadArea: {
    border: '2px dashed rgba(139, 92, 246, 0.3)',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: 'rgba(99, 102, 241, 0.02)',
    marginBottom: '24px'
  },
  
  uploadAreaHover: {
    borderColor: 'rgba(139, 92, 246, 0.6)',
    background: 'rgba(99, 102, 241, 0.05)'
  },
  
  uploadIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    color: '#8b5cf6'
  },
  
  uploadText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '8px',
    fontFamily: Inter sans-serif
  },
  
  uploadSubtext: {
    fontSize: '14px',
    color: '#9ca3af',
    fontFamily: Inter sans-serif
  },
  
  fileInput: {
    display: 'none'
  },
  
  textarea: {
    width: '100%',
    minHeight: '200px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '12px',
    padding: '16px',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: Inter sans-serif,
    resize: 'vertical',
    lineHeight: '1.6'
  },
  
  buttonGroup: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap'
  },
  
  primaryButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    color: '#ffffff',
    padding: '14px 32px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '12px',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
    fontFamily: Inter sans-serif
  },
  
  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    color: '#e5e5e5',
    padding: '14px 32px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    borderRadius: '12px',
    fontFamily: Inter sans-serif
  },
  
  resultCard: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px',
    marginTop: '24px'
  },
  
  resultTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '20px',
    fontFamily: Inter sans-serif
  },
  
  resultStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '24px'
  },
  
  statItem: {
    textAlign: 'center',
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(139, 92, 246, 0.1)'
  },
  
  statValue: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    fontFamily: Inter sans-serif
  },
  
  statLabel: {
    fontSize: '12px',
    color: '#a78bfa',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontFamily: Inter sans-serif
  },
  
  successStat: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    background: 'rgba(16, 185, 129, 0.05)'
  },
  
  errorStat: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    background: 'rgba(239, 68, 68, 0.05)'
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px',
    fontFamily: Inter sans-serif
  }
}

export default function BulkOperations({ onRefresh, className = '' }: BulkOperationsProps) {
  const [importMode, setImportMode] = useState<'csv' | 'bulk-edit' | 'export'>('csv')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [csvData, setCsvData] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCsvData(e.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    
    const file = event.dataTransfer.files[0]
    if (file && file.type === 'text/csv') {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCsvData(e.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleImport = async () => {
    if (!csvData.trim()) {
      return
    }

    try {
      setLoading(true)
      const importResult = await bulkOperationsService.bulkImport(csvData)
      setResult(importResult)
      if (importResult.success > 0) {
        onRefresh()
      }
    } catch (error) {
      console.error('Import failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setLoading(true)
      const blob = await bulkOperationsService.bulkExport()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'inventory_export.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
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
        {(['csv', 'bulk-edit', 'export'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setImportMode(mode)}
            style={{
              ...styles.modeButton,
              ...(importMode === mode ? styles.modeButtonActive : {})
            }}
          >
            {mode === 'csv' ? ' CSV Import' : mode === 'bulk-edit' ? ' Bulk Edit' : ' Export'}
          </button>
        ))}
      </div>

      <div style={styles.contentArea}>
        {importMode === 'csv' && (
          <>
            <div
              style={{
                ...styles.uploadArea,
                ...(isDragOver ? styles.uploadAreaHover : {})
              }}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type=file
                accept=.csv
                onChange={handleFileUpload}
                style={styles.fileInput}
              />
              <div style={styles.uploadIcon}></div>
              <div style={styles.uploadText}>
                {csvData ? 'File uploaded successfully!' : 'Drop CSV file here or click to browse'}
              </div>
              <div style={styles.uploadSubtext}>
                Supports CSV format with headers: name, sku, price, quantity, currency
              </div>
            </div>

            {csvData && (
              <textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder=Or paste your CSV data here...
                style={styles.textarea}
              />
            )}

            <div style={styles.buttonGroup}>
              <button
                onClick={handleImport}
                disabled={loading || !csvData.trim()}
                style={styles.primaryButton}
              >
                {loading ? 'Processing...' : ' Import Data'}
              </button>
              <button
                onClick={() => setCsvData('')}
                style={styles.secondaryButton}
              >
                Clear
              </button>
            </div>
          </>
        )}

        {importMode === 'bulk-edit' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
              Bulk Edit Mode
            </div>
            <div style={{ fontSize: '14px', color: '#9ca3af', lineHeight: '1.6' }}>
              Select multiple items from the inventory table to perform bulk operations like editing prices, updating quantities, or deleting items.
            </div>
          </div>
        )}

        {importMode === 'export' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
              Export Data
            </div>
            <div style={{ fontSize: '14px', color: '#9ca3af', lineHeight: '1.6', marginBottom: '24px' }}>
              Export your entire inventory as a CSV file for backup or analysis.
            </div>
            <button
              onClick={handleExport}
              disabled={loading}
              style={styles.primaryButton}
            >
              {loading ? 'Exporting...' : ' Export Inventory'}
            </button>
          </div>
        )}
      </div>

      {result && (
        <div style={styles.resultCard}>
          <h3 style={styles.resultTitle}>Import Results</h3>
          <div style={styles.resultStats}>
            <div style={{ ...styles.statItem, ...styles.successStat }}>
              <div style={styles.statValue}>{result.success}</div>
              <div style={styles.statLabel}>Successfully Imported</div>
            </div>
            <div style={{ ...styles.statItem, ...styles.errorStat }}>
              <div style={styles.statValue}>{result.errors}</div>
              <div style={styles.statLabel}>Errors</div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{result.total}</div>
              <div style={styles.statLabel}>Total Processed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
