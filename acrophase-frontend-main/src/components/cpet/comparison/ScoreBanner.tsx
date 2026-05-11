import React from "react";
import { TrendingUp, TrendingDown, Minus, Trophy, Info } from "lucide-react";

interface ScoreBannerProps {
  improvedCount: number;
  declinedCount: number;
  noChangeCount: number;
  baselineFileName?: string;
  followUpFileName?: string;
  baselineDate?: string | null;
  followUpDate?: string | null;
  sport?: string;
  injuries?: string;
  onShowDetails?: () => void;
}

const ScoreBanner: React.FC<ScoreBannerProps> = ({
  improvedCount,
  declinedCount,
  noChangeCount,
  baselineFileName,
  followUpFileName,
  baselineDate,
  followUpDate,
  sport,
  injuries,
  onShowDetails,
}) => {
  return (
    <div className="relative overflow-hidden bg-white rounded-2xl shadow-md border border-gray-100 h-full flex flex-col justify-center">
      {/* gradient blob */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-orange-50 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-indigo-50 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col p-8">
        <div className="flex-1 min-w-0">
          {/* Headline */}
          <div className="flex items-center gap-3 mb-1">
            <Trophy size={22} className="text-orange-500 flex-none" />
            <span className="text-2xl md:text-3xl font-black text-gray-900">
              Analysis Overview
            </span>
          </div>

          {/* Context chips */}
          <div className="flex flex-wrap gap-2 mt-3 mb-5">
            {sport && (
              <span className="bg-gray-50 text-gray-600 text-xs px-3 py-1 rounded-full border border-gray-200">
                🏅 {sport}
              </span>
            )}
            {injuries && (
              <span className="bg-gray-50 text-gray-600 text-xs px-3 py-1 rounded-full border border-gray-200">
                🩹 {injuries}
              </span>
            )}
            {baselineFileName && (
              <span className="bg-gray-50 text-gray-500 text-xs px-3 py-1 rounded-full border border-gray-200 truncate max-w-[200px]">
                📂 {baselineFileName} {baselineDate ? `(${baselineDate})` : ""}
              </span>
            )}
            {followUpFileName && (
              <span className="bg-orange-50 text-orange-600 text-xs px-3 py-1 rounded-full border border-orange-200 truncate max-w-[200px]">
                📂 {followUpFileName} {followUpDate ? `(${followUpDate})` : ""}
              </span>
            )}
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl">
              <TrendingUp size={16} className="text-emerald-500" />
              <span className="text-xl font-black text-emerald-700">{improvedCount}</span>
              <span className="text-xs text-emerald-600 font-semibold">Improved</span>
            </div>
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-2 rounded-xl">
              <TrendingDown size={16} className="text-red-500" />
              <span className="text-xl font-black text-red-700">{declinedCount}</span>
              <span className="text-xs text-red-600 font-semibold">Declined</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl">
              <Minus size={16} className="text-gray-400" />
              <span className="text-xl font-black text-gray-600">{noChangeCount}</span>
              <span className="text-xs text-gray-500 font-semibold">Unchanged</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreBanner;
