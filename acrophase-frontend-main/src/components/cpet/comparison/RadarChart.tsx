import React from "react";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import type { CategoryDeltas } from "../../../hooks/useAnalysisProgress";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarChartProps {
  categoryDeltas: CategoryDeltas;
}

const LABELS = ["Ventilation System", "Cardiovascular System", "Ventilatory Perfusion", "Metabolic System"];
const KEYS: (keyof CategoryDeltas)[] = [
  "ventilation",
  "cardiovascular",
  "perfusion",
  "metabolic",
];

const RadarChartView: React.FC<RadarChartProps> = ({ categoryDeltas }) => {
  const followUpValues = KEYS.map((k) => categoryDeltas[k]);
  // Baseline is always 0 (Net Zero)
  const baselineValues = KEYS.map(() => 0);

  const maxAbs = Math.max(15, ...followUpValues.map(v => Math.abs(v ?? 0)));
  const scaleMax = Math.ceil(maxAbs / 10) * 10;
  const scaleMin = -scaleMax;

  const data = {
    labels: LABELS,
    datasets: [
      {
        label: "Baseline (ref)",
        data: baselineValues,
        backgroundColor: "rgba(156, 163, 175, 0.12)",
        borderColor: "rgba(156, 163, 175, 0.8)",
        borderDash: [5, 4],
        borderWidth: 2,
        pointBackgroundColor: "rgba(156, 163, 175, 0.8)",
        pointRadius: 3,
      },
      {
        label: "Improvement %",
        data: followUpValues,
        backgroundColor: "rgba(249, 115, 22, 0.20)",
        borderColor: "rgba(249, 115, 22, 0.9)",
        borderWidth: 2.5,
        pointBackgroundColor: "rgba(249, 115, 22, 1)",
        pointRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: scaleMin,
        max: scaleMax,
        ticks: {
          stepSize: scaleMax / 2,
          font: { size: 9 },
          color: "#9ca3af",
          backdropColor: "transparent",
          callback: (value: number) => `${value > 0 ? "+" : ""}${value}%`,
        },
        grid: { color: "#e5e7eb" },
        angleLines: { color: "#e5e7eb" },
        pointLabels: {
          font: { size: 12, weight: "bold" as const },
          color: "#374151",
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          font: { size: 11 },
          usePointStyle: true,
          pointStyleWidth: 10,
          color: "#6b7280",
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) =>
            `${ctx.dataset.label}: ${ctx.parsed.r > 0 ? "+" : ""}${ctx.parsed.r.toFixed(1)}%`,
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
          Performance Radar
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Dashed ring = baseline (0% change). Solid area = average improvement per category.
        </p>
      </div>
      <div className="h-96 w-full">
        <Radar data={data} options={options as any} />
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-gray-400 justify-center border-t border-gray-100 pt-3">
        <span>Positive % = Better</span>
        <span className="font-semibold text-gray-500">0% = No Change</span>
        <span>Negative % = Declined</span>
      </div>
    </div>
  );
};

export default RadarChartView;
