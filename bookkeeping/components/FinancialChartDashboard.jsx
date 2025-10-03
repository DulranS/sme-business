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
  financialData = [], // array of { month, inflow, outflow, netCashFlow }
  grossProfit = 0,
  netProfit = 0,
}) {
  const [activeTab, setActiveTab] = useState("trend");

  // Map data to ensure netCashFlow exists for LineChart
  const chartData = financialData.map((d) => ({
    month: typeof d.month === "number" ? `Month ${d.month}` : d.month,
    inflow: d.inflow || 0,
    outflow: d.outflow || 0,
    netCashFlow: d.netCashFlow || d.inflow - d.outflow || 0,
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
            Cash Flow Trends
          </h2>

          <ResponsiveContainer width="100%" height={400}>
            {chartData.length > 0 ? (
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
                  dataKey="netCashFlow"
                  stroke="#3B82F6"
                  strokeWidth={2}
                />
              </LineChart>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-gray-400">
                Not enough data to display trends
              </div>
            )}
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
            📈 Total inflow: LKR{" "}
            {chartData.reduce((a, b) => a + (b.inflow || 0), 0).toLocaleString()}
          </p>
          <p>
            📉 Total outflow: LKR{" "}
            {chartData.reduce((a, b) => a + (b.outflow || 0), 0).toLocaleString()}
          </p>
          <p>
            💰 Gross Profit: LKR {grossProfit.toLocaleString()}
          </p>
          <p>
            🏦 Net Profit: LKR {netProfit.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
