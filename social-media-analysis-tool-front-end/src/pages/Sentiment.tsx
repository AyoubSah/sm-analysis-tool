import { PieChartCard, LineChartCard } from "@/components/charts/Charts";
import { StatCard } from "@/components/StatCard";
import DashboardCard from "@/components/DashboardCard";
import { useAnalysisStore } from "@/store/useAnalysisStore";

interface TimelineData {
  name: string;
  positive: number;
  neutral: number;
  negative: number;
  [key: string]: string | number;
}

interface TimelineAccumulator {
  [key: string]: TimelineData;
}

export default function SentimentPage() {
  const analytics = useAnalysisStore((s) => s.analytics);
  const comments_analyzed = useAnalysisStore((s) => s.comments_analyzed);

  const sentimentDistribution = analytics
    ? [
        { name: "Positive", value: analytics.positive_comments },
        { name: "Neutral", value: analytics.neutral_comments },
        { name: "Negative", value: analytics.negative_comments },
      ]
    : [];

  // Group comments by month and calculate sentiment counts
  const timeline = comments_analyzed.reduce<TimelineAccumulator>(
    (acc, comment) => {
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
    },
    {}
  );

  const timelineData = Object.values(timeline).sort(
    (a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()
  );

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard
          label="Total Comments"
          value={analytics?.total_comments ?? 0}
          helpText="vs last month"
        />
        <StatCard
          label="Positive"
          value={analytics?.positive_comments ?? 0}
          helpText={
            analytics
              ? `${Math.round(
                  (analytics.positive_comments / analytics.total_comments) * 100
                )}% of total`
              : ""
          }
        />
        <StatCard
          label="Neutral"
          value={analytics?.neutral_comments ?? 0}
          helpText={
            analytics
              ? `${Math.round(
                  (analytics.neutral_comments / analytics.total_comments) * 100
                )}% of total`
              : ""
          }
        />
        <StatCard
          label="Negative"
          value={analytics?.negative_comments ?? 0}
          helpText={
            analytics
              ? `${Math.round(
                  (analytics.negative_comments / analytics.total_comments) * 100
                )}% of total`
              : ""
          }
        />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <PieChartCard
          title="Sentiment Distribution"
          data={sentimentDistribution}
          description="Overall share of classified sentiments."
        />
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
      <DashboardCard title="Highlighted Comments">
        <ul className="space-y-2 text-sm">
          {comments_analyzed.slice(0, 5).map((comment) => (
            <li key={comment.comment_id}>
              <strong>
                {comment.sentiment} ({Math.round(comment.sentiment_conf * 100)}
                %):
              </strong>{" "}
              {comment.text}
              <span className="text-xs text-muted-foreground">
                {" "}
                Category: {comment.category} (
                {Math.round(comment.category_conf * 100)}%) -{" "}
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
    </div>
  );
}
