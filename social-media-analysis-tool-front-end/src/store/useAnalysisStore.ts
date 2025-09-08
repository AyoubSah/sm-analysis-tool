import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ScrapeAnalyzeResponse,
  Analytics,
  CommentAnalysis,
} from "@/hooks/useScrapeAnalyze";

interface AnalysisState {
  page_id: string;
  analytics: Analytics | null;
  comments_analyzed: CommentAnalysis[];
  setAnalysis: (data: ScrapeAnalyzeResponse) => void;
  resetAnalysis: () => void;
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      page_id: "",
      analytics: null,
      comments_analyzed: [],
      setAnalysis: (data) =>
        set({
          page_id: data.page_id,
          analytics: data.analytics,
          comments_analyzed: data.comments_analyzed,
        }),
      resetAnalysis: () =>
        set({
          page_id: "",
          analytics: null,
          comments_analyzed: [],
        }),
    }),
    {
      name: "analysis-store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        page_id: state.page_id,
        analytics: state.analytics,
        comments_analyzed: state.comments_analyzed,
      }),
    }
  )
);
