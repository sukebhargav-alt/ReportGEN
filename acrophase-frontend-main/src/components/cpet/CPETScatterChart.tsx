import React, { memo, useMemo } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import AnnotationPlugin from "chartjs-plugin-annotation";
import { Line } from "react-chartjs-2";
import type { PhaseZone } from "../../hooks/useCPET";
import type { ChartDataset, ScatterDataPoint } from "chart.js";

// Register all required Chart.js components + annotation plugin
ChartJS.register(
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  AnnotationPlugin,
);

export interface LineConfig {
  dataKey: string;
  color: string;
  name: string;
  /** Only set when chart has 2 Y-axes. Must match an AxisConfig.yAxisId. */
  yAxisId?: string;
}

export interface AxisConfig {
  dataKey: string;
  label: string;
  /**
   * "number" → numeric auto-domain.
   * "time"   → numeric INDEX is used as x-axis; time strings shown via tick formatter.
   * omit     → categorical (treated as numeric linear).
   */
  type?: "number" | "time";
  /** Only set when this chart uses 2 Y-axes */
  yAxisId?: string;
  orientation?: "left" | "right";
}

interface Props {
  data: any[];
  xAxis: AxisConfig;
  yAxes: AxisConfig[];
  lines: LineConfig[];
  phaseZones?: PhaseZone[];
  getPhaseColor?: (phase: string) => string;
  marginLeft?: number;
  vt1Marker?: number | null;
  vt2Marker?: number | null;
  hideMarkers?: boolean;
  rqCross08?: number | null;
  rqCross10?: number | null;
  rqMax?: number | null;
}

function CPETScatterChart({
  data,
  xAxis,
  yAxes,
  lines,
  phaseZones = [],
  getPhaseColor,
  marginLeft = 10,
  vt1Marker = null,
  vt2Marker = null,
  hideMarkers = false,
  rqCross08 = null,
  rqCross10 = null,
  rqMax = null,
}: Props) {
  const dual = yAxes.length > 1;
  const isTime = xAxis.type === "time";

  /**
   * Scale IDs must match the yAxisId declared in each LineConfig / AxisConfig.
   * For single-axis charts we always use "y".
   * For dual-axis charts we use whatever yAxisId the caller declared
   * (e.g. "left" / "right") so that Chart.js can wire datasets to the
   * correct axis.
   */
  const leftScaleId = dual ? (yAxes[0].yAxisId ?? "y") : "y";
  const rightScaleId = dual ? (yAxes[1].yAxisId ?? "y2") : "y2";

  const datasets: ChartDataset<"line", ScatterDataPoint[]>[] = useMemo(
    () =>
      lines.map((ln) => ({
        label: ln.name,
        data: data
          .map((row, i) => ({
            x: isTime ? i : Number(row[xAxis.dataKey]),
            y: row[ln.dataKey] != null ? Number(row[ln.dataKey]) : NaN,
          }))
          .filter((p) => !isNaN(p.x) && !isNaN(p.y))
          .sort((a, b) => (isTime ? 0 : a.x - b.x)),
        backgroundColor: ln.color,
        borderColor: ln.color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        showLine: true,
        spanGaps: true,
        tension: 0.1,
        // Non-dual: always "y". Dual: use the declared yAxisId (must match
        // a key in the scales object below).
        yAxisID: dual ? (ln.yAxisId ?? leftScaleId) : "y",
        parsing: false,
      })),
    [data, lines, isTime, xAxis.dataKey, dual, leftScaleId],
  );

  // Build phase-zone box annotations
  const annotations = useMemo(() => {
    const result: Record<string, any> = {};
    phaseZones.forEach((zone, i) => {
      result[`zone${i}`] = {
        type: "box",
        xMin: zone.startIdx,
        xMax: zone.endIdx,
        yMin: -Infinity,
        yMax: Infinity,
        backgroundColor: getPhaseColor
          ? getPhaseColor(zone.phase)
          : "transparent",
        borderWidth: 0,
      };
    });

    const rqLine = lines.find(l => l.dataKey === "rq" || l.dataKey === "RQ");
    if (rqLine) {
      const scaleId = dual ? (rqLine.yAxisId ?? leftScaleId) : "y";
      result.rqZoneFat = {
        type: "box",
        yMin: 0.7,
        yMax: 0.8,
        yScaleID: scaleId,
        backgroundColor: "rgba(34, 197, 94, 0.15)", // Green for Fat
        borderWidth: 0,
        label: {
          display: true,
          content: "Fat (0.7-0.8)",
          position: "center",
          color: "#166534", // Dark Green
          font: { size: 12, weight: "bold" },
          backgroundColor: "rgba(255,255,255,0.7)",
          padding: 4,
          borderRadius: 4,
        }
      };
      result.rqZoneProtein = {
        type: "box",
        yMin: 0.8,
        yMax: 0.9,
        yScaleID: scaleId,
        backgroundColor: "rgba(234, 179, 8, 0.15)", // Yellow for Protein
        borderWidth: 0,
        label: {
          display: true,
          content: "Protein (0.8-0.9)",
          position: "center",
          color: "#854d0e", // Dark Yellow/Brown
          font: { size: 12, weight: "bold" },
          backgroundColor: "rgba(255,255,255,0.7)",
          padding: 4,
          borderRadius: 4,
        }
      };
      result.rqZoneCarbs = {
        type: "box",
        yMin: 0.9,
        yMax: 2.0,
        yScaleID: scaleId,
        backgroundColor: "rgba(239, 68, 68, 0.15)", // Red for Carbs
        borderWidth: 0,
        label: {
          display: true,
          content: "Carbs (0.9+)",
          position: "center",
          color: "#991b1b", // Dark Red
          font: { size: 12, weight: "bold" },
          backgroundColor: "rgba(255,255,255,0.7)",
          padding: 4,
          borderRadius: 4,
        }
      };
    }
    if (vt1Marker !== null && !hideMarkers) {
      const xVal = isTime
        ? vt1Marker
        : Number(data[Math.round(vt1Marker)]?.[xAxis.dataKey]);
      result.vt1 = {
        type: "line",
        xMin: xVal,
        xMax: xVal,
        borderColor: "#2563eb",
        borderWidth: 2,
        borderDash: [6, 6],
        label: {
          display: true,
          content: "VT1",
          position: "start",
          backgroundColor: "#2563eb",
          color: "#fff",
          font: { size: 10, weight: "bold" },
          padding: 4,
        },
      };
    }
    if (vt2Marker !== null && !hideMarkers) {
      const xVal = isTime
        ? vt2Marker
        : Number(data[Math.round(vt2Marker)]?.[xAxis.dataKey]);
      result.vt2 = {
        type: "line",
        xMin: xVal,
        xMax: xVal,
        borderColor: "#dc2626",
        borderWidth: 2,
        borderDash: [6, 6],
        label: {
          display: true,
          content: "VT2",
          position: "start",
          backgroundColor: "#dc2626",
          color: "#fff",
          font: { size: 10, weight: "bold" },
          padding: 4,
        },
      };
    }
    if (rqCross08 !== null) {
      const xVal = isTime ? rqCross08 : Number(data[Math.round(rqCross08)]?.[xAxis.dataKey]);
      const point = data[Math.round(rqCross08)];
      result.rqCross08 = {
        type: "line",
        xMin: xVal, xMax: xVal,
        borderColor: "#9ca3af",
        borderWidth: 2, borderDash: [4, 4],
        label: {
          display: true,
          content: ["Fat-to-Mixed Fuel Transition", `Time: ${point?.time || ''}`, `RQ: ${Number(point?.rq || 0).toFixed(2)}, HR: ${Math.round(point?.hr || 0)} bpm`],
          position: "start",
          backgroundColor: "#ffffff",
          color: "#1f2937",
          borderColor: "#9ca3af",
          borderWidth: 1,
          font: { size: 10 },
          padding: 4,
        },
      };
    }
    if (rqCross10 !== null) {
      const xVal = isTime ? rqCross10 : Number(data[Math.round(rqCross10)]?.[xAxis.dataKey]);
      const point = data[Math.round(rqCross10)];
      result.rqCross10 = {
        type: "line",
        xMin: xVal, xMax: xVal,
        borderColor: "#60a5fa",
        borderWidth: 2, borderDash: [4, 4],
        label: {
          display: true,
          content: ["Mixed-to-Carb Fuel Transition", `Time: ${point?.time || ''}`, `RQ: ${Number(point?.rq || 0).toFixed(2)}, HR: ${Math.round(point?.hr || 0)} bpm`],
          position: "start",
          backgroundColor: "#ffffff",
          color: "#1f2937",
          borderColor: "#60a5fa",
          borderWidth: 1,
          font: { size: 10 },
          padding: 4,
        },
      };
    }
    if (rqMax !== null) {
      const xVal = isTime ? rqMax : Number(data[Math.round(rqMax)]?.[xAxis.dataKey]);
      const point = data[Math.round(rqMax)];
      result.rqMax = {
        type: "line",
        xMin: xVal, xMax: xVal,
        borderColor: "#b91c1c",
        borderWidth: 2, borderDash: [4, 4],
        label: {
          display: true,
          content: ["Maximum Carb Utilization", `Time: ${point?.time || ''}`, `RQ: ${Number(point?.rq || 0).toFixed(2)}, HR: ${Math.round(point?.hr || 0)} bpm`],
          position: "start",
          backgroundColor: "#ffffff",
          color: "#1f2937",
          borderColor: "#b91c1c",
          borderWidth: 1,
          font: { size: 10 },
          padding: 4,
        },
      };
    }
    return result;
  }, [phaseZones, getPhaseColor, vt1Marker, vt2Marker, hideMarkers, rqCross08, rqCross10, rqMax]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      layout: {
        padding: { top: 10, right: 30, left: marginLeft, bottom: 20 },
      },
      plugins: {
        legend: {
          position: "top" as const,
          labels: {
            usePointStyle: true,
            pointStyle: "circle" as const,
            color: "#374151",
            padding: 20,
          },
        },
        tooltip: {
          backgroundColor: "rgba(255,255,255,0.95)",
          titleColor: "#374151",
          bodyColor: "#374151",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            // For time-axis show the human-readable time string as title
            title: (items: any[]) => {
              if (!isTime) return undefined;
              const idx = items[0]?.parsed?.x;
              return idx != null
                ? (data[Math.round(idx)]?.time ?? String(idx))
                : undefined;
            },
            label: (item: any) =>
              `${item.dataset.label}: ${item.parsed.y ?? "—"}`,
          },
        },
        annotation: {
          annotations,
        },
      },
      scales: {
        x: {
          type: "linear" as const,
          grid: {
            color: "#e5e7eb",
            drawOnChartArea: true,
            drawTicks: false,
          },
          border: { color: "#e5e7eb" },
          ticks: {
            color: "#6b7280",
            maxRotation: 0,
            // For time-axis: Chart.js generates ~5-7 ticks automatically;
            // show a time string for each one (no manual skipping needed).
            callback: isTime
              ? (value: any) => {
                  const row = data[Math.round(value)];
                  return row?.time ?? "";
                }
              : undefined,
          },
          title: {
            display: true,
            text: xAxis.label,
            color: "#4b5563",
          },
        },
        // ── Left Y axis ───────────────────────────────────────────────────
        // Key must match yAxisID used in datasets (leftScaleId = e.g. "left" or "y")
        [leftScaleId]: {
          position: "left" as const,
          grid: { color: "#e5e7eb", drawTicks: false },
          border: { display: false },
          ticks: { color: "#6b7280" },
          title: {
            display: true,
            text: yAxes[0]?.label ?? "",
            color: "#4b5563",
          },
        },
        // ── Right Y axis (dual mode only) ─────────────────────────────────
        ...(dual
          ? {
              [rightScaleId]: {
                position: "right" as const,
                grid: { drawOnChartArea: false, drawTicks: false },
                border: { display: false },
                ticks: { color: "#6b7280" },
                title: {
                  display: true,
                  text: yAxes[1]?.label ?? "",
                  color: "#4b5563",
                },
              },
            }
          : {}),
      },
    }),
    [
      isTime,
      marginLeft,
      xAxis.label,
      yAxes,
      dual,
      annotations,
      data,
      leftScaleId,
      rightScaleId,
    ],
  );

  const uniquePhases = useMemo(() => {
    if (!phaseZones.length || !getPhaseColor) return [];
    return Array.from(new Set(phaseZones.map((z) => z.phase)));
  }, [phaseZones, getPhaseColor]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 relative">
        <Line data={{ datasets }} options={options as any} />
      </div>

      {uniquePhases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 justify-center items-center py-1 border-t border-gray-200 bg-white/50 rounded-b-lg">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
            Phases:
          </span>
          {uniquePhases.map((phase) => (
            <div key={phase} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-[2px] border border-gray-200 shadow-sm"
                style={{ backgroundColor: getPhaseColor!(phase) }}
              />
              <span className="text-[11px] font-semibold text-gray-600">
                {phase}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(CPETScatterChart);
