import React from "react";
import { StatCard } from "@/components/StatCard";
import {
  PieChartCard,
  BarChartCard,
  LineChartCard,
} from "@/components/charts/Charts";
import { useAnalysisStore } from "@/store/useAnalysisStore";

// Fixed page width matching A4 at ~96 DPI (210mm ≈ 794px)
const PAGE_WIDTH_PX = 900;

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <h2
    style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px 0", padding: 0 }}
  >
    {title}
  </h2>
);

const SmallText: React.FC<{ children: React.ReactNode; muted?: boolean }> = ({
  children,
  muted,
}) => (
  <p
    style={{
      fontSize: 13,
      margin: "8px 0",
      color: muted ? "#6b7280" : undefined,
      lineHeight: 1.45,
    }}
  >
    {children}
  </p>
);

const ReportHeader: React.FC<{ title: string }> = ({ title }) => {
  const generatedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.3 }}>
        Social Media Analysis — {title}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>
        Generated {generatedOn}
      </div>
    </div>
  );
};

// Reusable grids styled inline to avoid relying on Tailwind/classnames during offscreen render
const Grid: React.FC<{
  columns?: number;
  gap?: number;
  children: React.ReactNode;
}> = ({ columns = 2, gap = 16, children }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap,
      width: "100%",
    }}
  >
    {children}
  </div>
);

function useDerivedData() {
  const analytics = useAnalysisStore((s) => s.analytics);
  const comments = useAnalysisStore((s) => s.comments_analyzed);
  const pageId = useAnalysisStore((s) => s.page_id);

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
  const timelineMap = comments.reduce<
    Record<
      string,
      { name: string; positive: number; neutral: number; negative: number }
    >
  >((acc, comment) => {
    const date = comment.created_time
      ? new Date(comment.created_time)
      : new Date();
    const month = date.toLocaleString("default", { month: "short" });
    const year = date.getFullYear();
    const key = `${month} ${year}`;
    if (!acc[key])
      acc[key] = { name: key, positive: 0, neutral: 0, negative: 0 };
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

  const timelineData = Object.values(timelineMap).sort(
    (a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()
  );

  // Summaries
  const total = analytics?.total_comments ?? 0;
  const pos = analytics
    ? Math.round((analytics.positive_comments / analytics.total_comments) * 100)
    : 0;
  const neu = analytics
    ? Math.round((analytics.neutral_comments / analytics.total_comments) * 100)
    : 0;
  const neg = analytics
    ? Math.round((analytics.negative_comments / analytics.total_comments) * 100)
    : 0;

  const dateNums = comments
    .map((c) => (c.created_time ? new Date(c.created_time).getTime() : null))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  const rangeStartDate = dateNums.length ? new Date(dateNums[0]) : null;
  const rangeEndDate = dateNums.length
    ? new Date(dateNums[dateNums.length - 1])
    : null;
  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A";

  const topTopics = analytics
    ? [...analytics.categories_stats]
        .sort((a, b) => b.total_comments - a.total_comments)
        .slice(0, 3)
        .map((t) => t.category)
    : [];

  return {
    analytics,
    comments,
    pageId,
    sentimentData,
    trendingData,
    timelineData,
    total,
    pos,
    neu,
    neg,
    rangeStart: fmt(rangeStartDate),
    rangeEnd: fmt(rangeEndDate),
    topTopics,
  };
}

const CardLike: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div
    style={{
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      padding: 16,
      background: "#fff",
    }}
  >
    {title ? (
      <div style={{ marginBottom: 8, fontWeight: 600 }}>{title}</div>
    ) : null}
    {children}
  </div>
);

function DescriptiveOverviewSection() {
  const {
    comments,
    sentimentData,
    trendingData,
    timelineData,
    total,
    pos,
    neu,
    neg,
    topTopics,
  } = useDerivedData();

  return (
    <div
      style={{
        width: PAGE_WIDTH_PX,
        padding: "36px 24px",
        boxSizing: "border-box",
      }}
    >
      <ReportHeader title="Descriptive Overview" />
      <SectionTitle title="Descriptive Overview" />
      <SmallText>
        Snapshot of engagement and sentiment across the analyzed period. Total
        comments: {total}. Sentiment mix — Positive {pos}%, Neutral {neu}%,
        Negative {neg}%.
      </SmallText>
      <SmallText muted>
        Top topics by volume: {topTopics.length ? topTopics.join(", ") : "N/A"}.
      </SmallText>
      {/* Stats grid intentionally omitted; shown on cover page */}

      {/* Charts */}
      <Grid>
        <PieChartCard
          title="Sentiment Share"
          data={sentimentData}
          description="Relative distribution of sentiments."
          disableAnimation
        />
        <BarChartCard
          title="Trending Topics"
          data={trendingData}
          dataKey="count"
          categoryKey="topic"
          description="Most discussed categories."
          disableAnimation
        />
      </Grid>

      {/* Timeline of sentiment trends */}
      <div style={{ height: "400px" }}></div>
      <div className="page-break-before" style={{ marginTop: "14px" }}>
        <LineChartCard
          title="Sentiment Timeline"
          description="Monthly sentiment trends."
          data={timelineData}
          lines={[
            { key: "positive", stroke: "#10b981" },
            { key: "neutral", stroke: "#6b7280" },
            { key: "negative", stroke: "#ef4444" },
          ]}
          disableAnimation
        />
      </div>

      {/* Recent Comments */}
      <div style={{ marginTop: 14 }}>
        <CardLike title="Recent Comments Analysis">
          <ul style={{ fontSize: 14, lineHeight: 1.4, paddingLeft: 16 }}>
            {comments.slice(0, 5).map((comment) => (
              <li key={comment.comment_id} style={{ marginBottom: 8 }}>
                <strong>
                  {comment.category} ({Math.round(comment.category_conf * 100)}
                  %):
                </strong>{" "}
                {comment.text}{" "}
                <span style={{ color: "#6b7280", fontSize: 12 }}>
                  Sentiment: {comment.sentiment} (
                  {Math.round(comment.sentiment_conf * 100)}%) -{" "}
                  {comment.created_time
                    ? new Date(comment.created_time).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }
                      )
                    : "No date"}
                </span>
              </li>
            ))}
            {!comments.length && (
              <li style={{ color: "#6b7280" }}>No comments analyzed yet.</li>
            )}
          </ul>
        </CardLike>
      </div>
    </div>
  );
}

function SentimentsSection() {
  const { sentimentData, timelineData, pos, neu, neg, rangeStart, rangeEnd } =
    useDerivedData();

  return (
    <div
      style={{
        width: PAGE_WIDTH_PX,
        padding: "36px 24px",
        boxSizing: "border-box",
      }}
    >
      <ReportHeader title="Sentiment Analysis" />
      <SectionTitle title="Sentiment Analysis Summary" />
      <SmallText>
        The pie summarizes the overall sentiment composition; the line chart
        captures monthly temporal dynamics.
      </SmallText>
      <SmallText muted>
        Most prevalent sentiment:{" "}
        {pos >= neu && pos >= neg
          ? "Positive"
          : neu >= neg
          ? "Neutral"
          : "Negative"}
        . Period: {rangeStart} – {rangeEnd}.
      </SmallText>

      {/* Only charts; numeric grid and comment list intentionally omitted */}
      <Grid>
        <PieChartCard
          title="Sentiment Distribution"
          data={sentimentData}
          description="Overall share of classified sentiments."
          disableAnimation
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
          disableAnimation
        />
      </Grid>
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function TopicsSection() {
  const categories_stats = useAnalysisStore(
    (s) => s.analytics?.categories_stats ?? []
  );
  const { topTopics } = useDerivedData();

  // Chunk stats into pages of 5 columns x 3 rows = 15 per page
  const statChunks = chunk(categories_stats, 15);
  // Chunk per-category sentiment charts into pages of 3 columns x 2 rows = 6 per page
  const perCatChartChunks = chunk(categories_stats, 6);

  return (
    <>
      {/* First page header + first stats grid (if any) */}
      <div style={{ height: "100px" }}></div>
      {statChunks.length > 0 ? (
        statChunks.map((cats, idx) => (
          <div
            key={`topics-stats-${idx}`}
            className={idx === 0 ? "page-break-before" : undefined}
            style={{
              width: PAGE_WIDTH_PX,
              padding: "36px 24px",
              boxSizing: "border-box",
            }}
          >
            {idx === 0 && (
              <>
                <ReportHeader title="Thematic Analysis" />
                <SectionTitle title="Thematic Summary" />
                <SmallText>
                  This section ranks topics by total mentions and shows the
                  sentiment mix per topic.
                </SmallText>
                <SmallText muted>
                  Top topics: {topTopics.length ? topTopics.join(", ") : "N/A"}.
                </SmallText>
              </>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 12,
              }}
            >
              {cats.map((cat) => (
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
          </div>
        ))
      ) : (
        <div
          style={{
            width: PAGE_WIDTH_PX,
            padding: "36px 24px",
            boxSizing: "border-box",
          }}
        >
          <SectionTitle title="Thematic Analysis" />
          <div style={{ color: "#6b7280" }}>No topics data available.</div>
        </div>
      )}

      {/* Distribution chart on its own page */}
      {categories_stats.length > 0 && (
        <div
          style={{
            width: PAGE_WIDTH_PX,
            padding: "36px 24px",
            boxSizing: "border-box",
          }}
        >
          <ReportHeader title="Thematic Analysis" />
          <SectionTitle title="Thematic Distribution" />
          <SmallText muted>
            Total mentions per topic with relative ranking.
          </SmallText>
          <BarChartCard
            title="Topic Distribution"
            data={categories_stats.map((cat) => ({
              topic: cat.category,
              count: cat.total_comments,
            }))}
            dataKey="count"
            categoryKey="topic"
            description="Total mentions per topic"
            disableAnimation
          />
        </div>
      )}

      {/* Per-category sentiment breakdowns across multiple pages */}

      <div style={{ height: "500px" }}></div>
      {perCatChartChunks.map((cats, idx) => (
        <div
          key={`topics-percat-${idx}`}
          className={idx === 0 ? "page-break-before" : undefined}
          style={{
            width: PAGE_WIDTH_PX,
            padding: "36px 24px",
            boxSizing: "border-box",
          }}
        >
          <ReportHeader title="Thematic Analysis" />
          <SectionTitle title="Sentiment by Theme" />
          <SmallText muted>Per-topic sentiment composition (counts).</SmallText>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {cats.map((cat) => (
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
                disableAnimation
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export const ReportDocument: React.FC = () => {
  const { pageId, total, pos, neu, neg, rangeStart, rangeEnd, topTopics } =
    useDerivedData();
  const generatedOn = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="report-page"
      style={{
        width: PAGE_WIDTH_PX,
        background: "#fff",
        color: "#0f172a",
        padding: "36px 24px",
        boxSizing: "border-box",
      }}
    >
      {/* Cover content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
          Social Media Analysis Report
        </h1>
        <SmallText muted>Prepared for: {pageId || "N/A"}</SmallText>
        <SmallText muted>Generated: {generatedOn}</SmallText>
        <SmallText muted>
          Period: {rangeStart} – {rangeEnd}
        </SmallText>
      </div>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <StatCard
          label="Total Comments"
          value={total}
          helpText="100% of sample"
        />
        <StatCard
          label="Positive"
          value={useAnalysisStore.getState().analytics?.positive_comments ?? 0}
          helpText={`${pos}% of total`}
        />
        <StatCard
          label="Neutral"
          value={useAnalysisStore.getState().analytics?.neutral_comments ?? 0}
          helpText={`${neu}% of total`}
        />
        <StatCard
          label="Negative"
          value={useAnalysisStore.getState().analytics?.negative_comments ?? 0}
          helpText={`${neg}% of total`}
        />
      </div>
      <div style={{ marginTop: 12 }}>
        <SectionTitle title="Executive Summary" />
        <SmallText>
          The analysis covers {total} comments
          {rangeStart !== "N/A" ? ` from ${rangeStart} to ${rangeEnd}` : ""}.
          Sentiment distribution indicates Positive {pos}%, Neutral {neu}%,
          Negative {neg}%. Dominant discussion topics:{" "}
          {topTopics.length ? topTopics.join(", ") : "N/A"}.
        </SmallText>
      </div>

      {/* Sections flow on same page; slicing handled by PDF generator */}
      <DescriptiveOverviewSection />
      <SentimentsSection />
      <TopicsSection />
    </div>
  );
};

export default ReportDocument;
