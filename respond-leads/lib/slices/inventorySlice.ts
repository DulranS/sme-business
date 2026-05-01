import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { InventoryItem } from '../../types'
import { getSupabaseClient } from '../supabase'
import { inventoryCache } from '../cache'

interface InventoryState {
  items: InventoryItem[]
  loading: boolean
  error: string | null
  searchTerm: string
  selectedItem: InventoryItem | null
  stats: {
    totalValue: number
    totalItems: number
    lowStock: number
    outOfStock: number
  }
}

const initialState: InventoryState = {
  items: [],
  loading: false,
  error: null,
  searchTerm: '',
  selectedItem: null,
  stats: {
    totalValue: 0,
    totalItems: 0,
    lowStock: 0,
    outOfStock: 0,
  },
}

// Async thunks
export const fetchInventory = createAsyncThunk(
  'inventory/fetchInventory',
  async (searchTerm: string = '', { rejectWithValue }) => {
    try {
      const cacheKey = `inventory_search:${searchTerm.toLowerCase().trim()}`
      const cached = inventoryCache.get(cacheKey)
      if (cached && Array.isArray(cached)) {
        return { items: cached as InventoryItem[], searchTerm }
      }

      const supabase = getSupabaseClient()
      let query = supabase.from('inventory').select('*').order('name')

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`)
      }

      const { data, error } = await query
      if (error) throw error

      const items = data || []
      inventoryCache.set(cacheKey, items)

      return { items, searchTerm }
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const addInventoryItem = createAsyncThunk(
  'inventory/addItem',
  async (item: Omit<InventoryItem, 'id'>, { rejectWithValue }) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('inventory')
        .insert(item)
        .select()
        .single()

      if (error) throw error

      // Clear cache
      inventoryCache.clear()

      return data as InventoryItem
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const updateInventoryItem = createAsyncThunk(
  'inventory/updateItem',
  async ({ id, updates }: { id: number; updates: Partial<InventoryItem> }, { rejectWithValue }) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Clear cache
      inventoryCache.clear()

      return data as InventoryItem
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const deleteInventoryItem = createAsyncThunk(
  'inventory/deleteItem',
  async (id: number, { rejectWithValue }) => {
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Clear cache
      inventoryCache.clear()

      return id
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload
    },
    setSelectedItem: (state, action: PayloadAction<InventoryItem | null>) => {
      state.selectedItem = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    updateStats: (state) => {
      const items = state.items
      state.stats = {
        totalValue: items.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0),
        totalItems: items.length,
        lowStock: items.filter(item => item.quantity > 0 && item.quantity <= 10).length,
        outOfStock: items.filter(item => item.quantity === 0).length,
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch inventory
      .addCase(fetchInventory.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload.items
        state.searchTerm = action.payload.searchTerm
        inventorySlice.caseReducers.updateStats(state)
      })
      .addCase(fetchInventory.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Add item
      .addCase(addInventoryItem.fulfilled, (state, action) => {
        state.items.push(action.payload)
        inventorySlice.caseReducers.updateStats(state)
      })
      // Update item
      .addCase(updateInventoryItem.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
          inventorySlice.caseReducers.updateStats(state)
        }
      })
      // Delete item
      .addCase(deleteInventoryItem.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload)
        inventorySlice.caseReducers.updateStats(state)
      })
  },
})

export const { setSearchTerm, setSelectedItem, clearError, updateStats } = inventorySlice.actions
export default inventorySlice.reducer