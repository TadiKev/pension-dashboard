// src/components/ChartCard.jsx
import React from "react";

export default function ChartCard({ title, subtitle, children, actions }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-300">{subtitle}</div>
          <div className="text-lg font-semibold">{title}</div>
        </div>
        <div className="flex space-x-2">
          {actions}
        </div>
      </div>
      <div className="flex-1 min-h-[200px]">
        {children}
      </div>
    </div>
  );
}
