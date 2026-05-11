import React from "react";

interface HRZonesChartProps {
  hrMax: number;
  vt1?: number | null;
  vt2?: number | null;
}

export default function HRZonesChart({ hrMax, vt1, vt2 }: HRZonesChartProps) {
  // Helper to map a BPM value into degrees inside the 180 deg semi-circle
  const getRotationAngle = (bpm: number) => {
    const minHR = 0.5 * hrMax; // 50%
    const maxHR = hrMax;       // 100%
    const clamped = Math.max(minHR, Math.min(bpm, maxHR));
    const percentage = (clamped - minHR) / (maxHR - minHR);
    const degree = percentage * 180;
    // ensure within 0 to 180 bounds
    return Math.max(0, Math.min(180, degree));
  };

  return (
    <div className="flex flex-col items-center w-full mt-4 pb-2">
      <div className="relative w-full max-w-[500px] aspect-[2/1] overflow-hidden">
        
        {/* Main Gradient Arc via SVG for Native html2canvas Support */}
        <div className="absolute top-0 left-0 w-full h-[200%]">
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", overflow: "visible" }}>
            {/* SVG Circle is 100x100, Center is 50,50. We want outer radius 50, inner radius 25 -> r=37.5, strokeWidth=25 */}
            {(() => {
              const r = 37.5;
              const c = 2 * Math.PI * r;
              const halfC = c / 2;
              const zones = [
                { p: 0.20, color: "#7cb1ea" },
                { p: 0.30, color: "#8dc550" },
                { p: 0.20, color: "#efa133" },
                { p: 0.20, color: "#e35156" },
                { p: 0.10, color: "#a93031" },
              ];
              let currentOffset = 0;
              return zones.map((z, i) => {
                const length = z.p * halfC;
                const offset = currentOffset;
                currentOffset += length;
                return (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke={z.color}
                    strokeWidth="25"
                    strokeDasharray={`${length} ${c}`}
                    strokeDashoffset={-offset}
                    transform="rotate(180 50 50)"
                  />
                );
              });
            })()}
          </svg>
        </div>

        {/* Inner White Cutout (Creates the Donut Shape) */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[50%] h-[50%] bg-white rounded-t-full flex items-end justify-center pb-2 shadow-inner z-10 box-border">
          <div className="absolute inset-0 rounded-t-full border border-gray-100 border-b-0 pointer-events-none"></div>
          <div className="flex flex-col items-center">
            <span className="text-gray-500 font-semibold text-xs">HRmax</span>
            <span className="text-xl font-extrabold text-gray-900 leading-tight tracking-tight">
               {Math.round(hrMax)} <span className="text-[11px] opacity-70">bpm</span>
            </span>
          </div>
        </div>

        {/* Labels positioned directly within the color bands */}
        <div className="absolute top-[50%] left-[16%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-[#1e3a8a] z-10 w-[70px] text-center">
          <span className="font-bold text-sm leading-none">Z1</span>
          <span className="text-[10px] font-semibold">Light</span>
        </div>
        <div className="absolute top-[22%] left-[34%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-[#14532d] z-10 w-[80px] text-center">
          <span className="font-bold text-sm leading-none">Z2</span>
          <span className="text-[10px] font-semibold">Moderate</span>
        </div>
        <div className="absolute top-[15%] left-[65%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-[#713f12] z-10 w-[80px] text-center">
          <span className="font-bold text-sm leading-none">Z3</span>
          <span className="text-[10px] font-semibold">Vigorous</span>
        </div>
        <div className="absolute top-[35%] left-[82%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-white z-10 w-[70px] text-center drop-shadow-md">
          <span className="font-bold text-sm leading-none">Z4</span>
          <span className="text-[10px] font-semibold text-gray-100">Hard</span>
        </div>
        <div className="absolute top-[70%] left-[88%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-white z-10 w-[60px] text-center drop-shadow-md">
          <span className="font-bold text-sm leading-none">Z5</span>
          <span className="text-[10px] font-semibold text-gray-100">Maximal</span>
        </div>

        {/* Peripheral Percentage Limits */}
        <span className="absolute bottom-[2%] left-1 text-[10px] font-bold text-gray-500">50%</span>
        <span className="absolute top-[38%] left-3 text-[10px] font-bold text-gray-500">60%</span>
        <span className="absolute top-2 left-[30%] text-[10px] font-bold text-gray-500">75%</span>
        <span className="absolute top-2 right-[30%] text-[10px] font-bold text-gray-500">85%</span>
        <span className="absolute top-[38%] right-2 text-[10px] font-bold text-gray-500">95%</span>
        <span className="absolute bottom-[2%] right-[2%] text-[10px] font-bold text-gray-500">100%</span>

        {/* VT Markers Container */}
        <div className="absolute bottom-0 left-1/2 w-0 h-full pointer-events-none z-20">
          
          {vt1 != null && hrMax > 0 && (
             <div
               className="absolute bottom-0 left-0 w-[2px] h-[105%]"
               style={{
                 transformOrigin: "bottom center",
                 transform: `rotate(${getRotationAngle(vt1) - 90}deg)`,
               }}
             >
               {/* Arrow line starts above the white center hole (which is 55% tall, so ~27.5% radius). We draw from 35% up to 100% */}
               <div className="absolute bottom-[25%] left-0 w-0 h-[75%] border-l-2 border-dashed border-[#065f46]" />
               
               {/* Label anchored slightly beyond outer radius */}
               <div
                 className="absolute top-[-10px] -left-[14px] font-extrabold text-[#065f46] text-xs bg-white bg-opacity-70 px-1 rounded shadow-sm"
                 style={{ transform: `rotate(${-(getRotationAngle(vt1) - 90)}deg)` }}
               >
                 VT1
               </div>
             </div>
          )}

          {vt2 != null && hrMax > 0 && (
             <div
               className="absolute bottom-0 left-0 w-[2px] h-[105%]"
               style={{
                 transformOrigin: "bottom center",
                 transform: `rotate(${getRotationAngle(vt2) - 90}deg)`,
               }}
             >
               <div className="absolute bottom-[25%] left-0 w-0 h-[75%] border-l-2 border-dashed border-[#7f1d1d]" />
               <div
                 className="absolute top-[-10px] -left-[14px] font-extrabold text-[#7f1d1d] text-xs bg-white bg-opacity-70 px-1 rounded shadow-sm"
                 style={{ transform: `rotate(${-(getRotationAngle(vt2) - 90)}deg)` }}
               >
                 VT2
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
