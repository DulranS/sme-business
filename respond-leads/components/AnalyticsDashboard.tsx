'use client'

import React, { useState, useEffect } from 'react'
import { analyticsService, AnalyticsMetrics } from '../lib/analytics'
import { bulkOperationsService } from '../lib/bulk-operations'
import { CurrencyService } from '../lib/currency'

interface AnalyticsDashboardProps {
  className?: string
}

export default function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
  const [suggestions, setSuggestions] = useState<any[]>([])

  useEffect(() => {
    loadAnalytics()
    loadSuggestions()
  }, [timeframe])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const data = await analyticsService.getAnalyticsMetrics(timeframe)
      setMetrics(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSuggestions = async () => {
    try {
      const data = await bulkOperationsService.getInventorySuggestions()
      setSuggestions(data)
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-gray-400">
          Failed to load analytics data
        </div>
      </div>
    )
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-yellow-400 text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Revenue</span>
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <span className="text-green-400 text-sm">💰</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {CurrencyService.formatPrice(metrics.totalRevenue, 'USD')}
          </div>
          <div className="text-xs text-gray-500 mt-1">All time</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Orders</span>
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-blue-400 text-sm">📦</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalOrders}</div>
          <div className="text-xs text-gray-500 mt-1">Last {timeframe === '7d' ? '7' : timeframe === '30d' ? '30' : '90'} days</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Avg Order Value</span>
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <span className="text-purple-400 text-sm">📊</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {CurrencyService.formatPrice(metrics.averageOrderValue, 'USD')}
          </div>
          <div className="text-xs text-gray-500 mt-1">Per order</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Stock Alerts</span>
            <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
              <span className="text-red-400 text-sm">⚠️</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {metrics.lowStockAlerts + metrics.outOfStockItems}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.outOfStockItems} out of stock, {metrics.lowStockAlerts} low stock
          </div>
        </div>
      </div>

      {/* Charts and Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Trend */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Sales Trend</h3>
          <div className="space-y-2">
            {metrics.salesTrend.slice(-7).map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{day.date}</span>
                <div className="flex items-center gap-4">
                  <div className="w-24 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${Math.min((day.revenue / 1000) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-white font-medium">
                    {CurrencyService.formatPrice(day.revenue, 'USD')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Satisfaction */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Customer Satisfaction</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-400">Positive</span>
                <span className="text-white">{metrics.customerSatisfaction.positive}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-400 h-2 rounded-full"
                  style={{ width: `${(metrics.customerSatisfaction.positive / metrics.customerSatisfaction.total) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-yellow-400">Neutral</span>
                <span className="text-white">{metrics.customerSatisfaction.neutral}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full"
                  style={{ width: `${(metrics.customerSatisfaction.neutral / metrics.customerSatisfaction.total) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-400">Negative</span>
                <span className="text-white">{metrics.customerSatisfaction.negative}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-red-400 h-2 rounded-full"
                  style={{ width: `${(metrics.customerSatisfaction.negative / metrics.customerSatisfaction.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Items */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Top Selling Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Product</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Quantity</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topSellingItems.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-700/50">
                  <td className="py-3 text-sm text-white">{item.name}</td>
                  <td className="py-3 text-sm text-gray-300">{item.quantity}</td>
                  <td className="py-3 text-sm text-white font-medium">
                    {CurrencyService.formatPrice(item.revenue, 'USD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Inventory Suggestions</h3>
          <div className="space-y-3">
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  suggestion.priority === 'high'
                    ? 'bg-red-500/10 border-red-500/30'
                    : suggestion.priority === 'medium'
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        suggestion.priority === 'high'
                          ? 'bg-red-500 text-white'
                          : suggestion.priority === 'medium'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {suggestion.priority.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-white capitalize">
                        {suggestion.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{suggestion.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">Product: {suggestion.item.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
