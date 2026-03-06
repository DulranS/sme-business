'use client'

import React, { useState, useEffect } from 'react'
import { reportingService, Report, ReportTemplate } from '../lib/reporting'

interface ReportingDashboardProps {
  className?: string
}

export default function ReportingDashboard({ className = '' }: ReportingDashboardProps) {
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [generatedReports, setGeneratedReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = () => {
    const availableTemplates = reportingService.getAvailableTemplates()
    setTemplates(availableTemplates)
  }

  const generateReport = async (templateId: string) => {
    try {
      setGenerating(true)
      const report = await reportingService.generateReport(templateId)
      setGeneratedReports(prev => [report, ...prev])
      setSelectedTemplate(null)
    } catch (error) {
      console.error('Failed to generate report:', error)
    } finally {
      setGenerating(false)
    }
  }

  const downloadReport = async (report: Report) => {
    try {
      setLoading(true)
      const blob = await reportingService.exportReport(report)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report.name.replace(/\s+/g, '_').toLowerCase()}.${report.format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download report:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTemplateIcon = (type: ReportTemplate['type']) => {
    switch (type) {
      case 'inventory': return '📦'
      case 'sales': return '💰'
      case 'forecasting': return '📊'
      case 'customer': return '👥'
      case 'financial': return '💳'
      default: return '📄'
    }
  }

  const getFormatColor = (format: ReportTemplate['format']) => {
    switch (format) {
      case 'pdf': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'excel': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'csv': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold text-white">Business Reports</h2>
        <button
          onClick={() => setSelectedTemplate(null)}
          className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-300 transition-colors"
        >
          + New Report
        </button>
      </div>

      {/* Report Generation Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-4">Generate Report</h3>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{getTemplateIcon(selectedTemplate.type)}</span>
                <div>
                  <div className="font-medium text-white">{selectedTemplate.name}</div>
                  <div className="text-sm text-gray-400">{selectedTemplate.description}</div>
                </div>
              </div>
              <div className="text-sm text-gray-300">
                <div className="mb-2">Report Type: {selectedTemplate.type}</div>
                <div className="mb-2">Format: {selectedTemplate.format.toUpperCase()}</div>
                <div>Sections: {selectedTemplate.sections.length}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => generateReport(selectedTemplate.id)}
                disabled={generating}
                className="flex-1 px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? 'Generating...' : 'Generate Report'}
              </button>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Templates */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Available Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTemplateIcon(template.type)}</span>
                  <div>
                    <h4 className="font-medium text-white">{template.name}</h4>
                    <p className="text-sm text-gray-400 mt-1">{template.description}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${getFormatColor(template.format)}`}>
                  {template.format.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {template.sections.length} sections
                </div>
                <button className="text-yellow-400 hover:text-yellow-300 text-sm font-medium">
                  Generate →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generated Reports */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Recent Reports</h3>
        {generatedReports.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
            <div className="text-gray-400 mb-2">No reports generated yet</div>
            <div className="text-sm text-gray-500">Select a template above to generate your first report</div>
          </div>
        ) : (
          <div className="space-y-4">
            {generatedReports.map((report) => (
              <div
                key={report.id}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{getTemplateIcon(report.type)}</span>
                    <div>
                      <h4 className="font-medium text-white">{report.name}</h4>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-gray-400">
                          Generated: {report.generatedAt.toLocaleString()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getFormatColor(report.format)}`}>
                          {report.format.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => downloadReport(report)}
                      disabled={loading}
                      className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? 'Downloading...' : 'Download'}
                    </button>
                    <button
                      onClick={() => {
                        setGeneratedReports(prev => prev.filter(r => r.id !== report.id))
                      }}
                      className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                
                {/* Report Preview */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="text-sm text-gray-400 mb-2">Report Sections:</div>
                  <div className="flex flex-wrap gap-2">
                    {templates
                      .find(t => t.type === report.type)
                      ?.sections.map(section => (
                        <span
                          key={section.id}
                          className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded"
                        >
                          {section.name}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Reports Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">Scheduled Reports</h3>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="text-center text-gray-400">
            <div className="mb-2">📅 Automated Reporting Coming Soon</div>
            <div className="text-sm text-gray-500">
              Schedule reports to be automatically generated and emailed to stakeholders
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
