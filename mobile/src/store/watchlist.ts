import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import type { SecurityRef } from "../api/client";

// SecureStore 适配器（自选股持久化到加密存储）
const secureStorage = {
  getItem: async (key: string) => {
    const v = await SecureStore.getItemAsync(key);
    return v ?? null;
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
};

export interface WatchItem extends SecurityRef {
  addedAt: number;
}

interface WatchlistState {
  items: WatchItem[];
  add: (s: SecurityRef) => void;
  remove: (secid: string) => void;
  toggle: (s: SecurityRef) => void;
  has: (secid: string) => boolean;
  clear: () => void;
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (s) =>
        set((state) => {
          if (state.items.some((i) => i.secid === s.secid)) return state;
          return { items: [{ ...s, addedAt: Date.now() }, ...state.items] };
        }),
      remove: (secid) =>
        set((state) => ({ items: state.items.filter((i) => i.secid !== secid) })),
      toggle: (s) =>
        set((state) => {
          const exists = state.items.some((i) => i.secid === s.secid);
          return exists
            ? { items: state.items.filter((i) => i.secid !== s.secid) }
            : { items: [{ ...s, addedAt: Date.now() }, ...state.items] };
        }),
      has: (secid) => get().items.some((i) => i.secid === secid),
      clear: () => set({ items: [] }),
    }),
    {
      name: "watchlist-v1",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
