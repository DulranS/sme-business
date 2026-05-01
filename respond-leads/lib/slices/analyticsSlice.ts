import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { AnalyticsMetrics } from '../../types'
import { analyticsService } from '../analytics'

interface AnalyticsState {
  metrics: AnalyticsMetrics | null
  loading: boolean
  error: string | null
  timeframe: '7d' | '30d' | '90d'
  inventoryInsights: any | null
  lastUpdated: string | null
}

const initialState: AnalyticsState = {
  metrics: null,
  loading: false,
  error: null,
  timeframe: '30d',
  inventoryInsights: null,
  lastUpdated: null,
}

// Async thunks
export const fetchAnalytics = createAsyncThunk(
  'analytics/fetchAnalytics',
  async (timeframe: '7d' | '30d' | '90d' = '30d', { rejectWithValue }) => {
    try {
      const metrics = await analyticsService.getMetrics(timeframe)
      return { metrics, timeframe }
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

export const fetchInventoryInsights = createAsyncThunk(
  'analytics/fetchInventoryInsights',
  async (_, { rejectWithValue }) => {
    try {
      const insights = await analyticsService.getInventoryInsights()
      return insights
    } catch (error) {
      return rejectWithValue((error as Error).message)
    }
  }
)

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setTimeframe: (state, action: PayloadAction<'7d' | '30d' | '90d'>) => {
      state.timeframe = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    updateMetricsOptimistic: (state, action: PayloadAction<Partial<AnalyticsMetrics>>) => {
      if (state.metrics) {
        state.metrics = { ...state.metrics, ...action.payload }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch analytics
      .addCase(fetchAnalytics.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAnalytics.fulfilled, (state, action) => {
        state.loading = false
        state.metrics = action.payload.metrics
        state.timeframe = action.payload.timeframe
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchAnalytics.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // Fetch inventory insights
      .addCase(fetchInventoryInsights.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchInventoryInsights.fulfilled, (state, action) => {
        state.loading = false
        state.inventoryInsights = action.payload
        state.lastUpdated = new Date().toISOString()
      })
      .addCase(fetchInventoryInsights.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export const { setTimeframe, clearError, updateMetricsOptimistic } = analyticsSlice.actions
export default analyticsSlice.reducer