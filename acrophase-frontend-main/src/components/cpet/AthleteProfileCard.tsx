import React, { memo } from "react";

interface Props {
  profile: Record<string, any>;
  sport: string;
  injuries: string;
  baselineDate?: string | null;
  followUpDate?: string | null;
}

function AthleteProfileCard({ profile, sport, injuries, baselineDate, followUpDate }: Props) {
  const bmi =
    profile["BMI (kg/m2)"] ||
    (profile["Weight (kg)"] && profile["Height (cm)"]
      ? (
          Number(profile["Weight (kg)"]) /
          Math.pow(Number(profile["Height (cm)"]) / 100, 2)
        ).toFixed(2)
      : "N/A");

  const fields = [
    { label: "First Name", value: profile["First Name"] },
    { label: "Last Name", value: profile["Last Name"] },
    { label: "Gender", value: profile["Gender"] },
    {
      label: "Age",
      value: profile["Age"] ? Math.floor(parseFloat(String(profile["Age"]).replace(/[^0-9.]/g, ''))) : "N/A",
    },
    {
      label: "Height",
      value: profile["Height (cm)"] ? `${profile["Height (cm)"]} cm` : "N/A",
    },
    {
      label: "Weight",
      value: profile["Weight (kg)"] ? `${profile["Weight (kg)"]} kg` : "N/A",
    },
    { label: "BMI", value: bmi },
    {
      label: "Protocol & HR Max",
      value: `Protocol: ${profile["Protocol"] || "-"} | HR Max: ${profile["HR Max"] || "-"}`,
    },
    { label: "Exercise Duration", value: profile["Exercise Duration"] },
    { label: "Sport", value: sport },
    { label: "Injuries", value: injuries },
  ];

  if (baselineDate !== undefined) {
    fields.push({ label: "Baseline Date", value: baselineDate || "Unknown" });
  }
  if (followUpDate !== undefined) {
    fields.push({ label: "Follow-up Date", value: followUpDate || "Unknown" });
  }

  return (
    <div className="bg-white p-6 rounded shadow mt-8">
      <h2 className="text-xl font-semibold mb-4">Athlete Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
        {fields.map((item) => (
          <div
            key={item.label}
            className="flex flex-col sm:flex-row justify-between border-b py-2"
          >
            <span className="font-medium text-gray-700">{item.label}</span>
            <span className="text-gray-900 font-semibold text-right">
              {item.value || "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(AthleteProfileCard);
