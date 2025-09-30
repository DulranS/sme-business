// components/CSVUploader.js
import { useState } from 'react'
import Papa from 'papaparse'
import { transformShopifyToEbayFormat } from '../../lib/transform'

export function CSVUploader({ transformedData, setTransformedData }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloadReady, setDownloadReady] = useState(false)

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')
    setDownloadReady(false)

    Papa.parse(file, {
      complete: (results) => {
        try {
          const transformed = transformShopifyToEbayFormat(results.data)
          setTransformedData(transformed)
          setDownloadReady(true)
        } catch (err) {
          setError('Error processing CSV file. Please ensure it\'s a valid Shopify export.')
        } finally {
          setLoading(false)
        }
      },
      header: true,
      error: (error) => {
        setError('Error reading CSV file: ' + error.message)
        setLoading(false)
      }
    })
  }

  const handleDownload = (data) => {
    if (!data || data.length === 0) {
      setError('No data available to download')
      return
    }

    try {
      // Convert data to CSV string
      const csvContent = Papa.unparse(data, {
        quotes: true, // Add quotes around each field
        header: true // Include headers in output
      })

      // Create a blob with the CSV content
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `ebay_listings_${new Date().toISOString().split('T')[0]}.csv`)
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Error downloading file: ' + err.message)
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">CSV file from Shopify</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept=".csv" 
            onChange={handleFileUpload}
          />
        </label>
      </div>
      {loading && <p className="mt-4 text-blue-600">Processing file...</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {downloadReady && (
        <button
          onClick={() => handleDownload(transformedData)}
          className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Download eBay Format CSV
        </button>
      )}
    </div>
  )
}