import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SettingsState {
  graph_api_key: string;
  page: string;
  setSettings: (data: { graph_api_key: string; page: string }) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      graph_api_key: "",
      page: "",
      setSettings: ({ graph_api_key, page }) => set({ graph_api_key, page }),
      reset: () => set({ graph_api_key: "", page: "" }),
    }),
    {
      name: "settings-store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        graph_api_key: state.graph_api_key,
        page: state.page,
      }),
    }
  )
);
