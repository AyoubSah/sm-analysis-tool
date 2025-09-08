import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import DashboardCard from "@/components/DashboardCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  PieChartCard,
  BarChartCard,
  LineChartCard,
} from "@/components/charts/Charts";
import { StatCard } from "@/components/StatCard";
import { useScrapeAnalyze } from "@/hooks/useScrapeAnalyze";
import { useAnalyzeCsvUpload } from "@/hooks/useAnalyzeCsv";
import { generateReport } from "@/lib/generateReport";
import {
  // generateCategoriesCsv,
  generateCommentsCsv,
} from "@/components/report/generateCsv";
import type {
  ScrapeAnalyzeRequest,
  CommentAnalysis,
} from "@/hooks/useScrapeAnalyze";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import * as Papa from "papaparse";
import { toast } from "sonner";

export default function Dashboard() {
  const [formData, setFormData] = useState({
    graph_api_key: "",
    page: "",
    max_posts: "",
    max_comments: "",
    since: "",
    until: "",
  });

  const { mutate: analyzeComments, isPending, error } = useScrapeAnalyze();
  const {
    mutate: analyzeCsv,
    isPending: isCsvPending,
    error: csvError,
  } = useAnalyzeCsvUpload();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingCommentsCsv, setIsGeneratingCommentsCsv] = useState(false);
  // const [isGeneratingCategoriesCsv, setIsGeneratingCategoriesCsv] = useState(false);
  const setAnalysis = useAnalysisStore((s) => s.setAnalysis);
  const analytics = useAnalysisStore((s) => s.analytics);
  const comments_analyzed = useAnalysisStore((s) => s.comments_analyzed);
  // CSV local state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvValid, setCsvValid] = useState(false);
  const [csvIssues, setCsvIssues] = useState<string[]>([]);
  // Initialize form with settings when component mounts (run once)
  useEffect(() => {
    const { graph_api_key, page } = useSettingsStore.getState();
    setFormData((prev) => ({
      ...prev,
      graph_api_key: prev.graph_api_key || graph_api_key || "",
      page: prev.page || page || "",
    }));
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Create payload with required fields
    const payload: ScrapeAnalyzeRequest = {
      graph_api_key: formData.graph_api_key,
      page: formData.page,
    };

    // Add optional fields if they have values
    if (formData.max_posts) {
      payload.max_posts = parseInt(formData.max_posts);
    }
    if (formData.max_comments) {
      payload.max_comments = parseInt(formData.max_comments);
    }
    if (formData.since) {
      payload.since = formData.since;
    }
    if (formData.until) {
      payload.until = formData.until;
    }

    analyzeComments(payload, {
      onSuccess: (data) => {
        setAnalysis(data);
        toast.success("Ingestion started", {
          description: "Data fetched and analyzed successfully.",
        });
      },
      onError: (err) => {
        toast.error("Analysis failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      },
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateCsvFile = async (file: File) => {
    return new Promise<{ valid: boolean; issues: string[] }>((resolve) => {
      const issues: string[] = [];
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        preview: 1000, // limit for validation
        complete: (results: Papa.ParseResult<Record<string, string>>) => {
          const data = results.data;
          const meta = results.meta;
          const fields = (meta.fields || []).map((f: string) =>
            f.trim().toLowerCase()
          );

          // Accept two formats: with header (id,comment[,created_time]) OR single column without header
          const hasHeader = fields.includes("comment");
          if (!hasHeader) {
            // Try parsing without header: first column is comment
            Papa.parse<string[]>(file, {
              header: false,
              skipEmptyLines: true,
              preview: 1000,
              complete: (res2: Papa.ParseResult<string[]>) => {
                const rows = res2.data as string[][];
                if (!rows.length) {
                  issues.push("CSV has no rows.");
                }
                let validRowCount = 0;
                rows.forEach((row, idx) => {
                  const first = (Array.isArray(row) ? row[0] : String(row))
                    ?.toString()
                    ?.trim();
                  if (!first) {
                    issues.push(`Row ${idx + 1}: empty first column.`);
                  } else {
                    validRowCount++;
                  }
                });
                if (validRowCount === 0) {
                  issues.push("No valid comments found in first column.");
                }
                resolve({ valid: issues.length === 0, issues });
              },
              error: () => {
                issues.push("Failed to parse CSV without header.");
                resolve({ valid: false, issues });
              },
            });
            return;
          }

          // Header present: must have 'comment' column; 'id' and 'created_time' optional
          if (!fields.includes("comment")) {
            issues.push("Missing required 'comment' column.");
          }
          const sample = data as Record<string, string>[];
          let validRowCount = 0;
          sample.forEach((row, idx) => {
            const comment = (row["comment"] ?? "").toString().trim();
            if (!comment) {
              issues.push(`Row ${idx + 2}: empty comment.`); // +2 accounts for header
            } else {
              validRowCount++;
            }
          });
          if (validRowCount === 0) {
            issues.push("No valid comments found.");
          }
          resolve({ valid: issues.length === 0, issues });
        },
        error: () =>
          resolve({ valid: false, issues: ["Failed to parse CSV."] }),
      });
    });
  };

  // Transform store data for charts
  const sentimentData = analytics
    ? [
        { name: "Positive", value: analytics.positive_comments },
        { name: "Neutral", value: analytics.neutral_comments },
        { name: "Negative", value: analytics.negative_comments },
      ]
    : [];

  const trendingData = analytics
    ? analytics.categories_stats.map((cat) => ({
        topic: cat.category,
        count: cat.total_comments,
      }))
    : [];

  // Group comments by month for timeline
  const timeline = comments_analyzed.reduce<
    Record<
      string,
      { name: string; positive: number; neutral: number; negative: number }
    >
  >((acc, comment) => {
    // Get the month from comment creation time
    const date = comment.created_time
      ? new Date(comment.created_time)
      : new Date();
    const month = date.toLocaleString("default", { month: "short" });
    const year = date.getFullYear();
    const key = `${month} ${year}`;

    if (!acc[key]) {
      acc[key] = { name: key, positive: 0, neutral: 0, negative: 0 };
    }

    const sentiment = comment.sentiment.toLowerCase();
    if (
      sentiment === "positive" ||
      sentiment === "neutral" ||
      sentiment === "negative"
    ) {
      acc[key][sentiment] += 1;
    }

    return acc;
  }, {});

  const timelineData = Object.values(timeline).sort(
    (a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()
  );

  return (
    <div className="p-6 space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Comments"
          value={analytics?.total_comments ?? 0}
          helpText="Total processed"
        />
        <StatCard
          label="Positive"
          value={analytics?.positive_comments ?? 0}
          helpText={`${
            analytics
              ? Math.round(
                  (analytics.positive_comments / analytics.total_comments) * 100
                )
              : 0
          }%`}
        />
        <StatCard
          label="Neutral"
          value={analytics?.neutral_comments ?? 0}
          helpText={`${
            analytics
              ? Math.round(
                  (analytics.neutral_comments / analytics.total_comments) * 100
                )
              : 0
          }%`}
        />
        <StatCard
          label="Negative"
          value={analytics?.negative_comments ?? 0}
          helpText={`${
            analytics
              ? Math.round(
                  (analytics.negative_comments / analytics.total_comments) * 100
                )
              : 0
          }%`}
        />
      </div>

      <DashboardCard title="Data Ingestion">
        <p className="text-sm text-muted-foreground">
          Provide credentials or upload a CSV to simulate ingestion. (This is
          sample UI only.)
        </p>
        <form
          onSubmit={handleSubmit}
          className="grid md:grid-cols-2 gap-4 pt-4"
        >
          <div className="space-y-3">
            <Input
              placeholder="Access Token"
              value={formData.graph_api_key}
              onChange={(e) =>
                handleInputChange("graph_api_key", e.target.value)
              }
              required
            />
            <Input
              placeholder="Page ID or URL"
              value={formData.page}
              onChange={(e) => handleInputChange("page", e.target.value)}
              required
            />
            <Input
              type="number"
              placeholder="Max Posts (optional)"
              value={formData.max_posts}
              onChange={(e) => handleInputChange("max_posts", e.target.value)}
              min={1}
            />
            <Input
              type="number"
              placeholder="Max Comments (optional)"
              value={formData.max_comments}
              onChange={(e) =>
                handleInputChange("max_comments", e.target.value)
              }
              min={1}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                placeholder="Since Date"
                value={formData.since}
                onChange={(e) => handleInputChange("since", e.target.value)}
              />
              <Input
                type="date"
                placeholder="Until Date"
                value={formData.until}
                onChange={(e) => handleInputChange("until", e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Analyzing..." : "Analyze Data"}
            </Button>
            {error && (
              <p className="text-sm text-red-500">
                Error:{" "}
                {error instanceof Error ? error.message : "Failed to analyze"}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              placeholder="Upload CSV"
              onChange={async (e) => {
                const file = e.target.files?.[0] || null;
                setCsvFile(file);
                setCsvValid(false);
                setCsvIssues([]);
                if (file) {
                  const { valid, issues } = await validateCsvFile(file);
                  setCsvValid(valid);
                  setCsvIssues(issues);
                  if (valid) {
                    toast.success("CSV validated", {
                      description: `${file.name} looks good.`,
                    });
                  } else {
                    toast.error("CSV validation failed", {
                      description: issues[0] || "Please check the file.",
                    });
                  }
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              CSV must be either single-column (first column = comment) or have
              headers: id, comment[, created_time]. We'll validate before
              ingesting.
            </p>
            {csvIssues.length > 0 && (
              <ul className="text-xs text-red-500 list-disc pl-5 space-y-1 max-h-24 overflow-auto">
                {csvIssues.slice(0, 6).map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
                {csvIssues.length > 6 && <li>…and more</li>}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                if (!csvFile) return;
                const { valid, issues } = await validateCsvFile(csvFile);
                setCsvValid(valid);
                setCsvIssues(issues);
                if (valid) {
                  toast.success("CSV validated", {
                    description: `${csvFile.name} is valid.`,
                  });
                } else {
                  toast.error("CSV validation failed", {
                    description: issues[0] || "Please fix the CSV and retry.",
                  });
                }
              }}
              disabled={!csvFile}
            >
              {csvFile ? "Re-validate CSV" : "Validate CSV"}
            </Button>
            <Button
              type="button"
              className="w-full"
              variant="secondary"
              disabled={!csvFile || !csvValid || isCsvPending}
              onClick={() => {
                if (!csvFile || !csvValid) return;
                analyzeCsv(
                  { file: csvFile, batch_size: 32 },
                  {
                    onSuccess: (data) => {
                      setAnalysis(data);
                      toast.success("CSV ingested", {
                        description: `${csvFile.name} processed successfully.`,
                      });
                    },
                    onError: (err) =>
                      toast.error("CSV ingestion failed", {
                        description:
                          err instanceof Error ? err.message : "Unknown error",
                      }),
                  }
                );
              }}
            >
              {isCsvPending
                ? "Ingesting…"
                : csvValid
                ? "Ingest File"
                : "Fix CSV to Ingest"}
            </Button>
            {csvError && (
              <p className="text-xs text-red-500">
                Error:{" "}
                {csvError instanceof Error
                  ? csvError.message
                  : "Failed to ingest CSV"}
              </p>
            )}
          </div>
        </form>
      </DashboardCard>

      <div className="grid gap-6 md:grid-cols-2">
        <PieChartCard
          title="Sentiment Share"
          data={sentimentData}
          description="Relative distribution of sentiments."
        />
        <BarChartCard
          title="Trending Topics"
          data={trendingData}
          dataKey="count"
          categoryKey="topic"
          description="Most discussed categories."
        />
      </div>

      <DashboardCard title="Recent Comments Analysis">
        <ul className="text-sm space-y-2">
          {comments_analyzed.slice(0, 5).map((comment: CommentAnalysis) => (
            <li key={comment.comment_id}>
              <strong>
                {comment.category} ({Math.round(comment.category_conf * 100)}
                %):
              </strong>{" "}
              {comment.text}{" "}
              <span className="text-xs text-muted-foreground">
                Sentiment: {comment.sentiment} (
                {Math.round(comment.sentiment_conf * 100)}%) -{" "}
                {comment.created_time
                  ? new Date(comment.created_time).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "No date"}
              </span>
            </li>
          ))}
          {!comments_analyzed.length && (
            <li className="text-muted-foreground">No comments analyzed yet.</li>
          )}
        </ul>
      </DashboardCard>

      {/* Hidden charts for PDF generation */}
      <div className="hidden">
        <div id="sentiment-distribution">
          <PieChartCard
            title="Sentiment Distribution"
            data={sentimentData}
            description="Overall share of classified sentiments."
          />
        </div>
        <div id="sentiment-timeline">
          <LineChartCard
            title="Sentiment Timeline"
            description="Monthly sentiment trends."
            data={timelineData}
            lines={[
              { key: "positive", stroke: "#10b981" },
              { key: "neutral", stroke: "#6b7280" },
              { key: "negative", stroke: "#ef4444" },
            ]}
          />
        </div>
        <div id="topic-distribution">
          <BarChartCard
            title="Topic Distribution"
            data={trendingData}
            dataKey="count"
            categoryKey="topic"
            description="Total mentions per topic"
          />
        </div>
        <div id="category-sentiments" className="grid grid-cols-3 gap-8">
          {analytics?.categories_stats.slice(0, 6).map((cat) => (
            <BarChartCard
              key={cat.category}
              title={cat.category}
              data={[
                { sentiment: "Positive", count: cat.positive_comments },
                { sentiment: "Neutral", count: cat.neutral_comments },
                { sentiment: "Negative", count: cat.negative_comments },
              ]}
              dataKey="count"
              categoryKey="sentiment"
              description={`Sentiment breakdown for ${cat.category}`}
              colorMap={{
                Positive: "#10b981",
                Neutral: "#6b7280",
                Negative: "#ef4444",
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          size="sm"
          onClick={async () => {
            if (!analytics || isGeneratingPdf) return;
            setIsGeneratingPdf(true);
            try {
              await generateReport();
              toast.success("PDF generated", {
                description: "Report downloaded and saved to Reports.",
              });
            } catch (err) {
              toast.error("PDF generation failed", {
                description:
                  err instanceof Error ? err.message : "Unknown error",
              });
            } finally {
              setIsGeneratingPdf(false);
            }
          }}
          disabled={!analytics || isGeneratingPdf}
        >
          {isGeneratingPdf ? "Preparing PDF…" : "Download PDF"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            if (!analytics || isGeneratingCommentsCsv) return;
            setIsGeneratingCommentsCsv(true);
            try {
              await generateCommentsCsv();
              toast.success("CSV exported", {
                description: "Comments CSV downloaded and saved to Reports.",
              });
            } catch (err) {
              toast.error("CSV export failed", {
                description:
                  err instanceof Error ? err.message : "Unknown error",
              });
            } finally {
              setIsGeneratingCommentsCsv(false);
            }
          }}
          disabled={!analytics || isGeneratingCommentsCsv}
        >
          {isGeneratingCommentsCsv ? "Preparing CSV…" : "Export CSV"}
        </Button>
        {/* <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            if (!analytics || isGeneratingCategoriesCsv) return;
            setIsGeneratingCategoriesCsv(true);
            try {
              await generateCategoriesCsv();
            } finally {
              setIsGeneratingCategoriesCsv(false);
            }
          }}
          disabled={!analytics || isGeneratingCategoriesCsv}
        >
          {isGeneratingCategoriesCsv
            ? "Preparing Categories CSV…"
            : "Export Categories CSV"}
        </Button> */}
      </div>
    </div>
  );
}
