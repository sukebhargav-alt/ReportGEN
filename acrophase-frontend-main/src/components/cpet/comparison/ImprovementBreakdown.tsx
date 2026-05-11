import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus, LayoutGrid, Bookmark } from "lucide-react";
import type { ComparisonMetric } from "../../../hooks/useAnalysisProgress";
import MetricComparisonCard from "./MetricComparisonCard";

interface ImprovementBreakdownProps {
  metrics: ComparisonMetric[];
  insights?: Record<string, any> | null;
}

type Tab = "all" | "better" | "worse" | "neutral" | "reference";

const TABS: { key: Tab; label: string; icon: React.ReactNode; activeClass: string }[] = [
  {
    key: "all",
    label: "All Metrics",
    icon: <LayoutGrid size={14} />,
    activeClass: "bg-gray-900 text-white border-gray-900",
  },
  {
    key: "better",
    label: "Improved",
    icon: <TrendingUp size={14} />,
    activeClass: "bg-emerald-600 text-white border-emerald-600",
  },
  {
    key: "worse",
    label: "Declined",
    icon: <TrendingDown size={14} />,
    activeClass: "bg-red-600 text-white border-red-600",
  },
  {
    key: "neutral",
    label: "No Change",
    icon: <Minus size={14} />,
    activeClass: "bg-gray-500 text-white border-gray-500",
  },
  {
    key: "reference",
    label: "Reference",
    icon: <Bookmark size={14} />,
    activeClass: "bg-amber-500 text-white border-amber-500",
  },
];

const ImprovementBreakdown: React.FC<ImprovementBreakdownProps> = ({ metrics, insights }) => {
  const [activeTab, setActiveTab] = useState<Tab>("all");

  // Build a flat lookup: "category:label" -> ai insight entry
  const aiLookup = React.useMemo(() => {
    const map: Record<string, { what: string; why: string; how: string }> = {};
    if (!insights) return map;
    Object.entries(insights).forEach(([cat, val]) => {
      if (typeof val === "object" && Array.isArray(val?.metrics)) {
        val.metrics.forEach((entry: any) => {
          const key = `${cat}:${entry.label?.toLowerCase().trim()}`;
          map[key] = { what: entry.what ?? "", why: entry.why ?? "", how: entry.how ?? "" };
        });
      }
    });
    return map;
  }, [insights]);

  const countFor = (tab: Tab) => {
    if (tab === "all") return metrics.length;
    return metrics.filter((m) => m.improvement === tab).length;
  };

  const filtered =
    activeTab === "all"
      ? metrics
      : metrics.filter((m) => m.improvement === activeTab);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-5">
        Metric Breakdown
      </h3>

      {/* ── Tab bar ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => {
          const count = countFor(tab.key);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? tab.activeClass
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span
                className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Card grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No metrics in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((metric) => {
            const aiKey = `${metric.category}:${metric.label.toLowerCase().trim()}`;
            const aiInsight = aiLookup[aiKey];
            return (
              <MetricComparisonCard
                key={`${metric.key}-${metric.sub ?? "max"}`}
                metric={metric}
                aiInsight={aiInsight}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImprovementBreakdown;
