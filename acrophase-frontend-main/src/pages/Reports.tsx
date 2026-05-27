import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import TestSystemCard from "../components/TestSystemCard";
import {
  FileText,
  Activity,
  Dumbbell,
  Footprints,
  Scale,
} from "lucide-react";

export default function Reports() {
  const navigate = useNavigate();

  const reports = [
    {
      id: "profiling",
      title: "Profiling Report",
      description: "Get Started",
      icon: <Activity className="h-6 w-6 text-orange-600" />,
    },
    {
      id: "cpet",
      title: "CPET Report",
      description: "Get Started",
      icon: <Activity className="h-6 w-6 text-orange-600" />,
    },
    {
      id: "dynamometer",
      title: "Dynamometer Report",
      description: "Get Started",
      icon: <Dumbbell className="h-6 w-6 text-orange-600" />,
    },
    {
      id: "forcedecks",
      title: "ForceDecks Report",
      description: "Get Started",
      icon: <Footprints className="h-6 w-6 text-orange-600" />,
    },
    {
      id: "bca",
      title: "BCA",
      description: "Get Started",
      icon: <Scale className="h-6 w-6 text-orange-600" />,
    },
  ];

  const handleReportClick = (reportId: string) => {
    navigate(`/reports/${reportId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <FileText className="h-8 w-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            </div>
            <p className="text-gray-600">
              Select a report type to generate or upload data.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <TestSystemCard
                key={report.id}
                title={report.title}
                description={report.description}
                icon={report.icon}
                onClick={() => handleReportClick(report.id)}
              />
            ))}
          </div>

          <div className="mt-12 bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-orange-900 mb-2">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-6 text-sm text-orange-800">
              <div>
                <div className="font-medium mb-1">1. Select Report Type</div>
                <p>Choose the report type you want to generate.</p>
              </div>
              <div>
                <div className="font-medium mb-1">2. Upload Data</div>
                <p>Upload athlete test data to populate the report model.</p>
              </div>
              <div>
                <div className="font-medium mb-1">3. Generate Report</div>
                <p>Generate a structured report for coaches and athletes.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
