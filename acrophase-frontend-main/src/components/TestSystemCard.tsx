import React from "react";
import { ChevronRight } from "lucide-react";

interface TestSystemCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const TestSystemCard = ({
  title,
  description,
  icon,
  onClick,
}: TestSystemCardProps) => {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-orange-100 p-3 rounded-lg">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-orange-600 transition-colors" />
      </div>
    </div>
  );
};

export default TestSystemCard;
