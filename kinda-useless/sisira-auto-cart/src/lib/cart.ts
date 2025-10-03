import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product: Product, quantity: number = 1) => {
        const currentItems = get().items;
        const existingItem = currentItems.find(item => item.product.id === product.id);

        if (existingItem) {
          set({
            items: currentItems.map(item => 
              item.product.id === product.id 
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          });
        } else {
          set({ items: [...currentItems, { product, quantity }] });
        }
      },

      removeItem: (productId: string) => {
        set({
          items: get().items.filter(item => item.product.id !== productId)
        });
      },

      updateQuantity: (productId: string, quantity: number) => {
        set({
          items: get().items.map(item => 
            item.product.id === productId 
              ? { ...item, quantity: Math.max(1, quantity) }
              : item
          )
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      totalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      totalPrice: () => {
        return get().items.reduce((total, item) => {
          // Calculate the discounted price for each item
          const discountedPrice = item.product.discountPercentage > 0 
            ? item.product.price * (1 - item.product.discountPercentage / 100) 
            : item.product.price;
      
          // Add the price for this item * quantity to the total
          return total + discountedPrice * item.quantity;
        }, 0);
      }
    }),
    {
      name: 'sisira-auto-cart'
    }
  )
);
