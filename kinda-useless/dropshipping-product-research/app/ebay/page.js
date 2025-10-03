'use client'
import { useState } from 'react'
import { CSVUploader } from '../components/CSVUploader'
import { DataPreview } from '../components/DataPreview'

export default function Home() {
  const [transformedData, setTransformedData] = useState([])

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Shopify to eBay CSV Converter</h1>
        <CSVUploader setTransformedData={setTransformedData} />
        <DataPreview data={transformedData} />
      </div>
    </main>
  )
}
