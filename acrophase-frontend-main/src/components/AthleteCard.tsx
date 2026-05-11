import React from "react";
import { User, Calendar, FileText } from "lucide-react";

interface AthleteCardProps {
  name: string;
  age: number;
  gender: string;
  sport: string;
  reportCount: number;
  latestReportDate: string;
  onClick: () => void;
}

const AthleteCard = ({
  name,
  age,
  gender,
  sport,
  reportCount,
  latestReportDate,
  onClick,
}: AthleteCardProps) => {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-100 p-2 rounded-full">
            <User className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
            <p className="text-sm text-gray-600">
              {age} years • {gender} • {sport}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">{reportCount} reports</span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Latest: {latestReportDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AthleteCard;
