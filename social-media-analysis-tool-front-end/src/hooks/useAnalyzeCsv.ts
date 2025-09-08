import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import type { ScrapeAnalyzeResponse } from "./useScrapeAnalyze";

export interface AnalyzeCsvUploadRequest {
  file: File;
  batch_size?: number;
}

const analyzeCsvUpload = async (
  data: AnalyzeCsvUploadRequest
): Promise<ScrapeAnalyzeResponse> => {
  const form = new FormData();
  form.append("file", data.file);
  form.append("batch_size", String(data.batch_size ?? 32));

  const response = await fetch("http://localhost:8000/analyze-csv", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Failed to analyze CSV");
  }

  return response.json();
};

export const useAnalyzeCsvUpload = (): UseMutationResult<
  ScrapeAnalyzeResponse,
  Error,
  AnalyzeCsvUploadRequest,
  unknown
> => {
  return useMutation({
    mutationFn: analyzeCsvUpload,
  });
};
