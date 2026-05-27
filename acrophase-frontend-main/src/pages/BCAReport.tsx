import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import Header from "../components/Header";
import Footer from "../components/Footer";
import FileUpload from "../components/FileUpload";

export default function BCAReport() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [sport, setSport] = React.useState("");
  const [injuries, setInjuries] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [parseProgress, setParseProgress] = React.useState(0);
  const [processedData, setProcessedData] = React.useState<{
    fileName: string;
    sport: string;
    injuries: string;
  } | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setProcessedData(null);
    setParseProgress(0);
  };

  const handleProcessReport = () => {
    if (!selectedFile) {
      toast.warning("Please select a file first.");
      return;
    }

    setIsProcessing(true);
    setParseProgress(8);

    let currentProgress = 8;
    const interval = window.setInterval(() => {
      currentProgress += 14;
      setParseProgress(Math.min(currentProgress, 100));

      if (currentProgress >= 100) {
        window.clearInterval(interval);
        setProcessedData({
          fileName: selectedFile.name,
          sport,
          injuries,
        });
        setIsProcessing(false);
        toast.success("BCA file is ready for report generation.");
      }
    }, 220);
  };

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

        <h1 className="text-3xl font-bold text-gray-900 mb-8">BCA Report</h1>

        <div className="flex items-center gap-4 border-b border-gray-200 mb-8">
          <button className="pb-4 px-4 font-semibold text-orange-600 relative">
            BCA Reports
            <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-600 rounded-t-full" />
          </button>
        </div>

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
          onFileRemove={() => {
            setSelectedFile(null);
            setProcessedData(null);
            setParseProgress(0);
          }}
        />

        {selectedFile && (
          <div className="mt-6 flex flex-col md:flex-row gap-4 md:items-center">
            <button
              onClick={handleProcessReport}
              disabled={isProcessing || !sport || !injuries}
              title={!sport || !injuries ? "Please enter a sport and injuries" : ""}
              className={`bg-orange-600 text-white px-4 py-2 md:w-1/4 rounded-2xl transition-opacity ${
                isProcessing || !sport || !injuries
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              {isProcessing ? "Parsing..." : "Parse BCA File"}
            </button>
            {isProcessing && (
              <div className="md:w-3/4 bg-gray-200 rounded">
                <div
                  className="bg-orange-600 flex justify-end px-4 text-white text-xs py-1 text-center rounded transition-all duration-300"
                  style={{ width: `${parseProgress}%` }}
                >
                  {parseProgress}%
                </div>
              </div>
            )}
          </div>
        )}

        {processedData && (
          <div className="bg-white p-6 rounded shadow mt-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">
              BCA Upload Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <div className="flex flex-col sm:flex-row justify-between border-b py-2">
                <span className="font-medium text-gray-700">File</span>
                <span className="text-gray-900 font-semibold text-right">
                  {processedData.fileName}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between border-b py-2">
                <span className="font-medium text-gray-700">Sport</span>
                <span className="text-gray-900 font-semibold text-right">
                  {processedData.sport}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row justify-between border-b py-2 md:col-span-2">
                <span className="font-medium text-gray-700">Injuries</span>
                <span className="text-gray-900 font-semibold text-right">
                  {processedData.injuries}
                </span>
              </div>
            </div>

            <div className="mt-8 items-center flex gap-4">
              <button
                disabled
                className="bg-blue-600 rounded-2xl text-white px-4 py-2 md:w-1/4 opacity-50 cursor-not-allowed"
              >
                Generate BCA Insights
              </button>
              <span className="text-sm text-gray-500">
                BCA interpretation endpoints can be connected in the next backend pass.
              </span>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
