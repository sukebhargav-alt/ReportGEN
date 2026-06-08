import { useState, useRef, useMemo, useCallback } from "react";
import html2canvas from "html2canvas";
import { toast } from "react-toastify";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export interface PhaseZone {
  phase: string;
  startIdx: number;
  endIdx: number;
  startTime: string;
  endTime: string;
}

export interface ChartRow {
  index: number;
  time: string;
  vo2: number;
  vco2: number;
  hr: number;
  ve: number;
  petco2: number;
  peto2: number;
  ve_vo2: number;
  ve_vco2: number;
  vt: number;
  rq: number;
  paco2_e: number;
  speed: number;
  phase: string;
}

export function useCPET() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<any | null>(null);
  const [interpretations, setInterpretations] = useState<Record<
    string,
    string
  > | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadPdfProgress, setDownloadPdfProgress] = useState(0);
  const [progress, setProgress] = useState(0);

  const [sport, setSport] = useState<string>("");
  const [injuries, setInjuries] = useState<string>("");

  const chartRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setChartRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      chartRefs.current[index] = el;
    },
    [],
  );

  // ── File Handling ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setProcessedData(null);
    setInterpretations(null);
  }, []);

  const handleProcessReport = useCallback(async () => {
    if (!selectedFile) {
      toast.warning("Please select a file first.");
      return;
    }
    setIsProcessing(true);
    setParseProgress(5);

    let currentProgress = 5;
    let rafId: number;
    let lastTick = performance.now();
    const tick = (now: number) => {
      if (now - lastTick >= 400) {
        currentProgress =
          currentProgress < 90 ? currentProgress + 4 : currentProgress;
        setParseProgress(currentProgress);
        lastTick = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(`${BACKEND_URL}/process_cpet_excel`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to process CPET Excel file.");
      const data = await res.json();
      setProcessedData(data);

      cancelAnimationFrame(rafId);
      setParseProgress(100);

      setTimeout(() => {
        setIsProcessing(false);
        setParseProgress(0);
        toast.success("CPET Excel file processed successfully!");
      }, 600);
    } catch (error: any) {
      console.error(error);
      cancelAnimationFrame(rafId);
      setIsProcessing(false);
      setParseProgress(0);
      toast.error(error.message || "Failed to process the CPET file.");
    }
  }, [selectedFile]);

  // ── Generate interpretations ───────────────────────────────────────────────

  const generateInterpretations = useCallback(async () => {
    if (!processedData) return;
    if (!BACKEND_URL) {
      toast.error("Backend URL is not configured. Set VITE_BACKEND_URL and redeploy the frontend.");
      return;
    }
    setIsGenerating(true);

    // Use requestAnimationFrame-batched progress ticks to avoid stutter while
    // charts are mounted and re-rendering.
    let currentProgress = 5;
    setProgress(5);
    let rafId: number;
    let lastTick = performance.now();
    const tick = (now: number) => {
      if (now - lastTick >= 400) {
        currentProgress =
          currentProgress < 90 ? currentProgress + 4 : currentProgress;
        setProgress(currentProgress);
        lastTick = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    try {
      const res = await fetch(`${BACKEND_URL}/generate_cpet_interpretations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: processedData.profile,
          results: processedData.results,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { detail: await res.text() };

      if (!res.ok) {
        throw new Error(
          data?.detail ||
            data?.error ||
            data?.message ||
            "Failed to generate CPET interpretations.",
        );
      }

      setInterpretations(data.insights || null);
      cancelAnimationFrame(rafId);
      setProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        if (Array.isArray(data.warnings) && data.warnings.length > 0) {
          toast.warning("CPET insights generated with partial section warnings. Please review and retry if needed.");
        } else {
          toast.success("CPET interpretations generated successfully!");
        }
      }, 600);
    } catch (err: any) {
      console.error(err);
      cancelAnimationFrame(rafId);
      setIsGenerating(false);
      setProgress(0);
      const message =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? `Could not reach the backend at ${BACKEND_URL}. Check that the backend is live and that FRONTEND_ORIGINS allows this frontend URL.`
          : err.message || "Failed to generate CPET interpretations.";
      toast.error(message);
    }
  }, [processedData]);

  // ── Download Word ──────────────────────────────────────────────────────────

  const downloadWord = useCallback(async () => {
    setIsDownloading(true);
    setDownloadProgress(5);

    let currentProgress = 5;
    let rafId: number;
    let lastTick = performance.now();
    const tick = (now: number) => {
      if (now - lastTick >= 400) {
        currentProgress =
          currentProgress < 90 ? currentProgress + 4 : currentProgress;
        setDownloadProgress(currentProgress);
        lastTick = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    try {
      const graphsBase64: string[] = [];
      for (let i = 0; i < chartRefs.current.length; i++) {
        const el = chartRefs.current[i];
        if (el) {
          try {
            // Directly read the Chart.js canvas pixels — more reliable than
            // html2canvas which silently fails on canvas elements.
            const chartCanvas = el.querySelector(
              "canvas",
            ) as HTMLCanvasElement | null;
            if (chartCanvas) {
              graphsBase64.push(
                chartCanvas.toDataURL("image/png").split(",")[1],
              );
            } else {
              // Fallback: capture the whole container with html2canvas
              const captured = await html2canvas(el, {
                backgroundColor: "#ffffff",
                scale: 2,
                useCORS: true,
                allowTaint: true,
              });
              graphsBase64.push(captured.toDataURL("image/png").split(",")[1]);
            }
          } catch (canvasErr) {
            console.error(`Failed to capture chart ${i}:`, canvasErr);
          }
        }
      }
      const updatedProfile = {
        ...processedData.profile,
        Sport: sport,
        Injuries: injuries,
      };
      const res = await fetch(`${BACKEND_URL}/generate_cpet_word_template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { ...processedData, profile: updatedProfile },
          interpretations,
          graphsBase64,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate CPET Word template.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Athlete_CPET_Report_Draft.docx";
      a.click();

      cancelAnimationFrame(rafId);
      setDownloadProgress(100);

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
        toast.success("Draft CPET Word file downloaded successfully!");
      }, 600);
    } catch (err: any) {
      console.error(err);
      cancelAnimationFrame(rafId);
      setIsDownloading(false);
      setDownloadProgress(0);
      toast.error(err.message || "Failed to download CPET Word file.");
    }
  }, [processedData, interpretations, sport, injuries]);

  const downloadFinalPdf = useCallback(
    async (
      finalRecommendations: string,
      sectionMetrics: Record<
        string,
        { label: string; unit: string; values: { k: string; v: string }[] }[]
      >,
      extractedInsights: Record<string, string> | null = null,
      rqTable: string = "",
    ) => {
      if (!processedData || !interpretations) return;
      setIsDownloadingPdf(true);
      setDownloadPdfProgress(10);

      let currentProgress = 10;
      let rafId: number;
      let lastTick = performance.now();
      const tick = (now: number) => {
        if (now - lastTick >= 300) {
          currentProgress =
            currentProgress < 85 ? currentProgress + 4 : currentProgress;
          setDownloadPdfProgress(currentProgress);
          lastTick = now;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      try {
        const graphsBase64: string[] = [];
        for (let i = 0; i < chartRefs.current.length; i++) {
          const el = chartRefs.current[i];
          if (el) {
            try {
              // Chart.js renders to a <canvas>. Direct pixel read is reliable;
              // html2canvas silently fails on canvas elements (taint/CORS).
              const chartCanvas = el.querySelector(
                "canvas",
              ) as HTMLCanvasElement | null;
              if (chartCanvas) {
                graphsBase64[i] = chartCanvas.toDataURL("image/png").split(",")[1];
              } else {
                // Fallback: html2canvas for SVG or other non-canvas charts
                const captured = await html2canvas(el, {
                  backgroundColor: "#ffffff",
                  scale: 2,
                  useCORS: true,
                  allowTaint: true,
                });
                graphsBase64[i] = captured.toDataURL("image/png").split(",")[1];
              }
            } catch (canvasErr) {
              console.error(`Failed to capture chart ${i}:`, canvasErr);
            }
          } else {
            graphsBase64[i] = "";
          }
        }

        const updatedProfile = {
          ...processedData.profile,
          Sport: sport,
          Injuries: injuries,
          hr_vt1: vt1Index !== null ? chartData[vt1Index]?.hr : null,
          hr_vt2: vt2Index !== null ? chartData[vt2Index]?.hr : null,
          // hr_zones chart is now rendered as server-side SVG in the PDF template;
          // hr_vt1/hr_vt2 above are all the backend needs.
        };

        // Use insights extracted from the edited docx if available,
        // otherwise fall back to the in-memory AI-generated interpretations.
        const activeInsights = extractedInsights ?? interpretations ?? {};

        const SECTIONS = [
          "Ventilation System",
          "Cardiovascular System",
          "Ventilatory Perfusion",
          "Metabolic System",
        ];

        // Targeted metric keys per section for the PDF gauges/highlights
        const PDF_METRIC_KEYS: Record<string, string[]> = {
          "Ventilation System": ["VO2", "Rf", "VO2/HR", "VT"],
          "Cardiovascular System": ["HR", "HRR"],
          "Ventilatory Perfusion": ["PetO2", "PetCO2"],
          "Metabolic System": ["METS", "RQ", "EEh"],
        };

        // Extract the "Meas." column value from a sectionMetrics row.
        // CPET software columns are typically "Meas.", "Pred.", "%Pred." etc.
        const getMeasValue = (m: {
          label: string;
          unit: string;
          values: { k: string; v: string }[];
        }) => {
          // Prioritize "Max" value as per user request
          const maxEntry = m.values.find((v) => /^max/i.test(v.k));
          if (maxEntry) {
            const n = parseFloat(maxEntry.v);
            if (!isNaN(n)) return n;
          }

          // Fallback to "Meas." or "Measured"
          const measEntry = m.values.find(
            (v) => /^meas/i.test(v.k), // "Meas.", "Meas", "Measured"
          );
          if (measEntry) {
            const n = parseFloat(measEntry.v);
            if (!isNaN(n)) return n;
          }

          // Fallback to first available numeric column
          for (const entry of m.values) {
            const n = parseFloat(entry.v);
            if (!isNaN(n)) return n;
          }

          return null;
        };

        // Build metric_items per section: { label, meas_value, unit }
        const buildMetricItems = (sec: string) => {
          const keys = PDF_METRIC_KEYS[sec] || [];
          const secMetrics = sectionMetrics[sec] || [];
          const items: {
            label: string;
            meas_value: number | null;
            unit: string;
          }[] = [];

          for (const key of keys) {
            const lowerKey = key.toLowerCase();
            const match = secMetrics.find((m) => {
              const lp = m.label.toLowerCase();
              return (
                lp === lowerKey ||
                lp.startsWith(lowerKey + " ") ||
                lp.startsWith(lowerKey + "/") ||
                lp.startsWith(lowerKey + "@") ||
                // Handle "VO2/HR" aliased as "O2 pulse" in some CPET exports
                (lowerKey === "vo2/hr" &&
                  (lp.includes("o2 pulse") || lp.includes("vo2/hr")))
              );
            });
            if (match) {
              items.push({
                label: match.label,
                meas_value: getMeasValue(match),
                unit: match.unit,
              });
            }
          }
          return items.filter((i) => i.meas_value !== null);
        };

        const sectionsPayload = SECTIONS.map((sec) => {
          let chartIndices: number[] = [];
          if (sec === "Ventilation System") chartIndices = [3, 4, 5];
          else if (sec === "Cardiovascular System") chartIndices = [0, 2];
          else if (sec === "Ventilatory Perfusion") chartIndices = [6, 7, 8]; // RQ vs Time restored here
          else if (sec === "Metabolic System") chartIndices = [7, 1]; // RQ vs Time and RQ vs HR

          const getChartTitle = (index: number) => {
            const titles: Record<number, string> = {
              0: "HR vs VO2",
              1: "RQ & HR vs Time",
              2: "VO2 & VCO2 vs Time",
              3: "VE vs Time",
              4: "VE vs VCO2",
              5: "VE/VO2 & VE/VCO2 vs Time",
              6: "VT vs VE",
              7: "RQ vs Time",
              8: "PetO2, PetCO2, PaCO2_e vs Time",
            };
            return titles[index] || `Chart ${index + 1}`;
          };

          const charts: { b64: string; title: string; full_width?: boolean }[] = [];
          for (let i = 0; i < chartIndices.length; i++) {
            const idx = chartIndices[i];
            if (idx < graphsBase64.length && graphsBase64[idx]) {
              const isFullWidth = idx === 2 || idx === 5 || idx === 8;
              charts.push({
                b64: graphsBase64[idx],
                title: getChartTitle(idx),
                full_width: isFullWidth,
              });
            }
          }

          return {
            title: sec,
            metric_items: buildMetricItems(sec),
            insight: (activeInsights as Record<string, string>)[sec] || "",
            charts,
          };
        });

        const res = await fetch(`${BACKEND_URL}/generate_cpet_final_pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: updatedProfile,
            final_recommendations: finalRecommendations,
            overall_interpretation:
              (activeInsights as Record<string, string>)[
                "Overall Interpretation"
              ] || "",
            sections: sectionsPayload,
            rq_table: rqTable,
          }),
        });

        if (!res.ok) throw new Error("Failed to generate CPET Final PDF.");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Athlete_CPET_Final_Report.pdf";
        a.click();

        cancelAnimationFrame(rafId);
        setDownloadPdfProgress(100);

        setTimeout(() => {
          setIsDownloadingPdf(false);
          setDownloadPdfProgress(0);
          toast.success("Final PDF downloaded successfully!");
        }, 600);
      } catch (err: any) {
        console.error(err);
        cancelAnimationFrame(rafId);
        setIsDownloadingPdf(false);
        setDownloadPdfProgress(0);
        toast.error(err.message || "Failed to download Final PDF.");
      }
    },
    [processedData, interpretations, sport, injuries],
  );

  // ── Derived data ───────────────────────────────────────────────────────────

  const chartData = useMemo((): ChartRow[] => {
    if (!processedData?.data_sheet || !Array.isArray(processedData.data_sheet))
      return [];
    return processedData.data_sheet
      .map((row: any) => ({
        time: row["t"],
        vo2: row["VO2"],
        vco2: row["VCO2"],
        hr: row["HR"],
        ve: row["VE"],
        petco2: row["PetCO2"],
        peto2: row["PetO2"],
        ve_vo2: row["VE/VO2"],
        ve_vco2: row["VE/VCO2"],
        vt: row["VT"],
        rq: row["RQ"],
        paco2_e: row["PaCO2_e"],
        speed: row["Speed"],
        phase: row["Phase"],
      }))
      .filter(
        (row: any) =>
          row.vo2 !== undefined &&
          row.hr !== undefined &&
          row.time !== undefined,
      )
      .map((row: any, i: number) => ({ ...row, index: i }));
  }, [processedData]);

  const phaseZones = useMemo(() => {
    if (!chartData.length) return [];
    const zones: Array<{
      phase: string;
      startIdx: number;
      endIdx: number;
      startTime: string;
      endTime: string;
    }> = [];
    let currentPhase = chartData[0].phase;
    let startIdx = 0;
    for (let i = 1; i < chartData.length; i++) {
      const row = chartData[i];
      if (row.phase !== currentPhase) {
        if (currentPhase && currentPhase !== "nan" && currentPhase !== "None") {
          zones.push({
            phase: currentPhase,
            startIdx,
            endIdx: i - 1,
            startTime: chartData[startIdx].time,
            endTime: chartData[i - 1].time,
          });
        }
        currentPhase = row.phase;
        startIdx = i;
      }
    }
    if (currentPhase && currentPhase !== "nan" && currentPhase !== "None") {
      zones.push({
        phase: currentPhase,
        startIdx,
        endIdx: chartData.length - 1,
        startTime: chartData[startIdx].time,
        endTime: chartData[chartData.length - 1].time,
      });
    }
    return zones;
  }, [chartData]);

  const getPhaseColor = useCallback((phase: string) => {
    const p = phase.toUpperCase();
    if (p.includes("REST")) return "rgba(253, 230, 138, 0.4)";
    if (p.includes("WARM")) return "rgba(191, 219, 254, 0.4)";
    if (p.includes("EXERCISE")) return "rgba(187, 247, 208, 0.4)";
    if (p.includes("RECOVERY")) return "rgba(254, 240, 138, 0.6)";
    return "rgba(243, 244, 246, 0.3)";
  }, []);

  const parseTimeToFloat = (t: any): number => {
    if (typeof t === "number") return t;
    const s = String(t || "").trim();
    if (!s) return 0;
    // Check if it's hh:mm:ss
    const parts = s.split(":");
    if (parts.length >= 2) {
      const hh = parseFloat(parts[0]) || 0;
      const mm = parseFloat(parts[1]) || 0;
      const ss = parseFloat(parts[2]) || 0;
      // Convert to fraction of day (like Excel)
      return (hh * 3600 + mm * 60 + ss) / 86400;
    }
    return parseFloat(s) || 0;
  };

  const vt1Index = useMemo(() => {
    if (!processedData?.results || !chartData.length) return null;
    const tRow = processedData.results.find(
      (r: any) => String(r.Parameter || "").trim().toLowerCase() === "t",
    );
    if (!tRow) return null;

    const vt1Key = Object.keys(tRow).find((k) => k.includes("VT1"));
    if (!vt1Key) return null;

    const thresholdT = parseTimeToFloat(tRow[vt1Key]);
    if (thresholdT === 0) return null;

    let bestIdx = 0;
    let minDiff = Infinity;
    chartData.forEach((row, i) => {
      const rowT = parseTimeToFloat(row.time);
      const diff = Math.abs(rowT - thresholdT);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [processedData, chartData]);

  const { rqCross08Index, rqCross10Index, rqMaxIndex } = useMemo(() => {
    let rqCross08Index: number | null = null;
    let rqCross10Index: number | null = null;
    let rqMaxIndex: number | null = null;
    let maxRq = -Infinity;

    if (!chartData || chartData.length === 0) {
      return { rqCross08Index, rqCross10Index, rqMaxIndex };
    }

    for (let i = 0; i < chartData.length; i++) {
        const rq = Number(chartData[i].rq);
        if (isNaN(rq)) continue;

        if (rqCross08Index === null && rq >= 0.8) {
            rqCross08Index = i;
        }
        if (rqCross10Index === null && rq >= 1.0) {
            rqCross10Index = i;
        }
        if (rq > maxRq) {
            maxRq = rq;
            rqMaxIndex = i;
        }
    }
    return { rqCross08Index, rqCross10Index, rqMaxIndex };
  }, [chartData]);

  const vt2Index = useMemo(() => {
    if (!processedData?.results || !chartData.length) return null;
    const tRow = processedData.results.find(
      (r: any) => String(r.Parameter || "").trim().toLowerCase() === "t",
    );
    if (!tRow) return null;

    const vt2Key = Object.keys(tRow).find((k) => k.includes("VT2"));
    if (!vt2Key) return null;

    const thresholdT = parseTimeToFloat(tRow[vt2Key]);
    if (thresholdT === 0) return null;

    let bestIdx = 0;
    let minDiff = Infinity;
    chartData.forEach((row, i) => {
      const rowT = parseTimeToFloat(row.time);
      const diff = Math.abs(rowT - thresholdT);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [processedData, chartData]);

  return {
    // state
    selectedFile,
    processedData,
    interpretations,
    isProcessing,
    parseProgress,
    isGenerating,
    isDownloading,
    downloadProgress,
    progress,
    isDownloadingPdf,
    downloadPdfProgress,
    sport,
    setSport,
    injuries,
    setInjuries,
    // handlers
    handleFileSelect,
    handleProcessReport,
    generateInterpretations,
    downloadWord,
    downloadFinalPdf: downloadFinalPdf as (
      finalRecommendations: string,
      sectionMetrics: Record<
        string,
        { label: string; unit: string; values: { k: string; v: string }[] }[]
      >,
      extractedInsights?: Record<string, string> | null,
      rqTable?: string,
    ) => Promise<void>,
    setChartRef,
    // derived
    chartData,
    phaseZones,
    getPhaseColor,
    vt1Index,
    vt2Index,
    rqCross08Index,
    rqCross10Index,
    rqMaxIndex,
  };
}
