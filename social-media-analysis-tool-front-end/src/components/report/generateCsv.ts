import { useAnalysisStore } from "@/store/useAnalysisStore";
import { useExportsStore } from "@/store/useExportsStore";

// Escape a value for CSV (handles quotes, commas, and newlines)
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCommentsCsv(): string {
  const { comments_analyzed } = useAnalysisStore.getState();
  const lines: string[] = [];
  lines.push(
    [
      "comment_id",
      "created_time",
      "sentiment",
      "sentiment_conf",
      "category",
      "category_conf",
      "text",
    ]
      .map(csvEscape)
      .join(",")
  );
  for (const c of comments_analyzed) {
    lines.push(
      [
        c.comment_id,
        c.created_time ?? "",
        c.sentiment,
        typeof c.sentiment_conf === "number" ? c.sentiment_conf.toFixed(4) : "",
        c.category,
        typeof c.category_conf === "number" ? c.category_conf.toFixed(4) : "",
        c.text,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return "\uFEFF" + lines.join("\n");
}

function buildCategoriesCsv(): string {
  const { analytics } = useAnalysisStore.getState();
  const lines: string[] = [];
  lines.push(
    [
      "category",
      "total_comments",
      "positive_comments",
      "neutral_comments",
      "negative_comments",
    ]
      .map(csvEscape)
      .join(",")
  );
  for (const c of analytics?.categories_stats ?? []) {
    lines.push(
      [
        c.category,
        c.total_comments,
        c.positive_comments,
        c.neutral_comments,
        c.negative_comments,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return "\uFEFF" + lines.join("\n");
}

async function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function generateCommentsCsv(): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const csv = buildCommentsCsv();
  const filename = `comments-export-${ts}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const objectUrl = URL.createObjectURL(blob);

  // Persist to store for later re-download
  const dataUrl = await toDataUrl(blob);
  useExportsStore.getState().addExport({
    id: crypto.randomUUID(),
    type: "comments_csv",
    name: "Comments Export",
    filename,
    mime: "text/csv",
    size: blob.size,
    createdAt: new Date().toISOString(),
    dataUrl,
  });

  // Instant download now
  triggerDownload(objectUrl, filename);
  URL.revokeObjectURL(objectUrl);
}

export async function generateCategoriesCsv(): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const csv = buildCategoriesCsv();
  const filename = `categories-export-${ts}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const objectUrl = URL.createObjectURL(blob);

  // Persist to store for later re-download
  const dataUrl = await toDataUrl(blob);
  useExportsStore.getState().addExport({
    id: crypto.randomUUID(),
    type: "categories_csv",
    name: "Categories Export",
    filename,
    mime: "text/csv",
    size: blob.size,
    createdAt: new Date().toISOString(),
    dataUrl,
  });

  // Instant download now
  triggerDownload(objectUrl, filename);
  URL.revokeObjectURL(objectUrl);
}
