"use client";

import React from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";

// Custom Node Component with better styling
const FinancialNode = ({ data }) => {
  return (
    <div
      style={{
        background: data.bg,
        border: `3px solid ${data.border}`,
        borderRadius: 16,
        padding: 16,
        minWidth: 180,
        textAlign: "center",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }}>{data.icon}</div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "#1f2937" }}>
        {data.title}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: data.border }}>
        {data.value}
      </div>
      {data.subtitle && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          {data.subtitle}
        </div>
      )}
    </div>
  );
};

export function FinancialStrategyMap({ totals, grossProfit, netProfit, grossMarginPercent }) {
  const nodeTypes = { financialNode: FinancialNode };

  const formatLKR = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const nodes = [
    {
      id: "inflow",
      type: "financialNode",
      position: { x: 50, y: 50 },
      data: {
        icon: "💰",
        title: "Revenue Inflow",
        value: `LKR ${formatLKR(totals.inflow)}`,
        bg: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
        border: "#10B981",
      },
    },
    {
      id: "outflow",
      type: "financialNode",
      position: { x: 450, y: 50 },
      data: {
        icon: "💸",
        title: "Direct Costs",
        value: `LKR ${formatLKR(totals.outflow)}`,
        bg: "linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)",
        border: "#EF4444",
      },
    },
    {
      id: "overhead",
      type: "financialNode",
      position: { x: 650, y: 180 },
      data: {
        icon: "🏢",
        title: "Overhead",
        value: `LKR ${formatLKR(totals.overhead)}`,
        bg: "linear-gradient(135deg, #FED7AA 0%, #FDBA74 100%)",
        border: "#F97316",
      },
    },
    {
      id: "reinvestment",
      type: "financialNode",
      position: { x: 650, y: 320 },
      data: {
        icon: "📈",
        title: "Reinvestment",
        value: `LKR ${formatLKR(totals.reinvestment)}`,
        bg: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)",
        border: "#3B82F6",
      },
    },
    {
      id: "grossprofit",
      type: "financialNode",
      position: { x: 250, y: 220 },
      data: {
        icon: "📊",
        title: "Gross Profit",
        value: `LKR ${formatLKR(grossProfit)}`,
        subtitle: `${grossMarginPercent.toFixed(1)}% margin`,
        bg: "linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%)",
        border: "#6366F1",
      },
    },
    {
      id: "netprofit",
      type: "financialNode",
      position: { x: 250, y: 420 },
      data: {
        icon: netProfit >= 0 ? "✅" : "⚠️",
        title: "Net Profit",
        value: `LKR ${formatLKR(netProfit)}`,
        subtitle: netProfit >= 0 ? "Profitable" : "Loss",
        bg: netProfit >= 0 
          ? "linear-gradient(135deg, #FEF9C3 0%, #FEF08A 100%)" 
          : "linear-gradient(135deg, #FECACA 0%, #FCA5A5 100%)",
        border: netProfit >= 0 ? "#EAB308" : "#EF4444",
      },
    },
    {
      id: "loans",
      type: "financialNode",
      position: { x: 50, y: 420 },
      data: {
        icon: "🏦",
        title: "Loan Impact",
        value: `LKR ${formatLKR(totals.loanReceived - totals.loanPayment)}`,
        subtitle: `Received: ${formatLKR(totals.loanReceived)} | Paid: ${formatLKR(totals.loanPayment)}`,
        bg: "linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)",
        border: "#A855F7",
      },
    },
  ];

  const edges = [
    { 
      id: "e1", 
      source: "inflow", 
      target: "grossprofit", 
      label: "Revenue", 
      animated: true, 
      style: { stroke: "#10B981", strokeWidth: 3 },
      labelStyle: { fill: "#10B981", fontWeight: 600 }
    },
    { 
      id: "e2", 
      source: "outflow", 
      target: "grossprofit", 
      label: "− Costs", 
      animated: true, 
      style: { stroke: "#EF4444", strokeWidth: 3 },
      labelStyle: { fill: "#EF4444", fontWeight: 600 }
    },
    { 
      id: "e3", 
      source: "grossprofit", 
      target: "netprofit", 
      animated: true, 
      style: { stroke: "#6366F1", strokeWidth: 3 }
    },
    { 
      id: "e4", 
      source: "overhead", 
      target: "netprofit", 
      label: "− Overhead", 
      animated: true, 
      style: { stroke: "#F97316", strokeWidth: 2 },
      labelStyle: { fill: "#F97316", fontWeight: 600 }
    },
    { 
      id: "e5", 
      source: "reinvestment", 
      target: "netprofit", 
      label: "− Reinvest", 
      animated: true, 
      style: { stroke: "#3B82F6", strokeWidth: 2 },
      labelStyle: { fill: "#3B82F6", fontWeight: 600 }
    },
    { 
      id: "e6", 
      source: "loans", 
      target: "netprofit", 
      label: "± Loans", 
      animated: true, 
      style: { stroke: "#A855F7", strokeWidth: 2, strokeDasharray: "5,5" },
      labelStyle: { fill: "#A855F7", fontWeight: 600 }
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Financial Strategy Map</h2>
        <p className="text-sm text-gray-600">Visual representation of your cash flow and profitability structure</p>
      </div>
      <div style={{ height: 600, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
          defaultEdgeOptions={{
            type: 'smoothstep',
          }}
        >
          <Background color="#93c5fd" gap={16} />
          <Controls />
          <MiniMap 
            nodeStrokeWidth={3} 
            nodeColor={(node) => node.data.border}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        </ReactFlow>
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-600">Positive Cash Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600">Negative Cash Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-600">Strategic Investment</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-gray-600">Financing</span>
        </div>
      </div>
    </div>
  );
}