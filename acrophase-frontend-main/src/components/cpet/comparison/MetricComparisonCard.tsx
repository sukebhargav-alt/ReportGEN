import {
  TrendingUp,
  TrendingDown,
  Minus,
  Bookmark,
  Brain,
} from "lucide-react";
import type { ComparisonMetric } from "../../../hooks/useAnalysisProgress";

interface AiInsight {
  what: string;
  why: string;
  how: string;
}

interface MetricComparisonCardProps {
  metric: ComparisonMetric;
  aiInsight?: AiInsight;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(val: number | null, unit: string): string {
  if (val === null) return "N/A";
  // Format time metrics (seconds) as m:ss
  if (unit === "s" && val >= 60) {
    const m = Math.floor(val / 60);
    const s = Math.round(val % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  // Round to sensible precision
  if (Math.abs(val) >= 100) return val.toFixed(0);
  if (Math.abs(val) >= 10) return val.toFixed(1);
  return val.toFixed(2);
}

function formatDelta(val: number | null, unit: string): string {
  if (val === null) return "";
  if (unit === "s" && Math.abs(val) >= 60) {
    const m = Math.floor(Math.abs(val) / 60);
    const s = Math.round(Math.abs(val) % 60);
    return `${val >= 0 ? "+" : "-"}${m}:${s.toString().padStart(2, "0")}`;
  }
  const sign = val >= 0 ? "+" : "";
  if (Math.abs(val) >= 100) return `${sign}${val.toFixed(0)}`;
  if (Math.abs(val) >= 10) return `${sign}${val.toFixed(1)}`;
  return `${sign}${val.toFixed(2)}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  ventilation: "bg-blue-100 text-blue-700",
  cardiovascular: "bg-red-100 text-red-700",
  perfusion: "bg-purple-100 text-purple-700",
  metabolic: "bg-orange-100 text-orange-700",
};

const BORDER_COLORS: Record<string, string> = {
  better: "border-l-emerald-500",
  worse: "border-l-red-500",
  neutral: "border-l-gray-300",
  reference: "border-l-amber-400",
  null: "border-l-gray-200",
};

const MetricComparisonCard: React.FC<MetricComparisonCardProps> = ({ metric, aiInsight }) => {

  const {
    label,
    unit,
    category,
    baseline,
    followUp,
    delta,
    deltaPercent,
    improvement,
    interpHigh,
    interpLow,
    higherIsBetter,
  } = metric;

  const borderClass =
    BORDER_COLORS[improvement ?? "null"] ?? "border-l-gray-200";

  // Bar widths — scale to the larger value
  const maxVal = Math.max(Math.abs(baseline ?? 0), Math.abs(followUp ?? 0));
  const baselinePct = maxVal > 0 ? ((Math.abs(baseline ?? 0)) / maxVal) * 100 : 0;
  const followUpPct = maxVal > 0 ? ((Math.abs(followUp ?? 0)) / maxVal) * 100 : 0;

  // Delta chip styling
  const chipStyle =
    improvement === "better"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : improvement === "worse"
        ? "bg-red-100 text-red-700 border-red-200"
        : improvement === "reference"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-gray-100 text-gray-600 border-gray-200";

  const DeltaIcon =
    improvement === "better"
      ? TrendingUp
      : improvement === "worse"
        ? TrendingDown
        : improvement === "reference"
          ? Bookmark
          : Minus;

  // Interpretation line
  const interpLine =
    improvement === "reference"
      ? "Reference only — not a fitness improvement metric."
      : delta !== null && delta > 0
        ? interpHigh
        : delta !== null && delta < 0
          ? interpLow
          : "No meaningful change between tests.";

  const missing = baseline === null || followUp === null;

  return (
    <div
      className={`bg-white rounded-xl border-l-4 ${borderClass} border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col overflow-hidden`}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-bold text-gray-900 text-sm leading-tight truncate">{label}</h4>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category]}`}>
              {category}
            </span>
            {unit && unit !== "—" && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                {unit}
              </span>
            )}
          </div>
        </div>

        {/* Delta chip */}
        {!missing && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border flex-none ${chipStyle}`}>
            <DeltaIcon size={12} />
            {improvement === "reference"
              ? "Ref"
              : deltaPercent !== null
                ? `${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(1)}%`
                : "—"}
          </div>
        )}
      </div>

      {/* ── Missing data ── */}
      {missing ? (
        <div className="px-4 pb-4 flex-1 flex items-center">
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            ⚠️ Data not available in one or both reports
          </span>
        </div>
      ) : (
        <>
          {/* ── Values row ── */}
          <div className="px-4 pb-2 flex items-center gap-3 text-sm">
            <div className="flex-1">
              <span className="text-[10px] text-gray-400 font-semibold uppercase block">Baseline</span>
              <span className="text-gray-500 font-medium">{formatValue(baseline, unit)}</span>
            </div>
            <div className="text-gray-300 text-lg">→</div>
            <div className="flex-1">
              <span className="text-[10px] text-gray-400 font-semibold uppercase block">Follow-up</span>
              <span className="font-bold text-gray-900">{formatValue(followUp, unit)}</span>
            </div>
            {delta !== null && (
              <div className="text-right flex-none">
                <span className="text-[10px] text-gray-400 font-semibold uppercase block">Δ</span>
                <span className={`text-xs font-bold ${improvement === "better" ? "text-emerald-600" : improvement === "worse" ? "text-red-600" : "text-gray-500"}`}>
                  {formatDelta(delta, unit)}
                </span>
              </div>
            )}
          </div>

          {/* ── Dual bar ── */}
          <div className="px-4 pb-3 space-y-1.5">
            {/* Baseline bar */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] w-14 text-gray-400 text-right font-medium">Baseline</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gray-300 rounded-full transition-all duration-700"
                  style={{ width: `${baselinePct}%` }}
                />
              </div>
            </div>
            {/* Follow-up bar */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] w-14 text-gray-400 text-right font-medium">Follow-up</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    improvement === "better"
                      ? "bg-emerald-500"
                      : improvement === "worse"
                        ? "bg-red-400"
                        : improvement === "reference"
                          ? "bg-amber-400"
                          : "bg-gray-400"
                  }`}
                  style={{ width: `${followUpPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Interpretation line ── */}
          <div className="px-4 pb-3">
            <p className="text-[11px] text-gray-600 leading-relaxed italic">{interpLine}</p>
          </div>

          {/* ── Direction note (if reference) ── */}
          {higherIsBetter === "reference" && (
            <div className="mx-4 mb-3 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-[10px] text-amber-700 font-semibold">Reference metric — no improvement direction applied</p>
            </div>
          )}

          {/* ── AI Insights ── */}
          {aiInsight && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3 mt-1">
              <div className="space-y-2">
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 block mb-1">What</span>
                  <p className="text-[11px] text-gray-700 leading-relaxed">{aiInsight.what}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 block mb-1">Why</span>
                  <p className="text-[11px] text-gray-700 leading-relaxed">{aiInsight.why}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block mb-1">How</span>
                  <p className="text-[11px] text-gray-700 leading-relaxed">{aiInsight.how}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MetricComparisonCard;
