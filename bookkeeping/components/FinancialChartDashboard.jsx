"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { LineChart as ChartIcon, BarChart2, Database } from "lucide-react";

export default function FinancialChartDashboard({
  financialData = [], // array of { month, inflow, outflow }
  grossProfit = 0,
  netProfit = 0,
}) {
  const [activeTab, setActiveTab] = useState("trend");

  // Derived values: compute net profit for each month
  const chartData = financialData.map((d) => ({
    ...d,
    netProfit: d.inflow - d.outflow,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Financial Performance Dashboard
        </h1>

        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab("trend")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === "trend"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <ChartIcon size={16} /> Trends
          </button>

          <button
            onClick={() => setActiveTab("comparison")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === "comparison"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <BarChart2 size={16} /> Comparison
          </button>

          <button
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === "summary"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Database size={16} /> Summary
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "trend" && (
        <div className="p-6 bg-white rounded-2xl shadow">
          <h2 className="font-semibold text-lg mb-3 text-gray-700">
            Inflow vs Outflow vs Net Profit
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="inflow"
                stroke="#10B981"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="outflow"
                stroke="#EF4444"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="netProfit"
                stroke="#3B82F6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === "comparison" && (
        <div className="p-6 bg-white rounded-2xl shadow">
          <h2 className="font-semibold text-lg mb-3 text-gray-700">
            Gross vs Net Profit Comparison
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={[{ name: "Profit", grossProfit, netProfit }]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="grossProfit" fill="#3B82F6" barSize={80} />
              <Bar dataKey="netProfit" fill="#F59E0B" barSize={80} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === "summary" && (
        <div className="p-6 bg-white rounded-2xl shadow text-gray-600">
          <h2 className="font-semibold text-lg mb-3">Financial Summary</h2>
          <p>
            📈 Total inflow (6 months): LKR{" "}
            {chartData.reduce((a, b) => a + b.inflow, 0).toLocaleString()}
          </p>
          <p>
            📉 Total outflow (6 months): LKR{" "}
            {chartData.reduce((a, b) => a + b.outflow, 0).toLocaleString()}
          </p>
          <p>💰 Gross Profit: LKR {grossProfit.toLocaleString()}</p>
          <p>🏦 Net Profit: LKR {netProfit.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
