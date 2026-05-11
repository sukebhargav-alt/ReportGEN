import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import FileUpload from "../components/FileUpload";
import { ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import ReactMarkdown from "react-markdown";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ProfilingReport() {
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<any | null>(null);
  const [interpretations, setInterpretations] = useState<any>({});
  const [editedWordFile, setEditedWordFile] = useState<File | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // ===============================
  // FILE HANDLING
  // ===============================

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setProcessedData(null);
    setInterpretations({});
    setEditedWordFile(null);
  };

  const handleProcessReport = async () => {
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

      const res = await fetch(`${BACKEND_URL}/process_profiling_excel`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to process Excel file.");

      const data = await res.json();
      setProcessedData(data);

      cancelAnimationFrame(rafId);
      setParseProgress(100);

      setTimeout(() => {
        setIsProcessing(false);
        setParseProgress(0);
        toast.success("Excel file processed successfully!");
      }, 600);
    } catch (error: any) {
      console.error(error);
      cancelAnimationFrame(rafId);
      setIsProcessing(false);
      setParseProgress(0);
      toast.error(error.message || "Failed to process the file.");
    }
  };

  // ===============================
  // GENERATE INTERPRETATIONS
  // ===============================

  const generateInterpretations = async () => {
    if (!processedData) return;

    setIsGenerating(true);
    setProgress(5);

    const interval = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + 4 : prev));
    }, 400);

    try {
      const res = await fetch(
        `${BACKEND_URL}/generate_profiling_interpretations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(processedData),
        },
      );

      if (!res.ok) throw new Error("Failed to generate interpretations.");

      const data = await res.json();
      setInterpretations(data);

      clearInterval(interval);
      setProgress(100);

      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        toast.success("Section interpretations generated successfully!");
      }, 600);
    } catch (err: any) {
      clearInterval(interval);
      setIsGenerating(false);
      setProgress(0);
      toast.error(err.message || "Failed to generate interpretations.");
    }
  };

  // ===============================
  // DOWNLOAD DRAFT WORD
  // ===============================

  const downloadWord = async () => {
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
      const res = await fetch(
        `${BACKEND_URL}/generate_profiling_word_template`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: processedData.profile,
            assessments: processedData.assessments,
            interpretations: interpretations,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to generate Word template.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Athlete_Report_Draft.docx";
      a.click();

      cancelAnimationFrame(rafId);
      setDownloadProgress(100);

      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
        toast.success("Draft Word file downloaded successfully!");
      }, 600);
    } catch (err: any) {
      console.error(err);
      cancelAnimationFrame(rafId);
      setIsDownloading(false);
      setDownloadProgress(0);
      toast.error(err.message || "Failed to download Word file.");
    }
  };

  // ===============================
  // GENERATE FINAL PDF
  // ===============================

  const generateFinalPDF = async () => {
    if (!editedWordFile || !processedData) {
      toast.warning("Please upload an edited word file first.");
      return;
    }

    setIsGeneratingFinal(true);
    setPdfProgress(5);

    let currentProgress = 5;
    let rafId: number;
    let lastTick = performance.now();
    const tick = (now: number) => {
      if (now - lastTick >= 400) {
        currentProgress =
          currentProgress < 90 ? currentProgress + 4 : currentProgress;
        setPdfProgress(currentProgress);
        lastTick = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    try {
      const formData = new FormData();
      formData.append("file", editedWordFile);
      formData.append("original_data", JSON.stringify(processedData));

      const parseRes = await fetch(
        `${BACKEND_URL}/parse_profiling_edited_word_file`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!parseRes.ok)
        throw new Error("Failed to parse the edited Word file.");

      const parsedWord = await parseRes.json();

      const finalRes = await fetch(
        `${BACKEND_URL}/generate_profiling_final_pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: processedData.profile,
            assessments: processedData.assessments,
            interpretations: parsedWord.interpretations,
            final_recommendations: parsedWord.final_recommendations,
          }),
        },
      );

      if (!finalRes.ok) throw new Error("Failed to generate final PDF.");

      const blob = await finalRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Final_Athlete_Report.pdf";
      a.click();

      cancelAnimationFrame(rafId);
      setPdfProgress(100);

      setTimeout(() => {
        setIsGeneratingFinal(false);
        setPdfProgress(0);
        toast.success("Final PDF generated successfully!");
      }, 600);
    } catch (err: any) {
      console.error(err);
      cancelAnimationFrame(rafId);
      setIsGeneratingFinal(false);
      setPdfProgress(0);
      toast.error(err.message || "Failed to generate final PDF.");
    }
  };


  // ===============================
  // RENDER
  // ===============================


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate("/reports")}
          className="flex items-center gap-2 text-orange-600 mb-6"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Profiling Report
        </h1>

        <FileUpload
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          onFileRemove={() => setSelectedFile(null)}
        />

        {selectedFile && !processedData && (
          <div className="mt-6 flex justify-between gap-4 items-center">
            <button
              onClick={handleProcessReport}
              disabled={isProcessing}
              className={`bg-orange-600 text-white px-4 py-2 w-1/4 rounded-2xl transition-opacity ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isProcessing ? "Parsing..." : "Parse File"}
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

        {/* PROFILE */}
        {processedData?.profile && (
          <div className="bg-white p-6 rounded shadow mt-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">
              Athlete Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {Object.entries(processedData.profile)
                .filter(
                  ([, value]) =>
                    value !== null &&
                    value !== undefined &&
                    value !== "" &&
                    value !== "nan",
                )
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row justify-between border-b py-2"
                  >
                    <span className="font-medium text-gray-700">{key}</span>
                    <span className="text-gray-900 font-semibold text-right">
                      {String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* SECTIONS */}
        {processedData?.assessments &&
          Object.entries(processedData.assessments).map(
            ([sectionName, entries]: any) => {
              // Skip VALD Raw Data — excluded from all reporting views
              if (sectionName.trim().toLowerCase() === "vald raw data") return null;
              if (!entries || entries.length === 0) return null;

              // Determine which columns are present in this section
              const hasLeft = entries.some((e: any) => e.Left !== null && e.Left !== undefined);
              const hasRight = entries.some((e: any) => e.Right !== null && e.Right !== undefined);
              const hasAsym = entries.some((e: any) => e.Asymmetry !== null && e.Asymmetry !== undefined);
              const hasValue = entries.some(
                (e: any) => e.Left == null && e.Right == null && e.Value !== null && e.Value !== undefined
              );

              return (
                <div key={sectionName} className="bg-white p-6 rounded shadow mt-8">
                  <h2 className="text-xl font-semibold mb-4 text-gray-900">{sectionName}</h2>

                  <div className="overflow-x-auto w-full">
                    <table className="min-w-full border text-sm border-collapse">
                      <thead>
                        <tr className="bg-orange-50">
                          <th className="border px-3 py-2 text-left text-gray-700 font-semibold text-xs uppercase tracking-wide">Metric</th>
                          {hasLeft  && <th className="border px-3 py-2 text-left text-blue-700 font-semibold text-xs uppercase tracking-wide">Left</th>}
                          {hasRight && <th className="border px-3 py-2 text-left text-green-700 font-semibold text-xs uppercase tracking-wide">Right</th>}
                          {hasAsym  && <th className="border px-3 py-2 text-left text-orange-700 font-semibold text-xs uppercase tracking-wide">Asymmetry</th>}
                          {hasValue && <th className="border px-3 py-2 text-left text-gray-700 font-semibold text-xs uppercase tracking-wide">Value</th>}
                          <th className="border px-3 py-2 text-left text-gray-500 font-semibold text-xs uppercase tracking-wide">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          let lastGroup = "";
                          return entries.map((entry: any, idx: number) => {
                            const label = entry["Test Name"] || entry["Metric Name"] || "";
                            const grp = entry["Test Group"] || "";
                            const isNewGroup = grp && grp !== lastGroup;
                            if (isNewGroup) lastGroup = grp;
                            const isBilateral = entry.Left !== null && entry.Left !== undefined || entry.Right !== null && entry.Right !== undefined;

                            return (
                              <React.Fragment key={idx}>
                                {/* Sub-group header row */}
                                {isNewGroup && (
                                  <tr className="bg-gray-100">
                                    <td
                                      colSpan={1 + (hasLeft?1:0) + (hasRight?1:0) + (hasAsym?1:0) + (hasValue?1:0) + 1}
                                      className="px-3 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider"
                                    >
                                      {grp}
                                    </td>
                                  </tr>
                                )}
                                {/* Data row */}
                                <tr className="hover:bg-orange-50/30">
                                  <td className="border px-3 py-2 font-medium text-gray-800">{label}</td>
                                  {hasLeft && (
                                    <td className="border px-3 py-2 font-semibold text-blue-700">
                                      {entry.Left !== null && entry.Left !== undefined ? String(entry.Left) : <span className="text-gray-300">—</span>}
                                    </td>
                                  )}
                                  {hasRight && (
                                    <td className="border px-3 py-2 font-semibold text-green-700">
                                      {entry.Right !== null && entry.Right !== undefined ? String(entry.Right) : <span className="text-gray-300">—</span>}
                                    </td>
                                  )}
                                  {hasAsym && (
                                    <td className="border px-3 py-2 font-semibold text-orange-600">
                                      {entry.Asymmetry !== null && entry.Asymmetry !== undefined ? String(entry.Asymmetry) : <span className="text-gray-300">—</span>}
                                    </td>
                                  )}
                                  {hasValue && (
                                    <td className="border px-3 py-2 font-semibold text-gray-800">
                                      {!isBilateral && entry.Value !== null && entry.Value !== undefined
                                        ? String(entry.Value)
                                        : <span className="text-gray-300">—</span>}
                                    </td>
                                  )}
                                  <td className="border px-3 py-2 text-gray-400 text-xs">{entry.Unit || ""}</td>
                                </tr>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>

                    </table>
                  </div>

                  {interpretations[sectionName] && (
                    <div className="bg-white p-6 rounded shadow mt-6 border-l-4 border-purple-500">
                      <h3 className="text-xl font-semibold mb-4 text-gray-900">{sectionName} Insights</h3>
                      <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                        <ReactMarkdown>{interpretations[sectionName]}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              );
            },
          )}



        {/* GENERATE INTERPRETATIONS */}
        {processedData && (
          <div className="mt-8 items-center flex gap-4">
            <button
              onClick={generateInterpretations}
              disabled={isGenerating}
              className={`bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors text-white px-4 py-2 w-1/4 ${
                isGenerating ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Generate Section Interpretations
            </button>

            {isGenerating && (
              <div className="w-3/4 bg-gray-200 rounded h-1/2">
                <div
                  className="bg-blue-600 h-full items-center flex justify-end px-4 text-white text-xs py-1 text-center rounded transition-all duration-300"
                  style={{ width: `${progress}%` }}
                >
                  {progress}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* WORD DRAFT */}
        {processedData && (
          <div className="mt-8 border-t pt-8 flex gap-4 items-center">
            <button
              onClick={downloadWord}
              disabled={
                isDownloading || Object.keys(interpretations).length === 0
              }
              title={
                Object.keys(interpretations).length === 0
                  ? "Generate Interpretations first"
                  : ""
              }
              className={`bg-green-600 text-white px-4 py-2 w-1/4 rounded-2xl transition-opacity ${
                isDownloading || Object.keys(interpretations).length === 0
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              {isDownloading ? "Downloading..." : "Download Draft Word File"}
            </button>
            {isDownloading && (
              <div className="w-3/4 bg-gray-200 rounded h-1/2">
                <div
                  className="bg-green-600 h-full items-center flex justify-end px-4 text-white text-xs py-1 text-center rounded transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                >
                  {downloadProgress}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* FINAL STAGE */}
        {processedData && (
          <div className="mt-8 border-t pt-8 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <label
                className={`flex-none bg-purple-600 text-white px-6 py-2 rounded-2xl transition-colors w-1/4 text-center cursor-pointer hover:bg-purple-700`}
              >
                Upload Edited Draft (.docx)
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) =>
                    setEditedWordFile(e.target.files ? e.target.files[0] : null)
                  }
                  className="hidden"
                />
              </label>
              <span className="text-sm text-gray-500">
                {editedWordFile
                  ? `Selected: ${editedWordFile.name}`
                  : "Upload your edited Draft Document to generate the Final PDF."}
              </span>
            </div>

            {editedWordFile && (
              <div className="mt-4 flex gap-4 items-center">
                <button
                  onClick={generateFinalPDF}
                  disabled={isGeneratingFinal}
                  className={`bg-indigo-900 border border-indigo-700 text-white px-6 w-1/4 py-3 font-semibold rounded-2xl ${
                    isGeneratingFinal
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-indigo-800"
                  }`}
                >
                  {isGeneratingFinal
                    ? "Generating PDF..."
                    : "Generate Final PDF"}
                </button>
                {isGeneratingFinal && (
                  <div className="w-3/4 bg-gray-200 rounded h-1/2">
                    <div
                      className="bg-indigo-900 h-full items-center flex justify-end px-4 text-white text-xs py-1 text-center rounded transition-all duration-300"
                      style={{ width: `${pdfProgress}%` }}
                    >
                      {pdfProgress}%
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
