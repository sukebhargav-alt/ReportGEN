import React from "react";
import { Link } from "react-router-dom";
import { Activity, Users, Search } from "lucide-react";

import Header from "../components/Header";
import Footer from "../components/Footer";
import logo from "../../public/logo.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* HERO SECTION */}
          <section className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-16">
            {/* LEFT: LOGO */}
            <img
              src={logo}
              alt="AcroReports Logo"
              className="block h-48 w-auto leading-none"
            />

            {/* RIGHT: TEXT */}
            <div className="text-center md:text-left">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 whitespace-nowrap leading-none">
                Sport-Specific Athlete Profiling
              </h1>

              <p className="text-lg text-gray-600 mt-4 max-w-xl leading-relaxed">
                Generate sport-specific profiling reports that turn performance
                testing data into clear, coach-ready insights.
              </p>

              <div className="mt-6 flex items-center justify-center md:justify-start space-x-4">
                <Link
                  to="/reports"
                  className="inline-flex items-center px-6 py-3 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 transition-colors"
                >
                  Generate Profiling Report
                </Link>

                <Link
                  to="/search"
                  className="inline-flex items-center px-6 py-3 bg-white border border-gray-200 text-sm font-medium rounded-md hover:shadow-md transition-all"
                >
                  View Athlete Profiles
                </Link>
              </div>
            </div>
          </section>

          {/* FEATURE GRID */}
          <div className="grid gap-6 sm:grid-cols-3 mb-12">
            <Feature
              icon={<Activity className="h-6 w-6 text-orange-600" />}
              title="Sport-Specific Profiling Reports"
              text="Automatically generate profiling reports tailored to the physical demands of each sport."
            />

            <Feature
              icon={<Users className="h-6 w-6 text-orange-600" />}
              title="Athlete Profiling History"
              text="Store and compare profiling reports across testing blocks to track long-term development."
            />

            <Feature
              icon={<Search className="h-6 w-6 text-orange-600" />}
              title="Profile-Based Athlete Search"
              text="Search athletes by sport, testing profile, and key physical characteristics."
            />
          </div>

          {/* HOW IT WORKS */}
          <div className="bg-white border border-gray-200 rounded-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              How sport-specific profiling works
            </h2>

            <div className="grid gap-6 sm:grid-cols-3 text-sm text-gray-700">
              <Step
                title="1. Upload test data"
                text="Upload testing files from your performance systems to begin the profiling workflow."
              />
              <Step
                title="2. Generate sport profile"
                text="The system builds a sport-specific performance profile and produces a structured report."
              />
              <Step
                title="3. Store & compare"
                text="Reports are saved to athlete profiles for comparison across seasons and testing blocks."
              />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ------------------ */
/* SMALL HELPER PARTS */
/* ------------------ */

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-4">
        <div className="bg-orange-50 p-3 rounded-md">{icon}</div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Step({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="font-medium mb-2">{title}</div>
      <p>{text}</p>
    </div>
  );
}
