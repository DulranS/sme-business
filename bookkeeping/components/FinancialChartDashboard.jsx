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
  financialData = [],
  grossProfit = 0,
  netProfit = 0,
}) {
  const [activeTab, setActiveTab] = useState("trend");

  // Format currency for display
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-gray-800 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: LKR {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Map data to ensure netCashFlow exists
  const chartData = financialData.map((d) => ({
    month: typeof d.month === "number" ? `Month +${d.month}` : d.month,
    inflow: d.inflow || 0,
    outflow: d.outflow || 0,
    netCashFlow: d.netCashFlow !== undefined ? d.netCashFlow : (d.inflow || 0) - (d.outflow || 0),
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
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickLine={{ stroke: '#9ca3af' }}
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickLine={{ stroke: '#9ca3af' }}
                  label={{ value: 'Amount (LKR)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="inflow"
                  name="Inflow"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="outflow"
                  name="Outflow"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="netCashFlow"
                  name="Net Cash Flow"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-gray-400">
                Not enough data to display trends. Add at least 30 days of transactions.
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
            <BarChart 
              data={[{ name: "Profit Analysis", grossProfit, netProfit }]}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fill: '#6b7280', fontSize: 12 }}
                label={{ value: 'Amount (LKR)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar 
                dataKey="grossProfit" 
                name="Gross Profit"
                fill="#3B82F6" 
                barSize={80}
                radius={[8, 8, 0, 0]}
              />
              <Bar 
                dataKey="netProfit" 
                name="Net Profit"
                fill="#F59E0B" 
                barSize={80}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === "summary" && (
        <div className="p-6 bg-white rounded-2xl shadow">
          <h2 className="font-semibold text-lg mb-4 text-gray-700">Financial Summary</h2>
          <div className="space-y-3 text-gray-600">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="font-medium">Total Inflow:</span>
              <span className="font-bold text-green-600">
                LKR {formatCurrency(chartData.reduce((a, b) => a + (b.inflow || 0), 0))}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="font-medium">Total Outflow:</span>
              <span className="font-bold text-red-600">
                LKR {formatCurrency(chartData.reduce((a, b) => a + (b.outflow || 0), 0))}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="font-medium">Gross Profit:</span>
              <span className="font-bold text-blue-600">
                LKR {formatCurrency(grossProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span className="font-medium">Net Profit:</span>
              <span className={`font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                LKR {formatCurrency(netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}