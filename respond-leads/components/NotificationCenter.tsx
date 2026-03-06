'use client'

import React, { useState, useEffect } from 'react'
import { realtimeService, RealtimeEvent, NotificationSettings } from '../lib/realtime'

interface NotificationToast {
  id: string
  event: RealtimeEvent
  onClose: () => void
}

function NotificationToast({ id, event, onClose }: NotificationToast) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const getIcon = () => {
    switch (event.type) {
      case 'stock_alert': return '📦'
      case 'price_change': return '💰'
      case 'new_conversation': return '💬'
      case 'inventory_update': return '🔄'
      default: return '🔔'
    }
  }

  const getColor = () => {
    switch (event.type) {
      case 'stock_alert': return 'bg-red-500'
      case 'price_change': return 'bg-blue-500'
      case 'new_conversation': return 'bg-green-500'
      case 'inventory_update': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getMessage = () => {
    switch (event.type) {
      case 'stock_alert':
        return event.data.message || `${event.data.item?.name} is low in stock`
      case 'price_change':
        return `${event.data.item?.name} price changed`
      case 'new_conversation':
        return `New conversation from ${event.data.customer_name || 'Unknown'}`
      default:
        return 'System update'
    }
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${getColor()} text-white rounded-lg shadow-lg p-4 flex items-start gap-3`}>
        <div className="text-2xl">{getIcon()}</div>
        <div className="flex-1">
          <div className="font-semibold text-sm mb-1">
            {event.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </div>
          <div className="text-sm opacity-90">{getMessage()}</div>
          <div className="text-xs opacity-75 mt-1">
            {new Date(event.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onClose, 300)
          }}
          className="text-white/50 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

interface NotificationCenterProps {
  className?: string
}

export default function NotificationCenter({ className = '' }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Array<{ id: string; event: RealtimeEvent }>>([])
  const [settings, setSettings] = useState<NotificationSettings>(realtimeService.getSettings())
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe('notification-center', (event) => {
      const id = Date.now().toString()
      setNotifications(prev => [...prev, { id, event }])
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    realtimeService.updateSettings(newSettings)
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  const requestPermission = async () => {
    const granted = await realtimeService.requestNotificationPermission()
    if (granted) {
      alert('Browser notifications enabled!')
    }
  }

  return (
    <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
      {/* Notification Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors relative"
      >
        🔔
        {notifications.length > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {notifications.length}
          </div>
        )}
      </button>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute bottom-16 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 w-80">
          <h3 className="text-white font-semibold mb-4">Notification Settings</h3>
          
          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Stock Alerts</span>
              <input
                type="checkbox"
                checked={settings.stockAlerts}
                onChange={(e) => updateSettings({ stockAlerts: e.target.checked })}
                className="rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Price Changes</span>
              <input
                type="checkbox"
                checked={settings.priceChanges}
                onChange={(e) => updateSettings({ priceChanges: e.target.checked })}
                className="rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-sm">
              <span className="text-gray-300">New Conversations</span>
              <input
                type="checkbox"
                checked={settings.newConversations}
                onChange={(e) => updateSettings({ newConversations: e.target.checked })}
                className="rounded"
              />
            </label>
            
            <div className="pt-2 border-t border-gray-700">
              <label className="flex items-center justify-between text-sm">
                <span className="text-gray-300">Low Stock Threshold</span>
                <input
                  type="number"
                  value={settings.lowStockThreshold}
                  onChange={(e) => updateSettings({ lowStockThreshold: parseInt(e.target.value) || 5 })}
                  className="w-16 px-2 py-1 bg-gray-700 text-white rounded"
                  min="1"
                />
              </label>
            </div>
          </div>

          {realtimeService.isNotificationSupported() && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={requestPermission}
                className="w-full bg-yellow-400 text-black px-3 py-2 rounded text-sm font-medium hover:bg-yellow-300 transition-colors"
              >
                Enable Browser Notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notification Toasts */}
      {notifications.map(({ id, event }) => (
        <NotificationToast
          key={id}
          id={id}
          event={event}
          onClose={() => removeNotification(id)}
        />
      ))}
    </div>
  )
}
