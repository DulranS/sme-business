import { getSupabaseClient } from './supabase'
import { logger } from './logger'

export interface RealtimeEvent {
  type: 'inventory_update' | 'new_conversation' | 'stock_alert' | 'price_change'
  data: any
  timestamp: Date
}

export interface NotificationSettings {
  stockAlerts: boolean
  priceChanges: boolean
  newConversations: boolean
  lowStockThreshold: number
}

export class RealtimeService {
  private supabase = getSupabaseClient()
  
  private subscribers: Map<string, (event: RealtimeEvent) => void> = new Map()
  private notificationSettings: NotificationSettings = {
    stockAlerts: true,
    priceChanges: true,
    newConversations: true,
    lowStockThreshold: 5
  }

  constructor() {
    this.setupRealtimeListeners()
  }

  private setupRealtimeListeners() {
    // Listen to inventory changes
    const inventoryChannel = this.supabase
      .channel('inventory_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'inventory' },
        (payload) => {
          this.handleInventoryChange(payload)
        }
      )
      .subscribe()

    // Listen to conversation changes
    const conversationChannel = this.supabase
      .channel('conversation_changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          this.handleNewConversation(payload)
        }
      )
      .subscribe()

    logger.info('Realtime listeners initialized')
  }

  private handleInventoryChange(payload: any) {
    const { eventType, new: newRecord, old: oldRecord } = payload

    if (eventType === 'UPDATE') {
      // Check for stock alerts
      if (this.notificationSettings.stockAlerts) {
        const oldQty = oldRecord?.quantity || 0
        const newQty = newRecord?.quantity || 0
        
        if (newQty <= this.notificationSettings.lowStockThreshold && oldQty > this.notificationSettings.lowStockThreshold) {
          this.notify({
            type: 'stock_alert',
            data: {
              item: newRecord,
              oldQuantity: oldQty,
              newQuantity: newQty,
              threshold: this.notificationSettings.lowStockThreshold
            },
            timestamp: new Date()
          })
        }

        // Check for out of stock
        if (newQty === 0 && oldQty > 0) {
          this.notify({
            type: 'stock_alert',
            data: {
              item: newRecord,
              oldQuantity: oldQty,
              newQuantity: newQty,
              message: 'Item is now out of stock'
            },
            timestamp: new Date()
          })
        }
      }

      // Check for price changes
      if (this.notificationSettings.priceChanges && oldRecord?.price !== newRecord?.price) {
        this.notify({
          type: 'price_change',
          data: {
            item: newRecord,
            oldPrice: oldRecord?.price,
            newPrice: newRecord?.price,
            currency: newRecord?.currency
          },
          timestamp: new Date()
        })
      }
    }

    // General inventory update
    this.notify({
      type: 'inventory_update',
      data: { event: payload },
      timestamp: new Date()
    })
  }

  private handleNewConversation(payload: any) {
    if (this.notificationSettings.newConversations) {
      this.notify({
        type: 'new_conversation',
        data: payload.new,
        timestamp: new Date()
      })
    }
  }

  subscribe(id: string, callback: (event: RealtimeEvent) => void) {
    this.subscribers.set(id, callback)
    return () => this.subscribers.delete(id)
  }

  private notify(event: RealtimeEvent) {
    this.subscribers.forEach(callback => {
      try {
        callback(event)
      } catch (error) {
        logger.error('Error in realtime subscriber callback', error as Error)
      }
    })

    // Also show browser notification if permission granted
    this.showBrowserNotification(event)
  }

  private async showBrowserNotification(event: RealtimeEvent) {
    if (!('Notification' in window)) return

    if (Notification.permission === 'granted') {
      const title = this.getNotificationTitle(event)
      const options = this.getNotificationOptions(event)
      
      new Notification(title, options)
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        this.showBrowserNotification(event)
      }
    }
  }

  private getNotificationTitle(event: RealtimeEvent): string {
    switch (event.type) {
      case 'stock_alert':
        return '📦 Stock Alert'
      case 'price_change':
        return '💰 Price Change'
      case 'new_conversation':
        return '💬 New Conversation'
      case 'inventory_update':
        return '🔄 Inventory Updated'
      default:
        return '🔔 Notification'
    }
  }

  private getNotificationOptions(event: RealtimeEvent): NotificationOptions {
    const baseOptions: NotificationOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: event.type
    }

    switch (event.type) {
      case 'stock_alert':
        return {
          ...baseOptions,
          body: event.data.message || `${event.data.item.name} is low in stock (${event.data.newQuantity} units remaining)`
        }
      case 'price_change':
        return {
          ...baseOptions,
          body: `${event.data.item.name} price changed from ${event.data.oldPrice} to ${event.data.newPrice} ${event.data.currency}`
        }
      case 'new_conversation':
        return {
          ...baseOptions,
          body: `New conversation from ${event.data.customer_name || 'Unknown Customer'}`
        }
      default:
        return {
          ...baseOptions,
          body: 'Inventory update received'
        }
    }
  }

  updateSettings(settings: Partial<NotificationSettings>) {
    this.notificationSettings = { ...this.notificationSettings, ...settings }
    logger.info('Notification settings updated', this.notificationSettings)
  }

  getSettings(): NotificationSettings {
    return { ...this.notificationSettings }
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  // Check if notifications are supported
  isNotificationSupported(): boolean {
    return 'Notification' in window
  }
}

export const realtimeService = new RealtimeService()
