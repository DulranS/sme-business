
import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const ADMIN_USERNAME = 'sithiraxx';
const ADMIN_PASSWORD = 'sithiraautoparts248';

export const useAuth = create<AuthState>((set) => ({
  isAuthenticated: false,
  login: (username: string, password: string) => {
    const isValid = username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
    if (isValid) {
      set({ isAuthenticated: true });
    }
    return isValid;
  },
  logout: () => set({ isAuthenticated: false }),
}));
