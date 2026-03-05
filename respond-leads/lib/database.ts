import { createSupabaseServerClient } from './supabase'
import { InventoryItem, Conversation } from '@/types'
import { handleDatabaseError } from './errors'
import { Validator, Sanitizer } from './validation'
import { logger } from './logger'

export class DatabaseService {
  private supabase = createSupabaseServerClient()

  // Inventory operations
  async getInventoryItems(search?: string): Promise<InventoryItem[]> {
    try {
      logger.database('Fetching inventory items', { search })
      
      let query = this.supabase
        .from('inventory')
        .select('*')
        .order('name')

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }

      const { data, error } = await query

      if (error) throw handleDatabaseError(error)
      
      logger.database('Successfully fetched inventory items', { count: data?.length })
      return data || []
    } catch (error) {
      logger.error('Failed to fetch inventory items', { search }, error as Error)
      throw error
    }
  }

  async getInventoryItemById(id: number): Promise<InventoryItem | null> {
    try {
      logger.database('Fetching inventory item', { id })
      
      const { data, error } = await this.supabase
        .from('inventory')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw handleDatabaseError(error)
      }

      logger.database('Successfully fetched inventory item', { id })
      return data
    } catch (error) {
      logger.error('Failed to fetch inventory item', { id }, error as Error)
      throw error
    }
  }

  async getInventoryItemBySku(sku: string): Promise<InventoryItem | null> {
    try {
      logger.database('Fetching inventory item by SKU', { sku })
      
      const { data, error } = await this.supabase
        .from('inventory')
        .select('*')
        .eq('sku', sku)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw handleDatabaseError(error)
      }

      logger.database('Successfully fetched inventory item by SKU', { sku })
      return data
    } catch (error) {
      logger.error('Failed to fetch inventory item by SKU', { sku }, error as Error)
      throw error
    }
  }

  async createInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>): Promise<InventoryItem> {
    try {
      const sanitizedItem = Sanitizer.inventoryItem(item)
      Validator.inventoryItem(sanitizedItem)

      logger.database('Creating inventory item', { sku: sanitizedItem.sku })
      
      const { data, error } = await this.supabase
        .from('inventory')
        .insert(sanitizedItem)
        .select()
        .single()

      if (error) throw handleDatabaseError(error)

      logger.database('Successfully created inventory item', { id: data.id, sku: data.sku })
      return data
    } catch (error) {
      logger.error('Failed to create inventory item', { item }, error as Error)
      throw error
    }
  }

  async updateInventoryItem(id: number, updates: Partial<Omit<InventoryItem, 'id' | 'created_at'>>): Promise<InventoryItem> {
    try {
      const sanitizedUpdates = Sanitizer.inventoryItem(updates)
      
      // Validate only the fields being updated
      if (sanitizedUpdates.name !== undefined) {
        Validator.string(sanitizedUpdates.name, 'Product name', 1, 200)
      }
      if (sanitizedUpdates.sku !== undefined) {
        Validator.sku(sanitizedUpdates.sku, 'SKU')
      }
      if (sanitizedUpdates.price !== undefined) {
        Validator.price(sanitizedUpdates.price, 'Price')
      }
      if (sanitizedUpdates.quantity !== undefined) {
        Validator.quantity(sanitizedUpdates.quantity, 'Quantity')
      }

      logger.database('Updating inventory item', { id, updates: sanitizedUpdates })
      
      const { data, error } = await this.supabase
        .from('inventory')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw handleDatabaseError(error)

      logger.database('Successfully updated inventory item', { id, sku: data.sku })
      return data
    } catch (error) {
      logger.error('Failed to update inventory item', { id, updates }, error as Error)
      throw error
    }
  }

  async deleteInventoryItem(id: number): Promise<void> {
    try {
      logger.database('Deleting inventory item', { id })
      
      const { error } = await this.supabase
        .from('inventory')
        .delete()
        .eq('id', id)

      if (error) throw handleDatabaseError(error)

      logger.database('Successfully deleted inventory item', { id })
    } catch (error) {
      logger.error('Failed to delete inventory item', { id }, error as Error)
      throw error
    }
  }

  async searchInventory(keyword: string, limit: number = 5): Promise<InventoryItem[]> {
    try {
      logger.database('Searching inventory', { keyword, limit })
      
      const { data, error } = await this.supabase
        .from('inventory')
        .select('*')
        .ilike('name', `%${keyword}%`)
        .limit(limit)

      if (error) throw handleDatabaseError(error)

      logger.database('Successfully searched inventory', { keyword, count: data?.length })
      return data || []
    } catch (error) {
      logger.error('Failed to search inventory', { keyword }, error as Error)
      throw error
    }
  }

  // Conversation operations
  async getConversations(): Promise<Conversation[]> {
    try {
      const { data, error } = await this.supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) throw handleDatabaseError(error)

      return data || []
    } catch (error) {
      logger.error('Failed to fetch conversations', {}, error as Error)
      throw error
    }
  }

  async getConversationByPhoneNumber(phoneNumber: string): Promise<Conversation | null> {
    try {
      logger.database('Fetching conversation by phone number', { phoneNumber })
      
      const { data, error } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw handleDatabaseError(error)
      }

      logger.database('Successfully fetched conversation by phone number', { phoneNumber })
      return data
    } catch (error) {
      logger.error('Failed to fetch conversation by phone number', { phoneNumber }, error as Error)
      throw error
    }
  }

  async upsertConversation(conversation: Omit<Conversation, 'id' | 'created_at'>): Promise<Conversation> {
    try {
      const sanitizedConversation = {
        phone_number: Sanitizer.phoneNumber(conversation.phone_number),
        customer_name: Sanitizer.string(conversation.customer_name),
        history: Sanitizer.string(conversation.history).slice(0, 4000),
        updated_at: new Date().toISOString()
      }

      Validator.conversationHistory(sanitizedConversation.history)

      logger.database('Upserting conversation', { phoneNumber: sanitizedConversation.phone_number })
      
      const { data, error } = await this.supabase
        .from('conversations')
        .upsert(sanitizedConversation, {
          onConflict: 'phone_number'
        })
        .select()
        .single()

      if (error) throw handleDatabaseError(error)

      logger.database('Successfully upserted conversation', { id: data.id, phoneNumber: data.phone_number })
      return data
    } catch (error) {
      logger.error('Failed to upsert conversation', { conversation }, error as Error)
      throw error
    }
  }

  // Statistics
  async getInventoryStats() {
    try {
      const { data, error } = await this.supabase
        .from('inventory_stats')
        .select('*')
        .single()

      if (error) throw handleDatabaseError(error)

      return data
    } catch (error) {
      logger.error('Failed to fetch inventory statistics', {}, error as Error)
      throw error
    }
  }

  async getLowStockItems() {
    try {
      const { data, error } = await this.supabase
        .from('low_inventory_items')
        .select('*')

      if (error) throw handleDatabaseError(error)

      return data || []
    } catch (error) {
      logger.error('Failed to fetch low stock items', {}, error as Error)
      throw error
    }
  }
}

// Singleton instance
export const databaseService = new DatabaseService()
