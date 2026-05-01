import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Lead } from '../../types'
import { leadManagementService } from '../lead-management'

interface LeadsState {
  leads: Lead[]
  loading: boolean
  error: string | null
  analytics: any | null
  filters: {
    status: string
    minScore: string
    priority: string
  }
  stats: {
    totalLeads: number
    qualifiedLeads: number
    conversionRate: number
    averageLeadScore: number
    totalConversionValue: number
  }
}

const initialState: LeadsState = {
  leads: [],
  loading: false,
  error: null,
  analytics: null,
  filters: {
    status: '',
    minScore: '',
    priority: '',
  },
  stats: {
    totalLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0,
    averageLeadScore: 0,
    totalConversionValue: 0,
  },
}

// Async thunks
export const fetchLeads = createAsyncThunk(
  'leads/fetchLeads',
  async (filters: any = {}, { rejectWithValue }) => {
    try {
      const leads = await leadManagementService.getLeads(filters)
      return leads
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const fetchLeadAnalytics = createAsyncThunk(
  'leads/fetchAnalytics',
  async (timeframe: '7d' | '30d' | '90d' = '30d', { rejectWithValue }) => {
    try {
      const analytics = await leadManagementService.getLeadAnalytics(timeframe)
      return analytics
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const updateLeadStatus = createAsyncThunk(
  'leads/updateStatus',
  async ({ conversationId, updates }: { conversationId: number; updates: any }, { rejectWithValue }) => {
    try {
      await leadManagementService.updateLeadStatus(conversationId, updates)
      return { conversationId, updates }
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

const leadsSlice = createSlice({
  name: 'leads',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<LeadsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },
    clearFilters: (state) => {
      state.filters = initialState.filters
    },
    clearError: (state) => {
      state.error = null
    },
    updateLeadOptimistic: (state, action: PayloadAction<Lead>) => {
      const index = state.leads.findIndex(lead => lead.id === action.payload.id)
      if (index !== -1) {
        state.leads[index] = action.payload
        leadsSlice.caseReducers.updateStats(state)
      }
    },
    updateStats: (state) => {
      const leads = state.leads
      state.stats = {
        totalLeads: leads.length,
        qualifiedLeads: leads.filter(l => l.status === 'qualified').length,
        conversionRate: leads.length > 0 ? (leads.filter(l => l.status === 'converted').length / leads.length) * 100 : 0,
        averageLeadScore: leads.length > 0 ? leads.reduce((sum, l) => sum + l.lead_score, 0) / leads.length : 0,
        totalConversionValue: leads
          .filter(l => l.status === 'converted')
          .reduce((sum, l) => sum + (l.estimated_value || 0), 0),
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch leads
      .addCase(fetchLeads.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loading = false
        state.leads = action.payload
        leadsSlice.caseReducers.updateStats(state)
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Fetch analytics
      .addCase(fetchLeadAnalytics.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLeadAnalytics.fulfilled, (state, action) => {
        state.loading = false
        state.analytics = action.payload
        // Update stats from analytics
        state.stats = {
          totalLeads: action.payload.totalLeads,
          qualifiedLeads: action.payload.qualifiedLeads,
          conversionRate: action.payload.conversionRate,
          averageLeadScore: action.payload.averageLeadScore,
          totalConversionValue: action.payload.totalConversionValue,
        }
      })
      .addCase(fetchLeadAnalytics.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Update lead status
      .addCase(updateLeadStatus.fulfilled, (state, action) => {
        // Refresh leads after status update
        // This will be handled by refetching in the component
      })
  },
})

export const { setFilters, clearFilters, clearError, updateLeadOptimistic, updateStats } = leadsSlice.actions
export default leadsSlice.reducer