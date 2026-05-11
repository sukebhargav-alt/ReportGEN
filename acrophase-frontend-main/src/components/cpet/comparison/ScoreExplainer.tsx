import React from "react";
import { Info, X, TrendingUp, TrendingDown, Target, Zap, Activity, Heart, Wind } from "lucide-react";

interface ScoreExplainerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScoreExplainer: React.FC<ScoreExplainerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Info size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">How is your score calculated?</h2>
              <p className="text-orange-100 text-xs font-medium">Understanding the science behind the numbers</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
          {/* Section 1: The 50-Base System */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm">1</span>
              The "50-Base" Logic
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Unlike traditional grading, our progress score uses <span className="font-bold text-gray-900">50</span> as the neutral reference point.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col items-center text-center">
                <TrendingUp className="text-emerald-500 mb-2" size={24} />
                <span className="text-2xl font-black text-emerald-600">&gt; 50</span>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider mt-1">Improvement</span>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col items-center text-center">
                <div className="w-6 h-1 bg-gray-400 mb-5 mt-3 rounded-full" />
                <span className="text-2xl font-black text-gray-600">50</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">No Change</span>
              </div>
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex flex-col items-center text-center">
                <TrendingDown className="text-red-500 mb-2" size={24} />
                <span className="text-2xl font-black text-red-600">&lt; 50</span>
                <span className="text-xs font-bold text-red-700 uppercase tracking-wider mt-1">Decline</span>
              </div>
            </div>
          </section>

          {/* Section 2: Weighted Systems */}
          <section className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm">2</span>
              System Weights
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Your overall score is a weighted average of 5 physiological systems. Systems that are more direct markers of endurance (like Aerobic Capacity) carry more weight.
            </p>

            <div className="space-y-3 mt-4">
              {[
                { label: "Aerobic Capacity", weight: 30, icon: <Activity size={16} />, color: "bg-orange-500" },
                { label: "Cardiovascular System", weight: 25, icon: <Heart size={16} />, color: "bg-red-500" },
                { label: "Ventilation Efficiency", weight: 20, icon: <Wind size={16} />, color: "bg-blue-500" },
                { label: "Metabolic Mastery", weight: 15, icon: <Zap size={16} />, color: "bg-purple-500" },
                { label: "Performance Thresholds", weight: 10, icon: <Target size={16} />, color: "bg-emerald-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center text-white flex-none`}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-sm font-bold text-gray-700">{item.label}</span>
                      <span className="text-xs font-black text-gray-400">{item.weight}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${item.weight}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: The Math */}
          <section className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm">3</span>
              The Math Behind Metrics
            </h3>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <p className="text-gray-600 text-[13px] leading-relaxed italic">
                "For every 1% improvement in a metric, the score increases by 1.5 points. For example, a 10% gain in VO₂ Max results in a metric score of 65 (50 + 15)."
              </p>
            </div>
            <p className="text-gray-500 text-[11px] leading-relaxed">
              * Note: Some metrics (like VE/VCO₂ slope) are "Lower is Better," so the score increases when the value drops. "Reference" metrics like HR Max do not influence the score.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoreExplainer;
