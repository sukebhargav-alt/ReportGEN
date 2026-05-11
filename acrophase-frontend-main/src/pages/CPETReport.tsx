import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import FileUpload from "../components/FileUpload";
import AthleteProfileCard from "../components/cpet/AthleteProfileCard";
import CPETChartSection from "../components/cpet/CPETChartSection";
import { useCPET } from "../hooks/useCPET";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
import ReactMarkdown from "react-markdown";
import AnalysisProgress from "../components/cpet/AnalysisProgress";



export default function CPETReport() {
  const navigate = useNavigate();
  const {
    selectedFile,
    processedData,
    interpretations,
    isProcessing,
    parseProgress,
    isGenerating,
    isDownloading,
    downloadProgress,
    isDownloadingPdf,
    downloadPdfProgress,
    progress,
    sport,
    setSport,
    injuries,
    setInjuries,
    handleFileSelect,
    handleProcessReport,
    generateInterpretations,
    downloadWord,
    downloadFinalPdf,
    setChartRef,
    chartData,
    phaseZones,
    getPhaseColor,
    vt1Index,
    vt2Index,
    rqCross08Index,
    rqCross10Index,
    rqMaxIndex,
  } = useCPET();

  const [activeTab, setActiveTab] = React.useState<"generator" | "progress">(
    "generator",
  );


  const [finalRecommendations, setFinalRecommendations] = React.useState<
    string | null
  >(null);
  const [extractedInsights, setExtractedInsights] = React.useState<
    Record<string, string>
  >({});
  const [rqTable, setRqTable] = React.useState<string>("");
  const [isExtracting, setIsExtracting] = React.useState(false);

  const sectionMetrics = React.useMemo(() => {
    if (!processedData?.results) return {};

    const SYSTEM_METRIC_MAP: Record<string, string[]> = {
      "Ventilation System": [
        "VE",
        "VO2",
        "VO2/kg",
        "VCO2",
        "RR",
        "RF",
        "Vt",
        "O2 pulse",
      ],
      "Cardiovascular System": ["HR", "HRR"],
      "Ventilatory Perfusion": [
        "VT1",
        "VT2",
        "PetO2",
        "PetCO2",
        "HR at VT1",
        "HR at VT2",
      ],
      "Metabolic System": ["RQ", "EEh", "METS", "RER"],
    };

    const metricsBySection: Record<
      string,
      { label: string; unit: string; values: { k: string; v: string }[] }[]
    > = {};

    Object.entries(SYSTEM_METRIC_MAP).forEach(([system, keys]) => {
      const metrics: {
        label: string;
        unit: string;
        values: { k: string; v: string }[];
      }[] = [];
      processedData.results.forEach((row: any) => {
        const param = String(row.Parameter || "").trim();
        if (!param) return;

        // Exact or starts-with match to avoid aggressive matching
        // e.g. "HR" matching "VO2/HR". We want "HR" to match "HR", "HR Max"
        const matched = keys.some((k) => {
          const lowerParam = param.toLowerCase();
          const lowerK = k.toLowerCase();
          return (
            lowerParam === lowerK ||
            lowerParam.startsWith(`${lowerK} `) ||
            lowerParam.startsWith(`${lowerK}/`) ||
            lowerParam.startsWith(`${lowerK}@`)
          );
        });

        if (matched) {
          let unit = "";
          const values: { k: string; v: string }[] = [];

          Object.entries(row).forEach(([colKey, colVal]) => {
            if (colKey === "Parameter") return;
            const strVal = String(colVal || "").trim();
            if (
              !strVal ||
              strVal === "---" ||
              strVal === "nan" ||
              strVal === "undefined"
            )
              return;
            if (typeof colVal === "number" && isNaN(colVal)) return;

            if (colKey.toLowerCase() === "um") {
              unit = strVal;
            } else {
              values.push({ k: colKey, v: strVal });
            }
          });

          if (values.length > 0) {
            metrics.push({ label: param, unit, values });
          }
        }
      });
      metricsBySection[system] = metrics;
    });

    return metricsBySection;
  }, [processedData?.results]);

  const handleUploadEditedDraft = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/extract_final_recommendations`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.recommendations !== undefined) {
        setFinalRecommendations(data.recommendations);
        if (data.insights && Object.keys(data.insights).length > 0) {
          setExtractedInsights(data.insights);
        }
        if (data.rq_table) {
          setRqTable(data.rq_table);
        }
      } else {
        alert(data.error || "Failed to extract recommendations.");
      }
    } catch (error) {
      console.error(error);
      alert("Error extracting recommendations");
    } finally {
      setIsExtracting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
        {/* ── Navigation ── */}
        <button
          onClick={() => navigate("/reports")}
          className="flex items-center gap-2 text-orange-600 mb-6"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">CPET Report</h1>

        <div className="flex items-center gap-4 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab("generator")}
            className={`pb-4 px-4 font-semibold transition-all relative ${
              activeTab === "generator"
                ? "text-orange-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            CPET Reports
            {activeTab === "generator" && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("progress")}
            className={`pb-4 px-4 font-semibold transition-all relative ${
              activeTab === "progress"
                ? "text-orange-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Analysis Progress
            {activeTab === "progress" && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-600 rounded-t-full" />
            )}
          </button>
        </div>

        {activeTab === "generator" ? (
          <>
            {/* ── File + Context Inputs ── */}
            <div className="my-6 flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                placeholder="Sport (e.g., Football, Cycling)"
                className="p-3 border rounded-md flex-1 focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="text"
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
                placeholder="Entered Injuries (e.g., Left Knee Sprain)"
                className="p-3 border rounded-md flex-1 focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <FileUpload
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onFileRemove={() => handleFileSelect(null as any)}
            />

            {selectedFile && (
              <div className="mt-6 flex justify-between gap-4 items-center">
                <button
                  onClick={handleProcessReport}
                  disabled={isProcessing || !sport || !injuries}
                  title={
                    !sport || !injuries
                      ? "Please enter a sport and injuries"
                      : ""
                  }
                  className={`bg-orange-600 text-white px-4 py-2 w-1/4 rounded-2xl transition-opacity ${
                    isProcessing || !sport || !injuries
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isProcessing ? "Parsing..." : "Parse CPET File"}
                </button>
                {isProcessing && (
                  <div className="w-3/4 bg-gray-200 rounded h-1/2">
                    <div
                      className="bg-orange-600 h-full items-center flex justify-end px-4 text-white text-xs py-1 text-center rounded transition-all duration-300"
                      style={{ width: `${parseProgress}%` }}
                    >
                      {parseProgress}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Athlete Profile ── */}
            {processedData?.profile && (
              <AthleteProfileCard
                profile={processedData.profile}
                sport={sport}
                injuries={injuries}
              />
            )}

            {/* ── Overall Interpretation ── */}
            {interpretations?.["Overall Interpretation"] && (
              <div className="bg-white p-6 rounded shadow mt-6 border-l-4 border-purple-500">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">
                  Overall Interpretation
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  <ReactMarkdown>
                    {interpretations["Overall Interpretation"]}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* ── Charts ── */}
            {processedData && chartData.length > 0 && (
              <div className="space-y-10 mt-10">
                {/* Ventilation System */}
                {(() => {
                  const ventInsight = interpretations?.["Ventilation System"] || "";
                  const marker = "Ventilatory Thresholds Interpretation";
                  const parts = ventInsight.split(new RegExp(marker, "i"));
                  const mainVentInsight = parts[0].trim();
                  const vtInsight = parts.length > 1 ? parts[1].trim() : "";

                  return (
                    <CPETChartSection
                      title="Ventilation System"
                      accentColor="border-blue-500"
                      insightBg="bg-blue-50"
                      insightBorder="border-blue-100"
                      data={chartData}
                      phaseZones={phaseZones}
                      getPhaseColor={getPhaseColor}
                      interpretation={mainVentInsight}
                      summaryMetrics={sectionMetrics["Ventilation System"]}
                      vt1Marker={vt1Index}
                      vt2Marker={vt2Index}
                      slots={[
                        {
                          title: "VE vs Time",
                          chartRef: setChartRef(3),
                          fullWidth: true,
                          usePhaseZones: true,
                          xAxis: { dataKey: "time", label: "Time", type: "time" },
                          yAxes: [
                            { dataKey: "ve", label: "VE (L/min)", yAxisId: "left" },
                          ],
                          lines: [
                            {
                              dataKey: "ve",
                              color: "#fb923c",
                              name: "VE",
                              yAxisId: "left",
                            },
                          ],
                        },
                        {
                          title: "VE vs VCO2",
                          chartRef: setChartRef(4),
                          fullWidth: true,
                          xAxis: {
                            dataKey: "vco2",
                            label: "VCO2 (mL/min)",
                            type: "number",
                          },
                          yAxes: [
                            { dataKey: "ve", label: "VE (L/min)", yAxisId: "left" },
                          ],
                          lines: [
                            {
                              dataKey: "ve",
                              color: "#fb923c",
                              name: "VE",
                              yAxisId: "left",
                            },
                          ],
                        },
                        {
                          title: "VE/VO2 & VE/VCO2 vs Time",
                          chartRef: setChartRef(5),
                          fullWidth: true,
                          usePhaseZones: true,
                          marginLeft: 20,
                          xAxis: { dataKey: "time", label: "Time", type: "time" },
                          yAxes: [
                            { dataKey: "ve_vo2", label: "Ratio", yAxisId: "left" },
                          ],
                          lines: [
                            {
                              dataKey: "ve_vo2",
                              color: "#2563eb",
                              name: "VE/VO2",
                              yAxisId: "left",
                            },
                            {
                              dataKey: "ve_vco2",
                              color: "#dc2626",
                              name: "VE/VCO2",
                              yAxisId: "left",
                            },
                          ],
                          subInterpretation: vtInsight,
                        },
                      ]}
                    />
                  );
                })()}

                {/* Cardiovascular System */}
                {(() => {
                  const cardInsight = interpretations?.["Cardiovascular System"] || "";
                  const marker = "Aerobic Capacity Interpretation";
                  const parts = cardInsight.split(new RegExp(marker, "i"));
                  const mainCardInsight = parts[0].trim();
                  const capacityInsight = parts.length > 1 ? parts[1].trim() : "";

                  return (
                    <CPETChartSection
                      title="Cardiovascular System"
                      accentColor="border-red-500"
                      insightBg="bg-orange-50"
                      insightBorder="border-orange-100"
                      data={chartData}
                      phaseZones={phaseZones}
                      getPhaseColor={getPhaseColor}
                      interpretation={mainCardInsight}
                      summaryMetrics={sectionMetrics["Cardiovascular System"]}
                      vt1Marker={vt1Index}
                      vt2Marker={vt2Index}
                      slots={[
                        {
                          title: "HR vs VO2",
                          chartRef: setChartRef(0),
                          fullWidth: true,
                          xAxis: {
                            dataKey: "vo2",
                            label: "VO2 (mL/min)",
                            type: "number",
                          },
                          yAxes: [
                            { dataKey: "hr", label: "HR (bpm)", yAxisId: "left" },
                          ],
                          lines: [
                            {
                              dataKey: "hr",
                              color: "#dc2626",
                              name: "Heart Rate",
                              yAxisId: "left",
                            },
                          ],
                        },
                        {
                          title: "VO2 & VCO2 vs Time",
                          chartRef: setChartRef(2),
                          fullWidth: true,
                          usePhaseZones: true,
                          xAxis: { dataKey: "time", label: "Time", type: "time" },
                          yAxes: [
                            {
                              dataKey: "vo2",
                              label: "Flow (mL/min)",
                              yAxisId: "left",
                            },
                          ],
                          lines: [
                            {
                              dataKey: "vo2",
                              color: "#2563eb",
                              name: "VO2",
                              yAxisId: "left",
                            },
                            {
                              dataKey: "vco2",
                              color: "#dc2626",
                              name: "VCO2",
                              yAxisId: "left",
                            },
                          ],
                          subInterpretation: capacityInsight,
                        },
                      ]}
                    />
                  );
                })()}

                {/* Ventilatory Perfusion */}
                <CPETChartSection
                  title="Ventilatory Perfusion"
                  accentColor="border-emerald-500"
                  insightBg="bg-teal-50"
                  insightBorder="border-teal-100"
                  data={chartData}
                  phaseZones={phaseZones}
                  getPhaseColor={getPhaseColor}
                  interpretation={interpretations?.["Ventilatory Perfusion"]}
                  summaryMetrics={sectionMetrics["Ventilatory Perfusion"]}
                  vt1Marker={vt1Index}
                  vt2Marker={vt2Index}
                  slots={[
                    {
                      title: "VT vs VE",
                      chartRef: setChartRef(6),
                      fullWidth: true,
                      xAxis: {
                        dataKey: "ve",
                        label: "VE (L/min)",
                        type: "number",
                      },
                      yAxes: [
                        { dataKey: "vt", label: "VT (L)", yAxisId: "left" },
                      ],
                      lines: [
                        {
                          dataKey: "vt",
                          color: "#dc2626",
                          name: "VT",
                          yAxisId: "left",
                        },
                      ],
                    },
                    {
                      title: "PetO2, PetCO2, PaCO2_e vs Time",
                      chartRef: setChartRef(8),
                      fullWidth: true,
                      usePhaseZones: true,
                      xAxis: { dataKey: "time", label: "Time", type: "time" },
                      yAxes: [
                        {
                          dataKey: "peto2",
                          label: "Pressure (mmHg)",
                          yAxisId: "left",
                        },
                      ],
                      lines: [
                        {
                          dataKey: "peto2",
                          color: "#1e3a8a",
                          name: "PetO2",
                          yAxisId: "left",
                        },
                        {
                          dataKey: "petco2",
                          color: "#c026d3",
                          name: "PetCO2",
                          yAxisId: "left",
                        },
                        {
                          dataKey: "paco2_e",
                          color: "#14b8a6",
                          name: "PaCO2_e",
                          yAxisId: "left",
                        },
                      ],
                    },
                  ]}
                />

                {/* Metabolic System */}
                {(() => {
                  const metabolicInsight =
                    interpretations?.["Metabolic System"] || "";
                  const marker = "RQ & HR vs Time Interpretation";
                  const parts = metabolicInsight.split(new RegExp(marker, "i"));
                  const mainInsight = parts[0].trim();
                  const subInsight = parts.length > 1 ? parts[1].trim() : "";

                  return (
                    <CPETChartSection
                      title="Metabolic System"
                      accentColor="border-indigo-500"
                      insightBg="bg-indigo-50"
                      insightBorder="border-indigo-100"
                      data={chartData}
                      phaseZones={phaseZones}
                      getPhaseColor={getPhaseColor}
                      interpretation={mainInsight}
                      summaryMetrics={sectionMetrics["Metabolic System"]}
                      vt1Marker={vt1Index}
                      vt2Marker={vt2Index}
                      slots={[
                        {
                          title: "RQ & HR vs Time",
                          chartRef: setChartRef(1),
                          fullWidth: true,
                          usePhaseZones: false,
                          hideMarkers: true,
                          rqCross08: rqCross08Index,
                          rqCross10: rqCross10Index,
                          rqMax: rqMaxIndex,
                          xAxis: {
                            dataKey: "time",
                            label: "Time",
                            type: "time",
                          },
                          yAxes: [
                            { dataKey: "rq", label: "RQ", yAxisId: "left" },
                            { dataKey: "hr", label: "Heart Rate (bpm)", yAxisId: "right" },
                          ],
                          lines: [
                            {
                              dataKey: "rq",
                              color: "#dc2626",
                              name: "RQ",
                              yAxisId: "left",
                            },
                            {
                              dataKey: "hr",
                              color: "#fb923c",
                              name: "Heart Rate",
                              yAxisId: "right",
                            },
                          ],
                          subInterpretation: subInsight,
                        },
                      ]}
                    />
                  );
                })()}
              </div>
            )}
            
            {/* ── Generate Insights ── */}
            {processedData && (
              <div className="mt-8 items-center flex gap-4">
                <button
                  onClick={generateInterpretations}
                  disabled={isGenerating}
                  className={`bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors text-white px-4 py-2 w-1/4 ${
                    isGenerating ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Generate ACSM CPET Insights
                </button>

                {isGenerating && (
                  <div className="w-3/4 bg-gray-200 rounded h-1/2">
                    <div
                      className="bg-blue-600 h-1/2 items-center flex justify-end px-4 text-white text-xs py-1 text-center rounded transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    >
                      {progress}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Download Word ── */}
            {processedData && (
              <div className="flex gap-4 mt-8 border-t items-center pt-8">
                <button
                  onClick={downloadWord}
                  disabled={isDownloading || !interpretations}
                  title={!interpretations ? "Generate Insights first" : ""}
                  className={`bg-green-600 text-white px-4 w-1/4 py-2 rounded-2xl ${
                    isDownloading || !interpretations
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isDownloading
                    ? "Downloading..."
                    : "Download Draft Word File"}
                </button>

                {isDownloading && (
                  <div className="w-3/4 bg-gray-200 rounded h-1/2">
                    <div
                      className="bg-green-600 items-center flex justify-end px-4 text-white text-xs py-1 text-center rounded transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    >
                      {downloadProgress}%
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Upload Edited Draft & Final Recommendations ── */}
            {processedData && interpretations && (
              <div className="mt-8 pt-8 border-t flex flex-col gap-6">
                <div className="flex items-center gap-4">
                  <label
                    className={`flex-none bg-indigo-600 text-white px-6 py-2 rounded-2xl transition-colors w-1/4 ${
                      isExtracting
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:bg-indigo-700"
                    }`}
                  >
                    {isExtracting
                      ? "Extracting..."
                      : "Upload Edited Draft (.docx)"}
                    <input
                      type="file"
                      accept=".docx"
                      className="hidden"
                      onChange={handleUploadEditedDraft}
                      disabled={isExtracting}
                    />
                  </label>
                  <span className="text-sm text-gray-500">
                    Upload your edited Draft Document to automatically extract
                    Final Recommendations.
                  </span>
                </div>

                {finalRecommendations !== null && (
                  <div className="bg-white p-6 rounded shadow border-l-4 border-indigo-500">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900">
                      Final Recommendations
                    </h2>
                    {finalRecommendations.trim() ? (
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                        {finalRecommendations}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">
                        No recommendations found. Did you type under the 'Final
                        Recommendations' heading?
                      </p>
                    )}
                  </div>
                )}

                {/* ── Download Premium PDF ── */}
                {processedData && interpretations && (
                  <div className="mt-4 pt-6 border-t flex items-center gap-4">
                    <button
                      onClick={() =>
                        downloadFinalPdf(
                          finalRecommendations || "",
                          sectionMetrics,
                          extractedInsights,
                          rqTable,
                        )
                      }
                      disabled={isDownloadingPdf}
                      className={`bg-indigo-900 border border-indigo-700 text-white px-6 w-1/4 py-3 font-semibold rounded-2xl ${
                        isDownloadingPdf
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-indigo-800"
                      }`}
                    >
                      {isDownloadingPdf
                        ? "Generating PDF..."
                        : "Download Final PDF"}
                    </button>
                    {isDownloadingPdf && (
                      <div className="w-3/4 bg-gray-200 rounded h-1/2">
                        <div
                          className="bg-indigo-900 items-center flex justify-end px-4 text-white text-xs py-1 text-center rounded transition-all duration-300"
                          style={{ width: `${downloadPdfProgress}%` }}
                        >
                          {downloadPdfProgress}%
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <AnalysisProgress
            sport={sport}
            setSport={setSport}
            injuries={injuries}
            setInjuries={setInjuries}
          />
        )}

      </main>
      <Footer />
    </div>
  );
}
