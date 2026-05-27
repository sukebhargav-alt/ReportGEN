import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

interface NameInputReportProps {
  title: string;
}

export default function NameInputReport({ title }: NameInputReportProps) {
  const navigate = useNavigate();
  const [athleteName, setAthleteName] = React.useState("");

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
              disabled={!athleteName.trim()}
              className={`bg-orange-600 text-white px-6 py-2 rounded-2xl transition-opacity ${
                athleteName.trim() ? "hover:bg-orange-700" : "opacity-50 cursor-not-allowed"
              }`}
            >
              Continue
            </button>
            <span className="text-sm text-gray-500">
              Report-specific generation will be added in the next implementation pass.
            </span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
