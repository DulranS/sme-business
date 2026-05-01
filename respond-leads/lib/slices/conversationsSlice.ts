import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Conversation } from '../../types'
import { getSupabaseClient } from '../supabase'
import { conversationCache } from '../cache'

interface ConversationsState {
  conversations: Conversation[]
  loading: boolean
  error: string | null
  selectedConversation: Conversation | null
  searchTerm: string
  stats: {
    totalConversations: number
    activeConversations: number
    qualifiedLeads: number
    convertedLeads: number
  }
}

const initialState: ConversationsState = {
  conversations: [],
  loading: false,
  error: null,
  selectedConversation: null,
  searchTerm: '',
  stats: {
    totalConversations: 0,
    activeConversations: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
  },
}

// Async thunks
export const fetchConversations = createAsyncThunk(
  'conversations/fetchConversations',
  async (_, { rejectWithValue }) => {
    try {
      const cacheKey = 'conversations:all'
      const cached = conversationCache.get(cacheKey)
      if (cached && Array.isArray(cached)) {
        return cached as Conversation[]
      }

      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) throw error

      const conversations = data || []
      conversationCache.set(cacheKey, conversations)

      return conversations
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const updateConversation = createAsyncThunk(
  'conversations/updateConversation',
  async ({ id, updates }: { id: number; updates: Partial<Conversation> }, { rejectWithValue }) => {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Clear cache
      conversationCache.clear()

      return data as Conversation
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    setSelectedConversation: (state, action: PayloadAction<Conversation | null>) => {
      state.selectedConversation = action.payload
    },
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    updateStats: (state) => {
      const conversations = state.conversations
      state.stats = {
        totalConversations: conversations.length,
        activeConversations: conversations.filter(c => {
          const updatedAt = new Date(c.updated_at || '')
          const oneDayAgo = new Date()
          oneDayAgo.setDate(oneDayAgo.getDate() - 1)
          return updatedAt > oneDayAgo
        }).length,
        qualifiedLeads: conversations.filter(c => c.lead_status === 'qualified').length,
        convertedLeads: conversations.filter(c => c.lead_status === 'converted').length,
      }
    },
    addConversation: (state, action: PayloadAction<Conversation>) => {
      state.conversations.unshift(action.payload)
      conversationsSlice.caseReducers.updateStats(state)
    },
    updateConversationOptimistic: (state, action: PayloadAction<Conversation>) => {
      const index = state.conversations.findIndex(c => c.id === action.payload.id)
      if (index !== -1) {
        state.conversations[index] = action.payload
        conversationsSlice.caseReducers.updateStats(state)
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch conversations
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false
        state.conversations = action.payload
        conversationsSlice.caseReducers.updateStats(state)
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Update conversation
      .addCase(updateConversation.fulfilled, (state, action) => {
        const index = state.conversations.findIndex(c => c.id === action.payload.id)
        if (index !== -1) {
          state.conversations[index] = action.payload
          conversationsSlice.caseReducers.updateStats(state)
        }
      })
  },
})

export const {
  setSelectedConversation,
  setSearchTerm,
  clearError,
  updateStats,
  addConversation,
  updateConversationOptimistic
} = conversationsSlice.actions
export default conversationsSlice.reducer