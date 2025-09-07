import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";

interface ScrapeAnalyzeRequest {
  graph_api_key: string;
  page: string;
  max_posts?: number;
  max_comments?: number;
  since?: string;
  until?: string;
}

interface CommentAnalysis {
  comment_id: string;
  text: string;
  sentiment: string;
  sentiment_conf: number;
  category: string;
  category_conf: number;
  created_time?: string;
}

interface CategoryStats {
  category: string;
  total_comments: number;
  positive_comments: number;
  negative_comments: number;
  neutral_comments: number;
}

interface Analytics {
  total_comments: number;
  positive_comments: number;
  negative_comments: number;
  neutral_comments: number;
  categories_stats: CategoryStats[];
}

interface ScrapeAnalyzeResponse {
  page_id: string;
  comments_analyzed: CommentAnalysis[];
  analytics: Analytics;
}

const scrapeAnalyze = async (
  data: ScrapeAnalyzeRequest
): Promise<ScrapeAnalyzeResponse> => {
  const response = await fetch("http://localhost:8000/scrape-analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to analyze comments");
  }

  return response.json();
};

export const useScrapeAnalyze = (): UseMutationResult<
  ScrapeAnalyzeResponse,
  Error,
  ScrapeAnalyzeRequest,
  unknown
> => {
  return useMutation({
    mutationFn: scrapeAnalyze,
  });
};

export type {
  ScrapeAnalyzeRequest,
  ScrapeAnalyzeResponse,
  CommentAnalysis,
  Analytics,
  CategoryStats,
};
