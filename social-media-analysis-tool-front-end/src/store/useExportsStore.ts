import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ExportType = "pdf" | "comments_csv" | "categories_csv";

export interface ExportRecord {
  id: string; // uuid
  type: ExportType;
  name: string; // display name
  filename: string;
  mime: string;
  size: number; // bytes
  createdAt: string; // ISO string
  dataUrl: string; // data:...;base64,...
}

interface ExportsState {
  exports: ExportRecord[];
  addExport: (e: ExportRecord) => void;
  removeExport: (id: string) => void;
  clearExports: () => void;
}

export const useExportsStore = create<ExportsState>()(
  persist(
    (set, get) => ({
      exports: [],
      addExport: (e) => set({ exports: [e, ...get().exports] }),
      removeExport: (id) =>
        set({ exports: get().exports.filter((x) => x.id !== id) }),
      clearExports: () => set({ exports: [] }),
    }),
    {
      name: "exports-store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ exports: state.exports }),
    }
  )
);
