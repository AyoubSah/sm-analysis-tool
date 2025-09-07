import { create } from "zustand";
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

export const useAnalysisStore = create<AnalysisState>((set) => ({
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
}));
