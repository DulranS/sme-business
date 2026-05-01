import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UiState {
  activeTab: string
  sidebarOpen: boolean
  modalOpen: boolean
  modalType: string | null
  modalData: any
  toast: {
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
    visible: boolean
  }
  loadingStates: Record<string, boolean>
  theme: 'light' | 'dark'
  currency: string
  searchFilters: {
    inventory: string
    conversations: string
    leads: {
      status: string
      minScore: string
      priority: string
    }
  }
}

const initialState: UiState = {
  activeTab: 'inventory',
  sidebarOpen: true,
  modalOpen: false,
  modalType: null,
  modalData: null,
  toast: {
    message: '',
    type: 'info',
    visible: false,
  },
  loadingStates: {},
  theme: 'dark',
  currency: 'USD',
  searchFilters: {
    inventory: '',
    conversations: '',
    leads: {
      status: '',
      minScore: '',
      priority: '',
    },
  },
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    openModal: (state, action: PayloadAction<{ type: string; data?: any }>) => {
      state.modalOpen = true
      state.modalType = action.payload.type
      state.modalData = action.payload.data || null
    },
    closeModal: (state) => {
      state.modalOpen = false
      state.modalType = null
      state.modalData = null
    },
    showToast: (state, action: PayloadAction<{ message: string; type?: 'success' | 'error' | 'info' | 'warning' }>) => {
      state.toast = {
        message: action.payload.message,
        type: action.payload.type || 'info',
        visible: true,
      }
    },
    hideToast: (state) => {
      state.toast.visible = false
    },
    setLoadingState: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      state.loadingStates[action.payload.key] = action.payload.loading
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload
    },
    setCurrency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload
    },
    setSearchFilter: (state, action: PayloadAction<{ section: keyof UiState['searchFilters']; value: any }>) => {
      const { section, value } = action.payload
      if (section === 'leads') {
        state.searchFilters.leads = { ...state.searchFilters.leads, ...value }
      } else {
        (state.searchFilters as any)[section] = value
      }
    },
    clearSearchFilters: (state) => {
      state.searchFilters = initialState.searchFilters
    },
  },
})

export const {
  setActiveTab,
  toggleSidebar,
  setSidebarOpen,
  openModal,
  closeModal,
  showToast,
  hideToast,
  setLoadingState,
  setTheme,
  setCurrency,
  setSearchFilter,
  clearSearchFilters,
} = uiSlice.actions

export default uiSlice.reducer