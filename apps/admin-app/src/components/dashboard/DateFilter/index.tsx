"use client";

interface DateFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  const options = [
    { label: "Today", value: "today" },
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <div className="dash-filter">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`dash-filter-btn${value === opt.value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
