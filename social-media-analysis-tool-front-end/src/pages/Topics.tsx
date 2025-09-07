import { BarChartCard } from "@/components/charts/Charts";
import { StatCard } from "@/components/StatCard";
import { useAnalysisStore } from "@/store/useAnalysisStore";

export default function TopicsPage() {
  const categories_stats = useAnalysisStore(
    (s) => s.analytics?.categories_stats ?? []
  );
  return (
    <div className="p-6 space-y-6">
      {/* Overall Topic Stats */}
      <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-5">
        {categories_stats.map((cat) => (
          <StatCard
            key={cat.category}
            label={cat.category}
            value={cat.total_comments}
            helpText={`${Math.round(
              (cat.positive_comments / cat.total_comments) * 100
            )}% Positive / ${Math.round(
              (cat.negative_comments / cat.total_comments) * 100
            )}% Negative / ${Math.round(
              (cat.neutral_comments / cat.total_comments) * 100
            )}% Neutral`}
          />
        ))}
      </div>

      {/* Main Topic Distribution Chart */}
      <BarChartCard
        title="Topic Distribution"
        data={categories_stats.map((cat) => ({
          topic: cat.category,
          count: cat.total_comments,
        }))}
        dataKey="count"
        categoryKey="topic"
        description="Total mentions per topic"
      />

      {/* Individual Category Sentiment Charts */}
      <div className="grid grid-cols-3 gap-8 mt-8">
        {categories_stats.slice(0, 6).map((cat) => (
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
  );
}
