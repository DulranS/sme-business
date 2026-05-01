    import { configureStore } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import inventorySlice from './slices/inventorySlice'
import conversationsSlice from './slices/conversationsSlice'
import analyticsSlice from './slices/analyticsSlice'
import uiSlice from './slices/uiSlice'
import leadsSlice from './slices/leadsSlice'

// Persist configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['inventory', 'conversations', 'analytics', 'ui', 'leads'], // Only persist these slices
  blacklist: [] // Don't persist these slices
}

// Create the store
export const store = configureStore({
  reducer: {
    inventory: persistReducer({ ...persistConfig, key: 'inventory' }, inventorySlice),
    conversations: persistReducer({ ...persistConfig, key: 'conversations' }, conversationsSlice),
    analytics: persistReducer({ ...persistConfig, key: 'analytics' }, analyticsSlice),
    ui: persistReducer({ ...persistConfig, key: 'ui' }, uiSlice),
    leads: persistReducer({ ...persistConfig, key: 'leads' }, leadsSlice),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

// Persistor for redux-persist
export const persistor = persistStore(store)

// Types
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Export hooks for typed usage
export { useDispatch, useSelector } from 'react-redux'