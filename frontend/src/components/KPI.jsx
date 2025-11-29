// src/components/KPI.jsx
import React from "react";
import Sparkline from "./Sparkline";

export default function KPI({ title, value, delta, sparkData, className = "" }) {
  const deltaIsPositive = Number(delta) >= 0;
  return (
    <div className={`rounded-2xl p-4 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-300">{title}</div>
          <div className="mt-1 text-2xl font-semibold text-green-700 dark:text-green-300">{value}</div>
          <div className="mt-1 text-sm">
            <span className={`inline-flex items-center text-sm font-medium ${deltaIsPositive ? "text-green-600" : "text-red-500"}`}>
              {deltaIsPositive ? "▲" : "▼"} {Math.abs(Number(delta)).toFixed(2)}%
            </span>
            <span className="ml-2 text-xs text-gray-400"> vs. prev</span>
          </div>
        </div>
        <div className="w-28 h-12">
          <Sparkline data={sparkData} positive={deltaIsPositive} />
        </div>
      </div>
    </div>
  );
}
