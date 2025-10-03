// utils/storage.js

const isBrowser = typeof window !== "undefined";

export const storage = {
  get(key, fallback = null) {
    if (!isBrowser) return fallback;
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    if (!isBrowser) return;
    try {
      localStorage.set(key, JSON.stringify(value));
    } catch (err) {
      console.error("localStorage set error:", err);
    }
  },

  remove(key) {
    if (!isBrowser) return;
    localStorage.removeItem(key);
  },

  clear() {
    if (!isBrowser) return;
    localStorage.clear();
  },
};
