import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Dumbbell,
  Ruler,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import Header from "../components/Header";
import Footer from "../components/Footer";

interface NameInputReportProps {
  title: string;
}

interface Metric {
  name: string;
  value?: number | null;
  right_value?: number | null;
  left_value?: number | null;
  asymmetry_value?: number | null;
  asymmetry_unit?: string | null;
  direction?: string | null;
  unit?: string | null;
  status?: "green" | "red" | "neutral";
  status_label?: string;
  reference_note?: string;
}

interface Test {
  vald_test_id: string;
  test_type: string;
  test_date?: string | null;
  metrics: Metric[];
  available_metric_count?: number;
}

interface Joint {
  joint: string;
  tests: Test[];
  metric_count: number;
  available_metric_count?: number;
  last_test_date?: string | null;
}

interface Athlete {
  name: string;
  vald_id: string;
  date_of_birth?: string | null;
  age_years?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  demographics_note?: string;
}

interface ReportData {
  athlete: Athlete;
  context: { assessment_date?: string | null; sport?: string | null };
  dynamometer: { tests: Test[]; joints: Joint[] };
  forcedecks: { tests: Test[]; joints: Joint[] };
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function formatDate(value?: string | null) {
  if (!value) return "No test date";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatMetricValue(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : value;
}

function ProfileValue({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default function NameInputReport({ title }: NameInputReportProps) {
  const navigate = useNavigate();
  const [athleteName, setAthleteName] = React.useState("");
  const [assessmentDate, setAssessmentDate] = React.useState("");
  const [sport, setSport] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reportData, setReportData] = React.useState<ReportData | null>(null);
  const [interpretations, setInterpretations] = React.useState<Record<string, string>>({});
  const sectionKey = title.toLowerCase().includes("force")
    ? "forcedecks"
    : "dynamometer";

  const handleLookup = async () => {
    if (!athleteName.trim() || !assessmentDate || !sport.trim()) return;

    setIsLoading(true);
    setError(null);
    setReportData(null);
    setInterpretations({});

    try {
      const query = new URLSearchParams({
        name: athleteName.trim(),
        device: sectionKey,
        latest_only: "true",
        assessment_date: assessmentDate,
        sport: sport.trim(),
      });
      const response = await fetch(`${BACKEND_URL}/athlete-report?${query}`);
      const data = await response.json();
      if (!response.ok) {
        const message =
          data?.message ||
          data?.errors?.[0] ||
          "Unable to find VALD report data for this athlete.";
        throw new Error(message);
      }
      setReportData(data);
    } catch (err: any) {
      setError(err.message || "Unable to load VALD report data.");
    } finally {
      setIsLoading(false);
    }
  };

  const joints = reportData?.[sectionKey]?.joints || [];
  const metricsAvailable = joints.some((joint) => joint.metric_count > 0);

  const generateInterpretations = async () => {
    if (!reportData || !metricsAvailable) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/vald/joint-interpretations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athlete: reportData.athlete,
          joints,
          report_type: title,
          sport: reportData.context.sport,
          assessment_date: reportData.context.assessment_date,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Unable to generate interpretations.");
      }
      setInterpretations(data.interpretations || {});
    } catch (err: any) {
      setError(err.message || "Unable to generate interpretations.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadFinalPdf = async () => {
    if (!reportData || Object.keys(interpretations).length === 0) return;
    setIsDownloadingPdf(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/vald/final-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athlete: reportData.athlete,
          joints,
          interpretations,
          report_type: title,
          sport: reportData.context.sport,
          assessment_date: reportData.context.assessment_date,
        }),
      });
      if (!response.ok) {
        throw new Error("Unable to create the final PDF report.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportData.athlete.name.replace(/\s+/g, "_")}_VALD_Joint_Report.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Unable to create the final PDF report.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate("/reports")}
          className="flex items-center gap-2 text-orange-600 mb-6"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-gray-600">
            Select an assessment date and sport to produce a date-specific, sport-aware joint report.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label htmlFor="athlete-name" className="block text-sm font-semibold text-gray-700 mb-2">
                Athlete Name
              </label>
              <input
                id="athlete-name"
                type="text"
                value={athleteName}
                onChange={(event) => setAthleteName(event.target.value)}
                placeholder="Enter athlete name"
                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label htmlFor="assessment-date" className="block text-sm font-semibold text-gray-700 mb-2">
                Date of Assessment
              </label>
              <input
                id="assessment-date"
                type="date"
                value={assessmentDate}
                onChange={(event) => setAssessmentDate(event.target.value)}
                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label htmlFor="sport" className="block text-sm font-semibold text-gray-700 mb-2">
                Sport
              </label>
              <input
                id="sport"
                type="text"
                value={sport}
                onChange={(event) => setSport(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleLookup()}
                placeholder="e.g. Badminton"
                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <button
              onClick={handleLookup}
              disabled={!athleteName.trim() || !assessmentDate || !sport.trim() || isLoading}
              className={`bg-orange-600 text-white px-7 py-3 rounded-md font-medium transition-opacity ${
                athleteName.trim() && assessmentDate && sport.trim() && !isLoading
                  ? "hover:bg-orange-700"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              {isLoading ? "Loading VALD data..." : "Load athlete"}
            </button>
            <span className="text-sm text-gray-500">
              Only tests recorded on the selected date will be included.
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
          </div>
        )}

        {reportData && (
          <div className="mt-8 space-y-6">
            <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {reportData.athlete.name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    VALD ID: {reportData.athlete.vald_id}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={generateInterpretations}
                    disabled={!metricsAvailable || isGenerating}
                    className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-medium text-white ${
                      metricsAvailable && !isGenerating
                        ? "bg-gray-900 hover:bg-gray-800"
                        : "bg-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Sparkles size={17} />
                    {isGenerating ? "Generating..." : "Generate joint interpretations"}
                  </button>
                  <button
                    onClick={downloadFinalPdf}
                    disabled={Object.keys(interpretations).length === 0 || isDownloadingPdf}
                    className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 font-medium ${
                      Object.keys(interpretations).length > 0 && !isDownloadingPdf
                        ? "border border-orange-600 text-orange-700 hover:bg-orange-50"
                        : "border border-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Download size={17} />
                    {isDownloadingPdf ? "Building PDF..." : "Download final PDF"}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ProfileValue
                  icon={<Trophy size={14} />}
                  label="Sport"
                  value={reportData.context.sport || "Unavailable"}
                />
                <ProfileValue
                  icon={<CalendarDays size={14} />}
                  label="Assessment"
                  value={formatDate(reportData.context.assessment_date)}
                />
                <ProfileValue
                  icon={<UserRound size={14} />}
                  label="Age"
                  value={reportData.athlete.age_years ? `${reportData.athlete.age_years} yrs` : "Unavailable"}
                />
                <ProfileValue
                  icon={<CalendarDays size={14} />}
                  label="Date of birth"
                  value={
                    reportData.athlete.date_of_birth
                      ? formatDate(reportData.athlete.date_of_birth)
                      : "Unavailable"
                  }
                />
                <ProfileValue
                  icon={<Ruler size={14} />}
                  label="Height"
                  value={
                    reportData.athlete.height_cm
                      ? `${reportData.athlete.height_cm} cm`
                      : "Not supplied by API"
                  }
                />
                <ProfileValue
                  icon={<Dumbbell size={14} />}
                  label="Weight"
                  value={
                    reportData.athlete.weight_kg
                      ? `${reportData.athlete.weight_kg} kg`
                      : "Not supplied by API"
                  }
                />
              </div>

              {reportData.athlete.demographics_note && (
                <p className="mt-4 rounded-md bg-orange-50 px-4 py-3 text-sm text-orange-900">
                  {reportData.athlete.demographics_note}
                </p>
              )}
            </section>

            {joints.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-600">
                No {title} metrics are available for this athlete yet.
              </div>
            ) : (
              joints.map((joint) => (
                <section
                  key={joint.joint}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
                >
                  <div className="flex flex-col gap-2 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {joint.joint}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {joint.tests.length} test{joint.tests.length === 1 ? "" : "s"} /{" "}
                        {joint.metric_count} bilateral rows displayed / latest {formatDate(joint.last_test_date)}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {joint.tests.map((test) => (
                      <div key={test.vald_test_id}>
                        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="font-semibold text-gray-800">{test.test_type || title}</h4>
                          <span className="text-sm text-gray-500">{formatDate(test.test_date)}</span>
                        </div>

                        {test.metrics.length === 0 ? (
                          <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-500">
                            No parsed metrics are stored for this test.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-md border border-gray-200">
                            <table className="min-w-full text-sm border-collapse">
                              <thead>
                                <tr className="bg-orange-50">
                                  <th className="px-4 py-3 text-left text-gray-700 font-semibold">
                                    Metric
                                  </th>
                                  <th className="px-4 py-3 text-right text-gray-700 font-semibold">
                                    Right
                                  </th>
                                  <th className="px-4 py-3 text-right text-gray-700 font-semibold">
                                    Left
                                  </th>
                                  <th className="px-4 py-3 text-left text-gray-700 font-semibold">
                                    Unit
                                  </th>
                                  <th className="px-4 py-3 text-left text-gray-700 font-semibold">
                                    Asymmetry
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {test.metrics.map((metric, index) => (
                                  <tr
                                    key={`${metric.name}-${index}`}
                                    className="border-t border-gray-100"
                                  >
                                    <td className="px-4 py-3 font-medium text-gray-800">
                                      {metric.name}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                                      {formatMetricValue(metric.right_value)}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                                      {formatMetricValue(metric.left_value)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">
                                      {metric.unit || "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                      {metric.asymmetry_value === null || metric.asymmetry_value === undefined ? (
                                        <span className="text-gray-400">-</span>
                                      ) : (
                                        <span
                                          title={metric.reference_note}
                                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            metric.status === "green"
                                              ? "bg-green-50 text-green-700"
                                              : "bg-red-50 text-red-700"
                                          }`}
                                        >
                                          {formatMetricValue(metric.asymmetry_value)}{metric.asymmetry_unit || "%"}
                                          {metric.direction === "Towards Right" ? "R" : metric.direction === "Towards Left" ? "L" : ""}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {test.available_metric_count && test.available_metric_count > test.metrics.length && (
                          <p className="mt-2 text-xs text-gray-500">
                            Showing up to 5 bilateral average-result rows from {test.available_metric_count} source measurements; non-average measurements are excluded.
                          </p>
                        )}
                      </div>
                    ))}

                    {interpretations[joint.joint] && (
                      <div className="rounded-lg border border-orange-100 bg-orange-50/60 px-5 py-4">
                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-orange-800">
                          Joint Interpretation
                        </h4>
                        <div className="prose prose-sm max-w-none text-gray-700">
                          <ReactMarkdown>{interpretations[joint.joint]}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
