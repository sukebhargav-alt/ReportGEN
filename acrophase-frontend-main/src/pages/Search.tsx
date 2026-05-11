import React, { useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Search as SearchIcon, Filter, Download } from "lucide-react";

export default function Search() {
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("");

  const mockResults = [
    {
      id: 1,
      name: "Amal HS",
      age: 24,
      gender: "Male",
      sport: "Short Distance Running",
    },
    {
      id: 2,
      name: "Suke Bhargav",
      age: 28,
      gender: "Male",
      sport: "Cricket",
    },
  ];

  const filteredResults = mockResults.filter((athlete) => {
    const matchesSearch = athlete.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesSport = sport ? athlete.sport === sport : true;

    return matchesSearch && matchesSport;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <SearchIcon className="h-8 w-8 text-orange-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                Athlete Search
              </h1>
            </div>
            <p className="text-gray-600">
              Search athlete profiles and filter by sport
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Filter Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Filters
                  </h2>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Athlete
                  </label>
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sport
                  </label>
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">All Sports</option>
                    <option value="Tennis">Tennis</option>
                    <option value="Amateur Boxing">Amateur Boxing</option>
                    <option value="Short Distance Running">
                      Short Distance Running
                    </option>
                    <option value="Long Distance Running">
                      Long Distance Running
                    </option>
                    <option value="Throwing Events">Throwing Events</option>
                    <option value="Football">Football</option>
                    <option value="Cricket">Cricket</option>
                    <option value="Basketball">Basketball</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Search Results
                  </h2>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                    <Download className="h-4 w-4" />
                    <span>Export</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Athlete
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sport
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredResults.map((athlete) => (
                        <tr key={athlete.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {athlete.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {athlete.age} years • {athlete.gender}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {athlete.sport}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-orange-600 hover:text-orange-900">
                              View Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredResults.length === 0 && (
                  <div className="text-center py-12">
                    <SearchIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Results Found
                    </h3>
                    <p className="text-gray-600">
                      Try adjusting your search or sport filter.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
