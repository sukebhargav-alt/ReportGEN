import React, { memo } from "react";
import CPETScatterChart from "./CPETScatterChart";
import type { PhaseZone, ChartRow } from "../../hooks/useCPET";
import type { LineConfig, AxisConfig } from "./CPETScatterChart";
import ReactMarkdown from "react-markdown";

export interface ChartSlot {
  title: string;
  chartRef: (el: HTMLDivElement | null) => void;
  /** span 2 grid columns when true */
  fullWidth?: boolean;
  xAxis: AxisConfig;
  yAxes: AxisConfig[];
  lines: LineConfig[];
  /** pass phaseZones only for time-axis charts */
  usePhaseZones?: boolean;
  marginLeft?: number;
  /** Optional per-slot data filter — rows that return false are excluded from this chart */
  filterFn?: (row: ChartRow) => boolean;
  vt1Marker?: number | null;
  vt2Marker?: number | null;
  subInterpretation?: string;
  hideMarkers?: boolean;
  rqCross08?: number | null;
  rqCross10?: number | null;
  rqMax?: number | null;
}

interface Props {
  title: string;
  accentColor: string;
  insightBg: string;
  insightBorder: string;
  data: ChartRow[];
  phaseZones: PhaseZone[];
  getPhaseColor: (phase: string) => string;
  slots: ChartSlot[];
  interpretation?: string;
  /** key-value pairs to display at the top of the section */
  summaryMetrics?: {
    label: string;
    unit: string;
    values: { k: string; v: string }[];
  }[];
  vt1Marker?: number | null;
  vt2Marker?: number | null;
}

function CPETChartSection({
  title,
  accentColor,
  insightBg,
  insightBorder,
  data,
  phaseZones,
  getPhaseColor,
  slots,
  interpretation,
  summaryMetrics,
  vt1Marker,
  vt2Marker,
}: Props) {
  return (
    <div
      className={`bg-white p-6 rounded-xl shadow-lg border-t-4 ${accentColor} hover:shadow-xl transition-shadow duration-300`}
    >
      <h2 className="text-2xl font-bold mb-6 text-gray-800">{title}</h2>

      {summaryMetrics && summaryMetrics.length > 0 && (
        <div className="mb-8 p-5 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-5 border-b border-gray-200 pb-2">
            Key Metrics
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {summaryMetrics.map((sm, i) => (
              <div
                key={i}
                className="flex flex-col bg-white p-4 rounded-lg shadow-sm border border-gray-100"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="font-bold text-gray-800 text-[15px]">
                    {sm.label}
                  </span>
                  {sm.unit && (
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                      {sm.unit}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {sm.values.map((valObj, j) => (
                    <div
                      key={j}
                      className="flex items-center text-xs border border-gray-200 rounded-md overflow-hidden bg-gray-50"
                    >
                      <span className="font-medium text-gray-600 bg-gray-200/60 px-2 py-1 border-r border-gray-200">
                        {valObj.k}
                      </span>
                      <span className="text-gray-900 font-semibold px-2 py-1 bg-white">
                        {valObj.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {slots.map((slot) => (
          <div
            key={slot.title}
            ref={slot.chartRef}
            className={`flex flex-col bg-gray-50 rounded-lg p-4${slot.fullWidth ? " xl:col-span-2" : ""}`}
          >
            <h3 className="text-lg font-semibold text-center mb-4 text-gray-700">
              {slot.title}
            </h3>
            <div className="h-80 w-full">
              <CPETScatterChart
                data={slot.filterFn ? data.filter(slot.filterFn) : data}
                xAxis={slot.xAxis}
                yAxes={slot.yAxes}
                lines={slot.lines}
                phaseZones={slot.usePhaseZones ? phaseZones : []}
                getPhaseColor={slot.usePhaseZones ? getPhaseColor : undefined}
                marginLeft={slot.marginLeft}
                vt1Marker={slot.vt1Marker ?? vt1Marker}
                vt2Marker={slot.vt2Marker ?? vt2Marker}
                hideMarkers={slot.hideMarkers}
                rqCross08={slot.rqCross08}
                rqCross10={slot.rqCross10}
                rqMax={slot.rqMax}
              />
            </div>
            {slot.subInterpretation && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md text-sm text-gray-700">
                <ReactMarkdown>{slot.subInterpretation}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>

      {interpretation && (
        <div className="mt-8 border-t pt-6 border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            {title} Insights (ACSM Normative)
          </h3>
          <div
            className={`prose max-w-none text-gray-700 whitespace-pre-wrap ${insightBg} p-6 rounded-lg border ${insightBorder} shadow-sm text-sm`}
          >
            <ReactMarkdown>{interpretation}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(CPETChartSection);
