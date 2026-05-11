import { useState, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import html2canvas from "html2canvas";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricDirection = true | false | "reference";
export type MetricCategory =
  | "ventilation"
  | "cardiovascular"
  | "perfusion"
  | "metabolic";

export interface MetricConfig {
  label: string;
  /** Parameter row name to match (case-insensitive) */
  key: string;
  /** Sub-column name within that row (e.g. "Max", "VT1", "VT2") */
  sub?: string;
  unit: string;
  /**
   * true  → higher follow-up is better (e.g. VO₂ Max)
   * false → lower follow-up is better (e.g. VE/VCO₂ slope)
   * "reference" → no improvement direction; display raw value only (e.g. HR Max, Peak RQ)
   */
  higherIsBetter: MetricDirection;
  category: MetricCategory;
  /** Single-line tooltip: what this metric means clinically. */
  clinicalNote: string;
  /** Short interpretation shown when follow-up > baseline. */
  interpHigh: string;
  /** Short interpretation shown when follow-up < baseline. */
  interpLow: string;
}

// ─── Metric Registry (sport-science-validated) ────────────────────────────────

export const METRIC_REGISTRY: MetricConfig[] = [
  // ── VENTILATION SYSTEM ──────────────────────────────────────────────────
  {
    label: "VE Max",
    key: "VE",
    sub: "Max",
    unit: "L/min",
    higherIsBetter: true,
    category: "ventilation",
    clinicalNote:
      "Peak ventilation; higher values confirm adequate breathing reserve at maximal intensity.",
    interpHigh: "Ventilatory ceiling increased — lungs meeting higher peak demands.",
    interpLow: "VE Max decreased; breathing capacity at peak effort is reduced.",
  },

  // ── CARDIOVASCULAR SYSTEM ────────────────────────────────────────────────
  {
    label: "HR Max",
    key: "HR",
    sub: "Max",
    unit: "bpm",
    higherIsBetter: "reference",
    category: "cardiovascular",
    clinicalNote:
      "HR Max is largely genetic; small inter-test changes are normal. Reference value — not a fitness metric.",
    interpHigh: "HR Max slightly elevated. Ensure the test was truly maximal.",
    interpLow: "HR Max slightly lower. May reflect improved cardiac efficiency.",
  },
  {
    label: "HR at VT1",
    key: "HR",
    sub: "VT1",
    unit: "bpm",
    higherIsBetter: true,
    category: "cardiovascular",
    clinicalNote:
      "HR when anaerobic metabolism begins. Higher HR at VT1 = classic sign of improved aerobic base.",
    interpHigh:
      "VT1 at a higher HR — athlete works harder before anaerobic onset.",
    interpLow: "VT1 HR has dropped; aerobic base may have narrowed.",
  },
  {
    label: "HR at VT2",
    key: "HR",
    sub: "VT2",
    unit: "bpm",
    higherIsBetter: true,
    category: "cardiovascular",
    clinicalNote:
      "HR at the anaerobic ceiling. Higher = greater high-intensity tolerance.",
    interpHigh: "VT2 pushed to a higher HR — greater high-intensity zone available.",
    interpLow: "VT2 threshold HR declined; high-intensity tolerance may have narrowed.",
  },
  {
    label: "HR Reserve",
    key: "HRR",
    sub: "Max",
    unit: "bpm",
    higherIsBetter: true,
    category: "cardiovascular",
    clinicalNote:
      "Gap between resting and max HR; larger reserve = more cardiovascular headroom.",
    interpHigh: "HR reserve has grown — greater cardiovascular headroom.",
    interpLow: "HR reserve decreased; monitor resting HR trends.",
  },
  {
    label: "O₂ Pulse",
    key: "O2 pulse",
    sub: "Max",
    unit: "mL/beat",
    higherIsBetter: true,
    category: "cardiovascular",
    clinicalNote:
      "O₂ per heartbeat — non-invasive proxy for stroke volume and cardiac output.",
    interpHigh: "Higher O₂ Pulse suggests improved stroke volume and cardiac efficiency.",
    interpLow: "O₂ Pulse declined; may indicate reduced stroke volume.",
  },
  {
    label: "VO₂ Max",
    key: "VO2",
    sub: "Max",
    unit: "mL/min",
    higherIsBetter: true,
    category: "cardiovascular",
    clinicalNote:
      "Gold standard aerobic capacity marker; determines maximum cardiac output and O₂ extraction.",
    interpHigh: "Aerobic engine has strengthened — athlete can sustain higher intensities.",
    interpLow: "VO₂ Max has declined; review training load, sleep, and nutrition.",
  },
  {
    label: "Relative VO₂ Max",
    key: "VO2/Kg",
    sub: "Max",
    unit: "mL/min/kg",
    higherIsBetter: true,
    category: "cardiovascular",
    clinicalNote:
      "Weight-normalised aerobic capacity — strongest endurance performance predictor.",
    interpHigh:
      "Improved relative aerobic capacity; delivering more O₂ per kg body weight.",
    interpLow:
      "Relative VO₂ declined; may reflect body weight gain or reduced adaptation.",
  },

  // ── VENTILATORY PERFUSION ───────────────────────────────────────────────
  {
    label: "VE/VCO₂ (min)",
    key: "VE/VCO2",
    sub: "Min",
    unit: "—",
    higherIsBetter: false,
    category: "perfusion",
    clinicalNote:
      "Minimum ventilatory equivalent for CO₂. Lower = more efficient CO₂ clearance. < 30 is excellent.",
    interpHigh: "Ventilatory CO₂ efficiency worsened. More air needed per litre CO₂.",
    interpLow: "Ventilatory efficiency improved — less breathing effort to clear CO₂.",
  },
  {
    label: "VE/VO₂ (min)",
    key: "VE/VO2",
    sub: "Min",
    unit: "—",
    higherIsBetter: false,
    category: "perfusion",
    clinicalNote:
      "Minimum ventilatory equivalent for O₂. Lower nadir = more efficient breathing per litre of O₂.",
    interpHigh: "Breathing efficiency for O₂ decreased — more air needed per litre O₂.",
    interpLow: "Breathing efficiency improved — less ventilation per litre of O₂.",
  },
  {
    label: "PetO₂ at VT1",
    key: "PetO2",
    sub: "VT1",
    unit: "mmHg",
    higherIsBetter: true,
    category: "perfusion",
    clinicalNote:
      "End-tidal O₂ at VT1; higher = greater alveolar O₂ exchange efficiency at threshold.",
    interpHigh: "PetO₂ at VT1 improved — efficient alveolar O₂ exchange at threshold.",
    interpLow: "PetO₂ at VT1 decreased; gas exchange efficiency at threshold may have declined.",
  },

  // ── METABOLIC SYSTEM ────────────────────────────────────────────────────
  {
    label: "Peak Speed",
    key: "Speed",
    sub: "Max",
    unit: "km/h",
    higherIsBetter: true,
    category: "metabolic",
    clinicalNote:
      "Peak velocity during test; reflects both neuromuscular and aerobic ceiling.",
    interpHigh: "Athlete can now sustain a higher peak velocity.",
    interpLow: "Peak speed decreased; review sprint and locomotor conditioning.",
  },
  {
    label: "Test Duration",
    key: "T",
    sub: "Max",
    unit: "s",
    higherIsBetter: true,
    category: "metabolic",
    clinicalNote:
      "Longer test duration directly maps to greater overall endurance capacity.",
    interpHigh: "Athlete sustained effort longer — endurance has improved.",
    interpLow: "Duration decreased; may reflect fatigue, illness, or pacing issues.",
  },
  {
    label: "Max METs",
    key: "METS",
    sub: "Max",
    unit: "—",
    higherIsBetter: true,
    category: "metabolic",
    clinicalNote:
      "Metabolic equivalents — universal intensity measure. Higher METs = greater total work capacity.",
    interpHigh: "Max MET level increased — athlete can perform more metabolic work.",
    interpLow: "Max METs declined; overall work capacity has decreased.",
  },
  {
    label: "Energy Expenditure",
    key: "EEh",
    sub: "Max",
    unit: "kcal/h",
    higherIsBetter: true,
    category: "metabolic",
    clinicalNote:
      "Peak energy expenditure rate; higher kcal/h at the same load = greater energy production capacity.",
    interpHigh: "Peak energy expenditure increased — improved metabolic power.",
    interpLow: "Peak energy expenditure declined.",
  },
  {
    label: "RQ at VT1",
    key: "RQ",
    sub: "VT1",
    unit: "—",
    higherIsBetter: false,
    category: "metabolic",
    clinicalNote:
      "RQ at first threshold. Lower = more fat oxidation at threshold intensity (optimal < 0.90). Lower is better.",
    interpHigh:
      "RQ at VT1 rose — more carbohydrate reliance at threshold; metabolic flexibility may have declined.",
    interpLow:
      "RQ at VT1 dropped — better fat oxidation at threshold; excellent metabolic efficiency gain.",
  },
  {
    label: "Peak RQ",
    key: "RQ",
    sub: "Max",
    unit: "—",
    higherIsBetter: "reference",
    category: "metabolic",
    clinicalNote:
      "Peak RQ ≥ 1.10 confirms maximal effort was given. Reference only — not a fitness metric.",
    interpHigh: "Peak RQ risen. ≥ 1.10 typically confirms true maximal effort.",
    interpLow: "Peak RQ dropped. Verify test reached a truly maximal effort.",
  },
  {
    label: "VT1 Time",
    key: "T",
    sub: "VT1",
    unit: "s",
    higherIsBetter: true,
    category: "metabolic",
    clinicalNote:
      "Time at which VT1 occurs. Later VT1 = deeper aerobic base before anaerobic onset.",
    interpHigh: "VT1 reached later in the test — aerobic base has expanded.",
    interpLow: "VT1 reached earlier; aerobic threshold capacity may have declined.",
  },
  {
    label: "VT2 Time",
    key: "T",
    sub: "VT2",
    unit: "s",
    higherIsBetter: true,
    category: "metabolic",
    clinicalNote:
      "Time at which VT2 (anaerobic threshold) occurs. Later VT2 = greater high-intensity tolerance.",
    interpHigh: "VT2 reached later — athlete sustains hard intensities for longer.",
    interpLow: "VT2 reached earlier; high-intensity tolerance has declined.",
  },
];

// ─── Extended comparison shape ────────────────────────────────────────────────

export interface ComparisonMetric extends MetricConfig {
  baseline: number | null;
  followUp: number | null;
  delta: number | null;
  deltaPercent: number | null;
  improvement: "better" | "worse" | "neutral" | "reference" | null;
}

export interface CategoryDeltas {
  ventilation: number;
  cardiovascular: number;
  perfusion: number;
  metabolic: number;
}

// ─── Pure compute functions ───────────────────────────────────────────────────

export const extractMetricValue = (
  data: any,
  metricKey: string,
  subColumn: string = "Max",
): number | null => {
  if (!data?.results) return null;

  const key = metricKey.toLowerCase().trim();
  const row = data.results.find((r: any) => {
    const param = String(r.Parameter || "").toLowerCase().trim();
    return (
      param === key ||
      param.startsWith(`${key} `) ||
      param.startsWith(`${key}/`) ||
      (key === "rq" && (param === "rer" || param.startsWith("rer "))) ||
      (key === "o2 pulse" &&
        (param.includes("o2 pulse") || param.includes("vo2/hr")))
    );
  });

  if (!row) return null;

  const subLower = subColumn.toLowerCase().trim();
  const bestKey = Object.keys(row).find((k) => {
    const lk = k.toLowerCase().trim();
    return lk === subLower || lk.includes(subLower);
  });

  const raw = bestKey
    ? row[bestKey]
    : row["Max"] ?? row["Meas."] ?? row["Measured"];

  if (raw === null || raw === undefined) return null;

  if (typeof raw === "string" && raw.includes(":")) {
    const parts = raw.split(":");
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2] ?? "0") || 0;
    return h * 3600 + m * 60 + s;
  }

  if (key === "t" && typeof raw === "number" && raw > 0 && raw < 1) {
    return Math.round(raw * 86400);
  }

  const num = parseFloat(String(raw).replace(/[^\d.-]/g, ""));
  return isNaN(num) ? null : num;
};

export const computeComparisonMetrics = (
  baselineData: any,
  followUpData: any
): ComparisonMetric[] => {
  if (!baselineData || !followUpData) return [];

  return METRIC_REGISTRY.map((config): ComparisonMetric => {
    const baseline = extractMetricValue(
      baselineData,
      config.key,
      config.sub ?? "Max",
    );
    const followUp = extractMetricValue(
      followUpData,
      config.key,
      config.sub ?? "Max",
    );

    let delta: number | null = null;
    let deltaPercent: number | null = null;
    let improvement: ComparisonMetric["improvement"] = null;

    if (baseline !== null && followUp !== null) {
      delta = followUp - baseline;
      deltaPercent = baseline !== 0 ? (delta / Math.abs(baseline)) * 100 : null;

      if (config.higherIsBetter === "reference") {
        improvement = "reference";
      } else if (deltaPercent !== null) {
        const directed = config.higherIsBetter ? deltaPercent : -deltaPercent;
        if (Math.abs(deltaPercent) < 0.5) {
          improvement = "neutral";
        } else if (directed > 0) {
          improvement = "better";
        } else {
          improvement = "worse";
        }
      }
    }

    return {
      ...config,
      baseline,
      followUp,
      delta,
      deltaPercent,
      improvement,
    };
  });
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalysisProgress(sport?: string, injuries?: string) {
  const [baselineFile, setBaselineFile] = useState<File | null>(null);
  const [followUpFile, setFollowUpFile] = useState<File | null>(null);
  const [baselineData, setBaselineData] = useState<any | null>(null);
  const [followUpData, setFollowUpData] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processStepTitle, setProcessStepTitle] = useState("");

  // ── AI Comparison Insights ────────────────────────────────────────────────
  const [comparisonInsights, setComparisonInsights] = useState<Record<string, any> | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  const radarChartRef = useRef<HTMLDivElement | null>(null);

  const processFile = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BACKEND_URL}/process_cpet_excel`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`Failed to process ${file.name}`);
    return res.json();
  };

  const handleCompare = useCallback(async () => {
    if (!baselineFile || !followUpFile) {
      toast.warning("Please select both Baseline and Follow-up files.");
      return;
    }
    setIsProcessing(true);
    setProgress(5);
    setProcessStepTitle("Our system is extracting your reports...");
    setComparisonInsights(null);

    let currentProgress = 5;
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p < 40) return p + 2;
        if (p >= 50 && p < 95) return p + 1; // Used during AI phase
        return p;
      });
    }, 400);

    try {
      // 1. Process files
      const bData = await processFile(baselineFile);
      setBaselineData(bData);
      const fData = await processFile(followUpFile);
      setFollowUpData(fData);

      setProgress(45);
      setProcessStepTitle("Our AI is analysing your progressive changes...");

      // 2. Compute metrics
      const calculatedMetrics = computeComparisonMetrics(bData, fData);
      
      if (!calculatedMetrics.length) {
        throw new Error("No comparable metrics could be extracted from these reports.");
      }

      // 3. Request AI interpretations
      setProgress(50);
      const profile = { ...(bData?.profile ?? {}) };
      if (sport) profile.Sport = sport;
      if (injuries) profile.Injuries = injuries;

      const metricsPayload = calculatedMetrics.map((m) => ({
        label: m.label,
        category: m.category,
        unit: m.unit,
        baseline: m.baseline,
        followUp: m.followUp,
        delta: m.delta,
        deltaPercent: m.deltaPercent,
        improvement: m.improvement,
      }));

      const res = await fetch(`${BACKEND_URL}/generate_comparison_interpretations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, metrics: metricsPayload }),
      });
      clearInterval(progressInterval);

      if (!res.ok) throw new Error("Our AI encountered a problem analysing these reports.");
      const data = await res.json();
      setComparisonInsights(data.insights ?? null);

      setProgress(100);
      setProcessStepTitle("Analysis Complete!");
      
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        setProcessStepTitle("");
        toast.success("Reports compared and analysed successfully!");
      }, 800);
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error(error);
      setIsProcessing(false);
      setProgress(0);
      setProcessStepTitle("");
      toast.error(error.message || "Failed to compare reports.");
    }
  }, [baselineFile, followUpFile]);

  const comparisonMetrics = useMemo(() => computeComparisonMetrics(baselineData, followUpData), [baselineData, followUpData]);

  // ── Average Delta Percent per Category (Net Zero) ───────────────────────

  const categoryDeltas = useMemo((): CategoryDeltas => {
    const cats: MetricCategory[] = [
      "ventilation",
      "cardiovascular",
      "perfusion",
      "metabolic",
    ];
    const result: CategoryDeltas = {
      ventilation: 0,
      cardiovascular: 0,
      perfusion: 0,
      metabolic: 0,
    };

    for (const cat of cats) {
      const scorable = comparisonMetrics.filter(
        (m) =>
          m.category === cat &&
          m.higherIsBetter !== "reference" &&
          m.deltaPercent !== null
      );
      if (scorable.length > 0) {
        let sumDirected = 0;
        for (const m of scorable) {
           const directed = m.higherIsBetter ? m.deltaPercent! : -m.deltaPercent!;
           sumDirected += directed;
        }
        result[cat] = sumDirected / scorable.length;
      }
    }

    return result;
  }, [comparisonMetrics]);

  const improvedCount = useMemo(
    () => comparisonMetrics.filter((m) => m.improvement === "better").length,
    [comparisonMetrics],
  );
  const declinedCount = useMemo(
    () => comparisonMetrics.filter((m) => m.improvement === "worse").length,
    [comparisonMetrics],
  );
  const noChangeCount = useMemo(
    () => comparisonMetrics.filter((m) => m.improvement === "neutral").length,
    [comparisonMetrics],
  );

  const extractDate = (profile: any) => {
    if (!profile) return null;
    for (const key of Object.keys(profile)) {
      if (key.toLowerCase().includes("date")) {
        const val = profile[key];
        if (!val) continue;
        if (typeof val === "string" && val.includes("T")) {
          return val.split("T")[0];
        }
        return String(val);
      }
    }
    return null;
  };

  const baselineDate = useMemo(() => extractDate(baselineData?.profile), [baselineData]);
  const followUpDate = useMemo(() => extractDate(followUpData?.profile), [followUpData]);


  // ── Download Comparison PDF ────────────────────────────────────────────────

  const downloadComparisonPdf = useCallback(async (finalRecommendations: string = "") => {
    if (!comparisonMetrics.length) return;
    setIsDownloadingPdf(true);
    setPdfProgress(10);

    let currentProgress = 10;
    let rafId: number;
    let lastTick = performance.now();
    const tick = (now: number) => {
      if (now - lastTick >= 300) {
        currentProgress = currentProgress < 85 ? currentProgress + 4 : currentProgress;
        setPdfProgress(currentProgress);
        lastTick = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    try {
      // Capture radar chart canvas
      let radarB64 = "";
      if (radarChartRef.current) {
        const canvas = radarChartRef.current.querySelector("canvas") as HTMLCanvasElement | null;
        if (canvas) {
          radarB64 = canvas.toDataURL("image/png").split(",")[1];
        } else {
          try {
            const captured = await html2canvas(radarChartRef.current, {
              backgroundColor: "#ffffff",
              scale: 2,
              useCORS: true,
            });
            radarB64 = captured.toDataURL("image/png").split(",")[1];
          } catch (_) { /* skip */ }
        }
      }

      const profile = { ...(baselineData?.profile ?? {}) };
      if (sport) profile.Sport = sport;
      if (injuries) profile.Injuries = injuries;

      const metricsPayload = comparisonMetrics.map((m) => ({
        label: m.label,
        category: m.category,
        unit: m.unit,
        baseline: m.baseline,
        followUp: m.followUp,
        delta: m.delta,
        deltaPercent: m.deltaPercent,
        improvement: m.improvement,
      }));

      const res = await fetch(`${BACKEND_URL}/generate_comparison_pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          metrics: metricsPayload,
          insights: comparisonInsights ?? {},
          improved_count: improvedCount,
          declined_count: declinedCount,
          unchanged_count: noChangeCount,
          baseline_date: baselineDate ?? "Test 1",
          followup_date: followUpDate ?? "Test 2",
          radar_b64: radarB64,
          final_recommendations: finalRecommendations,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate comparison PDF.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (profile.Name ?? profile["Athlete Name"] ?? "Athlete").replace(/\s+/g, "_");
      a.download = `${safeName}_Progress_Report.pdf`;
      a.click();

      cancelAnimationFrame(rafId);
      setPdfProgress(100);
      setTimeout(() => {
        setIsDownloadingPdf(false);
        setPdfProgress(0);
        toast.success("Progress PDF downloaded successfully!");
      }, 600);
    } catch (err: any) {
      cancelAnimationFrame(rafId);
      setIsDownloadingPdf(false);
      setPdfProgress(0);
      toast.error(err.message || "Failed to download comparison PDF.");
    }
  }, [comparisonMetrics, comparisonInsights, baselineData, improvedCount, declinedCount, noChangeCount, baselineDate, followUpDate, sport, injuries]);

  return {
    baselineFile,
    setBaselineFile,
    followUpFile,
    setFollowUpFile,
    isProcessing,
    progress,
    handleCompare,
    comparisonMetrics,
    categoryDeltas,
    improvedCount,
    declinedCount,
    noChangeCount,
    baselineData,
    followUpData,
    baselineDate,
    followUpDate,
    comparisonInsights,
    isDownloadingPdf,
    pdfProgress,
    radarChartRef,
    processStepTitle,
    downloadComparisonPdf,
  };
}
