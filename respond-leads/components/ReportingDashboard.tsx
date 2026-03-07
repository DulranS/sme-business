'use client'

import React, { useState, useEffect } from 'react'
import { reportingService, Report, ReportTemplate } from '../lib/reporting'

interface ReportingDashboardProps {
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
  
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
    marginBottom: '40px'
  },
  
  section: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px'
  },
  
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px',
    fontFamily: "'Inter', sans-serif"
  },
  
  templateGrid: {
    display: 'grid',
    gap: '16px'
  },
  
  templateCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '16px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative'
  },
  
  templateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  
  templateName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'Inter', sans-serif"
  },
  
  templateBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: "'Inter', sans-serif"
  },
  
  pdfBadge: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  },
  
  excelBadge: {
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    border: '1px solid rgba(34, 197, 94, 0.3)'
  },
  
  csvBadge: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  
  templateDescription: {
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: '1.6',
    marginBottom: '16px',
    fontFamily: "'Inter', sans-serif"
  },
  
  templateMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: "'Inter', sans-serif"
  },
  
  generateButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    color: '#ffffff',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '8px',
    fontFamily: "'Inter', sans-serif"
  },
  
  reportsList: {
    display: 'grid',
    gap: '16px',
    maxHeight: '400px',
    overflow: 'auto'
  },
  
  reportItem: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'all 0.3s ease'
  },
  
  reportInfo: {
    flex: 1
  },
  
  reportName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '4px',
    fontFamily: "'Inter', sans-serif"
  },
  
  reportMeta: {
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: "'Inter', sans-serif"
  },
  
  reportActions: {
    display: 'flex',
    gap: '8px'
  },
  
  downloadButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    color: '#e5e5e5',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    borderRadius: '8px',
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
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px',
    fontFamily: "'Inter', sans-serif"
  }
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

  const getFormatBadgeStyle = (format: string) => {
    switch (format.toLowerCase()) {
      case 'pdf': return styles.pdfBadge
      case 'excel': return styles.excelBadge
      case 'csv': return styles.csvBadge
      default: return styles.pdfBadge
    }
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>Reporting Dashboard</h1>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Report Templates</h2>
          <div style={styles.templateGrid}>
            {templates.map((template, index) => (
              <div
                key={index}
                style={styles.templateCard}
                onClick={() => setSelectedTemplate(template)}
              >
                <div style={styles.templateHeader}>
                  <div style={styles.templateName}>{template.name}</div>
                  <div style={{
                    ...styles.templateBadge,
                    ...getFormatBadgeStyle(template.format)
                  }}>
                    {template.format}
                  </div>
                </div>
                <div style={styles.templateDescription}>
                  {template.description}
                </div>
                <div style={styles.templateMeta}>
                  <span>📊 {template.category}</span>
                  <span>⏱️ {template.estimatedTime}</span>
                </div>
                <button
                  style={styles.generateButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    generateReport(template.id)
                  }}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : '🚀 Generate'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Generated Reports</h2>
          {generatedReports.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📄</div>
              <div style={styles.emptyText}>No reports generated yet</div>
            </div>
          ) : (
            <div style={styles.reportsList}>
              {generatedReports.map((report, index) => (
                <div key={index} style={styles.reportItem}>
                  <div style={styles.reportInfo}>
                    <div style={styles.reportName}>{report.name}</div>
                    <div style={styles.reportMeta}>
                      Generated {new Date(report.generatedAt).toLocaleDateString()} • 
                      {report.format.toUpperCase()} • 
                      {(report.size / 1024).toFixed(1)}KB
                    </div>
                  </div>
                  <div style={styles.reportActions}>
                    <button
                      style={styles.downloadButton}
                      onClick={() => downloadReport(report)}
                      disabled={loading}
                    >
                      📥 Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
