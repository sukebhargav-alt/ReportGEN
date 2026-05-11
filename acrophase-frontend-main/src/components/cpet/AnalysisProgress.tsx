import React, { useState } from "react";
import FileUpload from "../FileUpload";
import { useAnalysisProgress } from "../../hooks/useAnalysisProgress";
import ScoreBanner from "./comparison/ScoreBanner";
import RadarChartView from "./comparison/RadarChart";
import ImprovementBreakdown from "./comparison/ImprovementBreakdown";
import AthleteProfileCard from "./AthleteProfileCard";
import ScoreExplainer from "./comparison/ScoreExplainer";
import { BarChart2, ArrowRight, Download, FileText } from "lucide-react";

interface AnalysisProgressProps {
  sport: string;
  setSport: (s: string) => void;
  injuries: string;
  setInjuries: (i: string) => void;
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  sport,
  setSport,
  injuries,
  setInjuries,
}) => {
  const {
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
  } = useAnalysisProgress(sport, injuries);

  const [finalRecommendations, setFinalRecommendations] = useState("");
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const hasResults = comparisonMetrics.length > 0 && !isProcessing;

  return (
    <div className="space-y-8">
      {/* ── Context inputs ── */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Sport</label>
          <input
            type="text"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            placeholder="e.g., Basketball, 400m Sprint"
            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 transition-all text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Injuries</label>
          <input
            type="text"
            value={injuries}
            onChange={(e) => setInjuries(e.target.value)}
            placeholder="e.g., None, ACL Recovery"
            className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-orange-500 transition-all text-sm"
          />
        </div>
      </div>

      {/* ── Dual file upload ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h3 className="font-semibold text-gray-800 text-sm">
              Baseline / Initial Report {baselineDate ? `(${baselineDate})` : ""}
            </h3>
          </div>
          <FileUpload
            selectedFile={baselineFile}
            onFileSelect={setBaselineFile}
            onFileRemove={() => setBaselineFile(null)}
          />
          <p className="text-xs text-gray-400 italic">
            Upload the older CPET report — this becomes the comparison reference.
          </p>
        </div>

        {/* Follow-up */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h3 className="font-semibold text-gray-800 text-sm">
              Follow-up / Latest Report {followUpDate ? `(${followUpDate})` : ""}
            </h3>
          </div>
          <FileUpload
            selectedFile={followUpFile}
            onFileSelect={setFollowUpFile}
            onFileRemove={() => setFollowUpFile(null)}
          />
          <p className="text-xs text-gray-400 italic">
            Upload the most recent CPET report to see progression.
          </p>
        </div>
      </div>

      {/* ── Compare button ── */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={handleCompare}
          disabled={isProcessing || !baselineFile || !followUpFile || !sport}
          className={`flex items-center gap-3 px-10 py-3.5 rounded-full font-bold text-white shadow-lg transition-all text-sm ${
            isProcessing || !baselineFile || !followUpFile || !sport
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-gradient-to-r from-orange-600 to-red-600 hover:scale-105 active:scale-95 shadow-orange-200"
          }`}
        >
          {isProcessing ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {processStepTitle || "Processing…"}
            </>
          ) : (
            <>
              <BarChart2 size={18} />
              Analyze Progress
              <ArrowRight size={16} />
            </>
          )}
        </button>

        {isProcessing && (
          <div className="w-full max-w-sm bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {!sport && (baselineFile || followUpFile) && (
          <p className="text-xs text-amber-600">
            ⚠️ Please enter a sport to enable comparison.
          </p>
        )}
      </div>

      {/* ── Dashboard (shown after comparison) ── */}
      {hasResults && (
        <div className="space-y-6 animate-in fade-in duration-700 slide-in-from-bottom-4">
          {/* 0. Athlete Profile Card */}
          <AthleteProfileCard 
            profile={baselineData?.profile || followUpData?.profile || {}}
            sport={sport}
            injuries={injuries}
            baselineDate={baselineDate}
            followUpDate={followUpDate}
          />

          {/* 1. Overview (Full Width) */}
          <div className="w-full">
            <ScoreBanner
              improvedCount={improvedCount}
              declinedCount={declinedCount}
              noChangeCount={noChangeCount}
              baselineFileName={baselineFile?.name}
              followUpFileName={followUpFile?.name}
              baselineDate={baselineDate}
              followUpDate={followUpDate}
              sport={sport}
              injuries={injuries}
              onShowDetails={() => setIsExplainerOpen(true)}
            />
          </div>

          {/* 2. Radar & Overall Report Stacked */}
          <div className="grid grid-cols-1 gap-6">
            {/* Top: Radar Chart */}
            <div ref={radarChartRef} className="h-full w-full">
              <RadarChartView categoryDeltas={categoryDeltas} />
            </div>

            {/* Bottom: Overall Report */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 flex flex-col h-full">
              <h3 className="text-xl font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">
                Key Findings & Takeaways
              </h3>
              {comparisonInsights?.overall?.summary ? (
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {comparisonInsights.overall.summary}
                </p>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 italic text-sm">
                  Generating detailed overall analysis...
                </div>
              )}
            </div>
          </div>

          {/* 3. Metric breakdown (tabs + cards) */}
          <ImprovementBreakdown metrics={comparisonMetrics} insights={comparisonInsights} />

          {/* 4. Disclaimer footer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 text-xs text-amber-800 leading-relaxed mt-4">
            <strong>Clinical Disclaimer:</strong> These comparisons are derived from CPET data
            using ACSM normative reference logic and AI interpretation. They are intended to
            support — not replace — qualified clinical judgement. Reference metrics (HR Max, Peak RQ)
            are shown without improvement arrows to prevent misinterpretation.
          </div>

          {/* 5. Download PDF & Recommendations */}
          <div className="border-t border-gray-100 pt-6 space-y-4">
            {/* Optional Recommendations textarea */}
            {comparisonInsights && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Final Recommendations <span className="text-gray-400 font-normal">(optional — appears as last page in PDF)</span>
                </label>
                <textarea
                  value={finalRecommendations}
                  onChange={(e) => setFinalRecommendations(e.target.value)}
                  rows={4}
                  placeholder="Add any coaching prescriptions, training notes, or clinical remarks…"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>
            )}

            {/* Download Progress PDF */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => downloadComparisonPdf(finalRecommendations)}
                disabled={isDownloadingPdf || !hasResults}
                title={!hasResults ? "Run comparison first" : ""}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white shadow transition-all ${
                  isDownloadingPdf || !hasResults
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90"
                }`}
              >
                {isDownloadingPdf ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Download Progress PDF
                  </>
                )}
              </button>
              {isDownloadingPdf && (
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${pdfProgress}%` }}
                  />
                </div>
              )}
              {!hasResults && !isDownloadingPdf && (
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <FileText size={12} />
                  Analyze Progress first to generate the final PDF report.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <ScoreExplainer 
        isOpen={isExplainerOpen} 
        onClose={() => setIsExplainerOpen(false)} 
      />
    </div>
  );
};

export default AnalysisProgress;
