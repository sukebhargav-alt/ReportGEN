import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

interface NameInputReportProps {
  title: string;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function NameInputReport({ title }: NameInputReportProps) {
  const navigate = useNavigate();
  const [athleteName, setAthleteName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reportData, setReportData] = React.useState<any | null>(null);
  const sectionKey = title.toLowerCase().includes("force")
    ? "forcedecks"
    : "dynamometer";

  const handleLookup = async () => {
    if (!athleteName.trim()) return;

    setIsLoading(true);
    setError(null);
    setReportData(null);

    try {
      const response = await fetch(
        `${BACKEND_URL}/athlete-report?name=${encodeURIComponent(athleteName.trim())}`,
      );
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

  const tests = reportData?.[sectionKey]?.tests || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate("/reports")}
          className="flex items-center gap-2 text-orange-600 mb-6"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">{title}</h1>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <label
            htmlFor="athlete-name"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Athlete Name
          </label>
          <input
            id="athlete-name"
            type="text"
            value={athleteName}
            onChange={(e) => setAthleteName(e.target.value)}
            placeholder="Enter athlete name"
            className="w-full p-3 border rounded-md focus:ring-2 focus:ring-orange-500"
          />

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              onClick={handleLookup}
              disabled={!athleteName.trim()}
              className={`bg-orange-600 text-white px-6 py-2 rounded-2xl transition-opacity ${
                athleteName.trim() && !isLoading
                  ? "hover:bg-orange-700"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              {isLoading ? "Loading..." : "Continue"}
            </button>
            <span className="text-sm text-gray-500">
              Enter an athlete name to fetch synced VALD metrics.
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
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                {reportData.athlete?.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                VALD ID: {reportData.athlete?.vald_id}
              </p>
            </div>

            {tests.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-600">
                No {title} metrics are available for this athlete yet.
              </div>
            ) : (
              tests.map((test: any) => (
                <div
                  key={test.vald_test_id}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {test.test_type || title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {test.test_date || "No test date"}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {test.vald_test_id}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm border-collapse">
                      <thead>
                        <tr className="bg-orange-50">
                          <th className="border px-3 py-2 text-left text-gray-700 font-semibold">
                            Metric
                          </th>
                          <th className="border px-3 py-2 text-left text-gray-700 font-semibold">
                            Value
                          </th>
                          <th className="border px-3 py-2 text-left text-gray-700 font-semibold">
                            Unit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(test.metrics || []).map((metric: any, index: number) => (
                          <tr key={`${metric.name}-${index}`}>
                            <td className="border px-3 py-2 font-medium text-gray-800">
                              {metric.name}
                            </td>
                            <td className="border px-3 py-2 text-gray-900">
                              {metric.value}
                            </td>
                            <td className="border px-3 py-2 text-gray-500">
                              {metric.unit || ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
