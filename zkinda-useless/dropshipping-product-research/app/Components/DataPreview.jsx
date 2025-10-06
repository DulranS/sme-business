// components/DataPreview.js
import Papa from 'papaparse'

export function DataPreview({ data }) {
  const downloadCSV = (data) => {
    if (!data || data.length === 0) {
      alert('No data available to download')
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
      const fileName = `ebay_listings_${new Date().toISOString().split('T')[0]}.csv`
      
      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading file:', err)
      alert('Error downloading file: ' + err.message)
    }
  }

  if (data.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Transformed Data Preview</h2>
        <button 
          onClick={() => downloadCSV(data)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Download eBay Format CSV
        </button>
      </div>
      
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {Object.keys(data[0]).map((header) => (
              <th
                key={header}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={index}>
              {Object.values(row).map((value, i) => (
                <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}