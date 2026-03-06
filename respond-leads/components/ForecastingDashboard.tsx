'use client'

import React, { useState, useEffect } from 'react'
import { forecastingService, ForecastData, CustomerSegment, InventoryOptimization } from '../lib/forecasting'
import { CurrencyService } from '../lib/currency'

interface ForecastingDashboardProps {
  className?: string
}

export default function ForecastingDashboard({ className = '' }: ForecastingDashboardProps) {
  const [forecastData, setForecastData] = useState<ForecastData[]>([])
  const [optimization, setOptimization] = useState<InventoryOptimization | null>(null)
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedForecast, setSelectedForecast] = useState<ForecastData | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadForecastingData()
  }, [timeRange])

  const loadForecastingData = async () => {
    try {
      setLoading(true)
      const [forecast, opt, seg] = await Promise.all([
        forecastingService.generateInventoryForecast(timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90),
        forecastingService.getInventoryOptimization(),
        forecastingService.getCustomerSegments()
      ])
      
      setForecastData(forecast)
      setOptimization(opt)
      setSegments(seg)
    } catch (error) {
      console.error('Failed to load forecasting data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'order_now': return 'text-red-400'
      case 'monitor': return 'text-yellow-400'
      case 'overstocked': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const getRecommendationBg = (recommendation: string) => {
    switch (recommendation) {
      case 'order_now': return 'bg-red-500/10 border-red-500/30'
      case 'monitor': return 'bg-yellow-500/10 border-yellow-500/30'
      case 'overstocked': return 'bg-blue-500/10 border-blue-500/30'
      default: return 'bg-gray-500/10 border-gray-500/30'
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

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold text-white">AI Forecasting & Analytics</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-yellow-400 text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Items Needing Reorder</span>
            <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
              <span className="text-red-400 text-sm">🚨</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {forecastData.filter(f => f.recommendation === 'order_now').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Immediate action required</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Potential Savings</span>
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <span className="text-green-400 text-sm">💰</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {CurrencyService.formatPrice(optimization?.potentialSavings || 0, 'USD')}
          </div>
          <div className="text-xs text-gray-500 mt-1">From optimization</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Inventory Turnover</span>
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-blue-400 text-sm">📊</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {(optimization?.turnoverRate || 0).toFixed(2)}x
          </div>
          <div className="text-xs text-gray-500 mt-1">Annual rate</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Customer Segments</span>
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <span className="text-purple-400 text-sm">👥</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{segments.length}</div>
          <div className="text-xs text-gray-500 mt-1">Active segments</div>
        </div>
      </div>

      {/* Forecast Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Demand Forecast</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Product</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Current Stock</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Avg Daily Demand</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Reorder Point</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Safety Stock</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Recommendation</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Stockout Risk</th>
              </tr>
            </thead>
            <tbody>
              {forecastData.slice(0, 10).map((forecast) => (
                <tr key={forecast.itemId} className="border-b border-gray-700/50">
                  <td className="py-3 text-sm text-white">{forecast.itemName}</td>
                  <td className="py-3 text-sm text-gray-300">{forecast.currentStock}</td>
                  <td className="py-3 text-sm text-gray-300">{forecast.avgDailyDemand.toFixed(1)}</td>
                  <td className="py-3 text-sm text-gray-300">{forecast.reorderPoint}</td>
                  <td className="py-3 text-sm text-gray-300">{forecast.safetyStock}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${getRecommendationBg(forecast.recommendation)} ${getRecommendationColor(forecast.recommendation)}`}>
                      {forecast.recommendation.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            forecast.stockoutRisk > 0.7 ? 'bg-red-500' :
                            forecast.stockoutRisk > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${forecast.stockoutRisk * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400">
                        {Math.round(forecast.stockoutRisk * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Customer Segments</h3>
          <div className="space-y-4">
            {segments.map((segment) => (
              <div key={segment.id} className="border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-white">{segment.name}</h4>
                  <span className="text-sm text-gray-400">{segment.customerCount} customers</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-gray-400">Avg Order Value</div>
                    <div className="text-sm font-medium text-white">
                      {CurrencyService.formatPrice(segment.avgOrderValue, 'USD')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Total Revenue</div>
                    <div className="text-sm font-medium text-white">
                      {CurrencyService.formatPrice(segment.totalRevenue, 'USD')}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {segment.characteristics.slice(0, 3).map((char, index) => (
                    <span key={index} className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
                      {char}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optimization Insights */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Optimization Insights</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Dead Stock Items</div>
                <div className="text-xs text-gray-400">Items with zero inventory</div>
              </div>
              <div className="text-xl font-bold text-red-400">
                {optimization?.deadStockItems.length || 0}
              </div>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Fast Moving Items</div>
                <div className="text-xs text-gray-400">High velocity products</div>
              </div>
              <div className="text-xl font-bold text-green-400">
                {optimization?.fastMovingItems.length || 0}
              </div>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Slow Moving Items</div>
                <div className="text-xs text-gray-400">Low velocity products</div>
              </div>
              <div className="text-xl font-bold text-yellow-400">
                {optimization?.slowMovingItems.length || 0}
              </div>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">Total Inventory Value</div>
                <div className="text-xs text-gray-400">Current valuation</div>
              </div>
              <div className="text-xl font-bold text-blue-400">
                {CurrencyService.formatPrice(optimization?.totalValue || 0, 'USD')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Forecast View */}
      {selectedForecast && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">
              Detailed Forecast: {selectedForecast.itemName}
            </h3>
            <button
              onClick={() => setSelectedForecast(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="text-xs text-gray-400">Optimal Order Quantity</div>
              <div className="text-lg font-medium text-white">{selectedForecast.optimalOrderQuantity} units</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Lead Time</div>
              <div className="text-lg font-medium text-white">{selectedForecast.leadTime} days</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Total Predicted Demand</div>
              <div className="text-lg font-medium text-white">
                {selectedForecast.predictedDemand.reduce((sum, demand) => sum + demand, 0)} units
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Current vs Optimal</div>
              <div className="text-lg font-medium text-white">
                {selectedForecast.currentStock} / {selectedForecast.reorderPoint}
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-white mb-3">Predicted Demand Trend</h4>
            <div className="space-y-2">
              {selectedForecast.predictedDemand.slice(0, 14).map((demand, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Day {index + 1}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${Math.min((demand / 20) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-white font-medium">{demand} units</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
