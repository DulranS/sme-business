export function downloadCSV(data) {
    const csvContent = Papa.unparse(data)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'ebay_listings.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }