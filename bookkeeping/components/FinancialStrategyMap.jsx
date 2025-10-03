"use client";

import React, { useState } from "react";
import {
  Brain,
  Database,
  RefreshCw,
  Target,
  Lightbulb,
} from "lucide-react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";

// ✅ Financial Strategy Map Component
export function FinancialStrategyMap({ totals, grossProfit, netProfit, grossMarginPercent }) {
  const nodes = [
    {
      id: "1",
      position: { x: 100, y: 50 },
      data: { label: `💰 Inflows\nLKR ${totals.inflow.toLocaleString()}` },
      style: { background: "#D1FAE5", border: "2px solid #10B981", borderRadius: 12, padding: 10 },
    },
    {
      id: "2",
      position: { x: 400, y: 50 },
      data: { label: `💸 Outflows\nLKR ${totals.outflow.toLocaleString()}` },
      style: { background: "#FEE2E2", border: "2px solid #EF4444", borderRadius: 12, padding: 10 },
    },
    {
      id: "3",
      position: { x: 250, y: 200 },
      data: { label: `📊 Gross Profit\nLKR ${grossProfit.toLocaleString()} (${grossMarginPercent.toFixed(1)}%)` },
      style: { background: "#DBEAFE", border: "2px solid #3B82F6", borderRadius: 12, padding: 10 },
    },
    {
      id: "4",
      position: { x: 250, y: 350 },
      data: { label: `📈 Net Profit\nLKR ${netProfit.toLocaleString()}` },
      style: { background: "#FEF9C3", border: "2px solid #EAB308", borderRadius: 12, padding: 10 },
    },
    {
      id: "5",
      position: { x: 550, y: 350 },
      data: { label: "🔮 Forecast & Targets" },
      style: { background: "#F3E8FF", border: "2px solid #A855F7", borderRadius: 12, padding: 10 },
    },
  ];

  const edges = [
    { id: "e1-3", source: "1", target: "3", label: "Revenue → Profit", animated: true, style: { stroke: "#10B981" } },
    { id: "e2-3", source: "2", target: "3", label: "Costs → Profit", animated: true, style: { stroke: "#EF4444" } },
    { id: "e3-4", source: "3", target: "4", label: "Profit → Net", animated: true, style: { stroke: "#3B82F6" } },
    { id: "e4-5", source: "4", target: "5", label: "Net → Forecast", animated: true, style: { stroke: "#A855F7" } },
  ];

  return (
    <div className="h-[500px] bg-white rounded-2xl shadow p-2">
      <h2 className="text-lg font-semibold text-gray-700 mb-2">
        Strategic Financial Map
      </h2>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
        <MiniMap nodeStrokeWidth={3} />
      </ReactFlow>
    </div>
  );
}

// ✅ Main Dashboard Component
export default function FinancialDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Example static data (replace with dynamic totals later)
  const totals = { inflow: 1200000, outflow: 850000 };
  const grossProfit = 350000;
  const netProfit = 290000;
  const grossMarginPercent = (grossProfit / totals.inflow) * 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Financial Intelligence Dashboard
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === "overview"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Database size={16} /> Overview
          </button>

          <button
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === "ai"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Brain size={16} /> AI Insights
          </button>

          <button
            onClick={() => setActiveTab("strategy")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              activeTab === "strategy"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Lightbulb size={16} /> Strategy Map
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="p-6 bg-white rounded-2xl shadow text-gray-600">
          <h2 className="font-semibold text-lg mb-3">Overview Summary</h2>
          <p>Total inflow: LKR {totals.inflow.toLocaleString()}</p>
          <p>Total outflow: LKR {totals.outflow.toLocaleString()}</p>
          <p>Gross profit: LKR {grossProfit.toLocaleString()}</p>
          <p>Net profit: LKR {netProfit.toLocaleString()}</p>
        </div>
      )}

      {activeTab === "ai" && (
        <div className="p-6 bg-white rounded-2xl shadow text-gray-600">
          <h2 className="font-semibold text-lg mb-3">AI Insights</h2>
          <p>💡 Example: Outflows are rising faster than inflows by 12%.</p>
          <p>Recommendation: Review vendor contracts and optimize COGS.</p>
        </div>
      )}

      {activeTab === "strategy" && (
        <FinancialStrategyMap
          totals={totals}
          grossProfit={grossProfit}
          netProfit={netProfit}
          grossMarginPercent={grossMarginPercent}
        />
      )}
    </div>
  );
}
