'use client'

import React, { useState, useRef } from 'react'
import { bulkOperationsService, ImportResult } from '../lib/bulk-operations'

interface BulkOperationsProps {
  onRefresh: () => void
  className?: string
}

export default function BulkOperations({ onRefresh, className = '' }: BulkOperationsProps) {
  const [importMode, setImportMode] = useState<'csv' | 'bulk-edit' | 'export'>('csv')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [csvData, setCsvData] = useState('')
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

  const handleImport = async () => {
    if (!csvData.trim()) {
      alert('Please upload a CSV file first')
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
      alert('Import failed. Please check your CSV format.')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setLoading(true)
      // This would need to be implemented to get current inventory data
      // For now, we'll create a sample CSV
      const sampleCsv = `name,sku,quantity,price,currency
Sample Product 1,SKU-001,10,99.99,USD
Sample Product 2,SKU-002,5,149.99,USD
Sample Product 3,SKU-003,20,49.99,USD`
      
      const blob = new Blob([sampleCsv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'inventory_template.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`p-6 ${className}`}>
      <h2 className="text-2xl font-bold text-white mb-6">Bulk Operations</h2>

      {/* Mode Selection */}
      <div className="flex gap-2 mb-6">
        {[
          { value: 'csv', label: 'Import CSV', icon: '📁' },
          { value: 'bulk-edit', label: 'Bulk Edit', icon: '✏️' },
          { value: 'export', label: 'Export', icon: '📤' }
        ].map((mode) => (
          <button
            key={mode.value}
            onClick={() => setImportMode(mode.value as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              importMode === mode.value
                ? 'bg-yellow-400 text-black'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span>{mode.icon}</span>
            {mode.label}
          </button>
        ))}
      </div>

      {/* Import CSV */}
      {importMode === 'csv' && (
        <div className="space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Import from CSV</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload CSV File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-yellow-400 file:text-black hover:file:bg-yellow-300 cursor-pointer"
                />
              </div>

              {csvData && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Preview
                  </label>
                  <div className="bg-gray-900 rounded-lg p-4 max-h-40 overflow-y-auto">
                    <pre className="text-xs text-gray-400">{csvData.substring(0, 500)}...</pre>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={loading || !csvData.trim()}
                  className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Importing...' : 'Import Items'}
                </button>
                <button
                  onClick={() => {
                    setCsvData('')
                    setResult(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* CSV Format Help */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h4 className="text-md font-semibold text-white mb-3">CSV Format</h4>
            <div className="text-sm text-gray-300 space-y-2">
              <p>Your CSV should include the following columns:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li><code className="bg-gray-900 px-1 rounded">name</code> - Product name (required)</li>
                <li><code className="bg-gray-900 px-1 rounded">sku</code> - SKU (required)</li>
                <li><code className="bg-gray-900 px-1 rounded">quantity</code> - Stock quantity</li>
                <li><code className="bg-gray-900 px-1 rounded">price</code> - Unit price</li>
                <li><code className="bg-gray-900 px-1 rounded">currency</code> - Currency code (USD, EUR, etc.)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit */}
      {importMode === 'bulk-edit' && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Bulk Edit</h3>
          <div className="text-gray-300">
            <p className="mb-4">Select multiple items from the inventory table to perform bulk operations.</p>
            <div className="bg-gray-900 rounded-lg p-4">
              <p className="text-sm text-gray-400">
                Go to the Inventory tab, select items using the checkboxes, then use the bulk actions dropdown.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export */}
      {importMode === 'export' && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Export Inventory</h3>
          <div className="space-y-4">
            <p className="text-gray-300">
              Export your current inventory data as a CSV file for backup or analysis.
            </p>
            <button
              onClick={handleExport}
              disabled={loading}
              className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Exporting...' : 'Download CSV'}
            </button>
          </div>
        </div>
      )}

      {/* Import Results */}
      {result && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Import Results</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="text-green-400 text-sm font-medium">Success</div>
              <div className="text-2xl font-bold text-white">{result.success}</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="text-red-400 text-sm font-medium">Failed</div>
              <div className="text-2xl font-bold text-white">{result.failed}</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="text-blue-400 text-sm font-medium">Total</div>
              <div className="text-2xl font-bold text-white">{result.success + result.failed}</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-white mb-2">Errors</h4>
              <div className="bg-gray-900 rounded-lg p-4 max-h-40 overflow-y-auto">
                {result.errors.map((error, index) => (
                  <div key={index} className="text-sm text-red-400 mb-1">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
