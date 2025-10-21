"use client";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Papa from "papaparse";
import {
  Plus, Pencil, Trash2, DollarSign, Download, TrendingUp,
  Calendar, BarChart3, AlertCircle, Target, Lightbulb, Award,
  AlertTriangle, CheckCircle, Database, RefreshCw, Brain, Users,
  FileText, Bell, Calculator, Percent, ShoppingCart, Package,
  Sparkles, Zap, Clock, Factory, CreditCard, Shield, Recycle,
  ArrowUp, HeartPulse, Repeat, Lock, ArrowRight, Layers, ChevronUp, ChevronDown
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const STRATEGIC_WEIGHTS = {
  Inflow: 10,
  Reinvestment: 8,
  "Loan Received": 7,
  "Inventory Purchase": 5,
  Logistics: -2,
  Refund: -6,
  Outflow: -3,
  Overhead: -4,
  "Loan Payment": -2,
  "Cash Flow Gap": -5,
  "On Hold Cash": -7,
};

const categoryLabels = {
  Inflow: "Revenue",
  Outflow: "Payment",
  Overhead: "Financial Control",
  Reinvestment: "Reinvestment",
  "Loan Payment": "Loan Payment",
  "Loan Received": "Loan Received",
  "Inventory Purchase": "Inventory Purchase",
  Logistics: "Logistics",
  Refund: "Refund",
  "Cash Flow Gap": "Cash Flow Gap (Delayed)",
  "On Hold Cash": "On Hold Cash",
};

const internalCategories = [
  "Inflow", "Outflow", "Reinvestment", "Overhead", "Loan Payment",
  "Loan Received", "Inventory Purchase", "Logistics", "Refund",
  "Cash Flow Gap", "On Hold Cash"
];

const userSelectableCategories = internalCategories.filter(cat => cat !== "Cash Flow Gap");
const categories = userSelectableCategories;

export default function BookkeepingApp() {
  const [records, setRecords] = useState([]);
  const [recurringCosts, setRecurringCosts] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
  const [isEditingRecurring, setIsEditingRecurring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    paymentDate: "",
    description: "",
    category: "Inflow",
    amount: "",
    costPerUnit: "",
    quantity: "",
    notes: "",
    customer: "",
    project: "",
    tags: "",
    marketPrice: "",
    suppliedBy: "",
  });
  const [recurringForm, setRecurringForm] = useState({
    description: "",
    amount: "",
    notes: "",
  });
  const [targetRevenue, setTargetRevenue] = useState(100000);
  const [monthlyLoanTarget, setMonthlyLoanTarget] = useState(458333);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [budgets, setBudgets] = useState({});
  const [budgetCategory, setBudgetCategory] = useState("Overhead");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [groupBy, setGroupBy] = useState("none");
  const csvInputRef = useRef(null);

  // --- Optimized Data Loaders ---
  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookkeeping_records")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error loading records:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBudgets = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("category_budgets").select("*");
      if (!error && data) {
        const budgetMap = {};
        data.forEach(b => budgetMap[b.category] = b.amount);
        setBudgets(budgetMap);
      }
    } catch (error) {
      console.error("Error loading budgets:", error);
    }
  }, []);

  const loadRecurringCosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("recurring_costs")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error) setRecurringCosts(data || []);
    } catch (error) {
      console.error("Error loading recurring costs:", error);
    }
  }, []);

  const syncRecords = useCallback(async () => {
    setSyncing(true);
    try {
      await Promise.all([
        loadRecords(),
        loadBudgets(),
        loadRecurringCosts()
      ]);
      await generateRecurringRecords();
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Failed to sync data. Please check your connection.");
    } finally {
      setSyncing(false);
    }
  }, [loadRecords, loadBudgets, loadRecurringCosts]);

  const filteredRecords = useMemo(() => {
    if (!dateFilter.start && !dateFilter.end) return records;
    const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
    const endDate = dateFilter.end ? new Date(dateFilter.end) : null;
    return records.filter(r => {
      const recordDate = new Date(r.date);
      if (startDate && endDate) return recordDate >= startDate && recordDate <= endDate;
      if (startDate) return recordDate >= startDate;
      if (endDate) return recordDate <= endDate;
      return true;
    });
  }, [records, dateFilter]);

  const inventoryCostMap = useMemo(() => {
    const map = new Map();
    const inventoryRecords = filteredRecords.filter(r => r.category === "Inventory Purchase");
    for (const r of inventoryRecords) {
      const key = r.description;
      const qty = parseFloat(r.quantity) || 0;
      const cost = parseFloat(r.cost_per_unit) || 0;
      if (!key || cost <= 0) continue;
      if (!map.has(key)) {
        map.set(key, { totalCost: 0, totalQty: 0 });
      }
      const entry = map.get(key);
      entry.totalCost += cost * qty;
      entry.totalQty += qty;
    }
    const result = {};
    for (const [key, entry] of map) {
      if (entry.totalQty > 0) {
        result[key] = entry.totalCost / entry.totalQty;
      }
    }
    return result;
  }, [filteredRecords]);

  const totals = useMemo(() => {
    let inflow = 0, inflowCost = 0, inflowProfit = 0, outflow = 0, 
        reinvestment = 0, overhead = 0, loanPayment = 0, loanReceived = 0,
        logistics = 0, refund = 0, onHoldCash = 0;
    for (const r of filteredRecords) {
      if (r.category === "Cash Flow Gap") continue;
      const amount = parseFloat(r.amount) || 0;
      const quantity = parseFloat(r.quantity) || 1;
      const totalAmount = amount * quantity;
      if (r.category === "On Hold Cash") {
        onHoldCash += totalAmount;
        continue;
      }
      if (r.category === "Inflow") {
        let costPerUnit = parseFloat(r.cost_per_unit) || 0;
        if (!costPerUnit && r.description && inventoryCostMap[r.description]) {
          costPerUnit = inventoryCostMap[r.description];
        }
        const cost = costPerUnit * quantity;
        inflow += totalAmount;
        inflowCost += cost;
        if (costPerUnit > 0) inflowProfit += totalAmount - cost;
      } else {
        switch (r.category) {
          case "Outflow": outflow += totalAmount; break;
          case "Reinvestment": reinvestment += totalAmount; break;
          case "Overhead": overhead += totalAmount; break;
          case "Loan Payment": loanPayment += totalAmount; break;
          case "Loan Received": loanReceived += totalAmount; break;
          case "Logistics": logistics += totalAmount; break;
          case "Refund": refund += totalAmount; break;
        }
      }
    }
    return { inflow, inflowCost, inflowProfit, outflow, reinvestment, 
             overhead, loanPayment, loanReceived, logistics, refund, onHoldCash };
  }, [filteredRecords, inventoryCostMap]);

  const pricingRecommendations = useMemo(() => {
    const candidates = filteredRecords.filter(r =>
      r.category === "Inflow" &&
      r.cost_per_unit != null &&
      r.market_price != null &&
      parseFloat(r.amount) > 0
    );
    const recommendations = candidates
      .map(r => {
        const sellingPrice = parseFloat(r.amount);
        const marketPrice = parseFloat(r.market_price);
        const cost = parseFloat(r.cost_per_unit);
        const qty = parseFloat(r.quantity) || 1;
        const currentMargin = sellingPrice > 0 ? ((sellingPrice - cost) / sellingPrice) * 100 : 0;
        const underpriced = sellingPrice < marketPrice && currentMargin < 50;
        if (!underpriced) return null;
        const potentialIncrease = (marketPrice - sellingPrice) * qty;
        const newMargin = marketPrice > 0 ? ((marketPrice - cost) / marketPrice) * 100 : 0;
        return {
          product: r.description,
          currentPrice: sellingPrice,
          recommendedPrice: marketPrice,
          currentMargin,
          newMargin,
          percentIncrease: ((marketPrice - sellingPrice) / sellingPrice) * 100,
          potentialRevenue: potentialIncrease,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.potentialRevenue - a.potentialRevenue);
    return recommendations;
  }, [filteredRecords]);

  const totalRecurring = useMemo(() => 
    recurringCosts.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0),
    [recurringCosts]
  );

  const overheadWithRecurring = totals.overhead + totalRecurring;
  const grossProfit = totals.inflow - totals.outflow;
  const trueGrossMargin = totals.inflow > 0 ? (totals.inflowProfit / totals.inflow) * 100 : 0;
  const operatingProfit = grossProfit - overheadWithRecurring - totals.reinvestment;
  const netLoanImpact = totals.loanReceived - totals.loanPayment;
  const netProfit = operatingProfit + netLoanImpact;

  const { rollingInflow, loanCoveragePercent, loanStatus } = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const inflow = records
      .filter(r => 
        r.category === "Inflow" && 
        new Date(r.date) >= thirtyDaysAgo && 
        new Date(r.date) <= today
      )
      .reduce((sum, r) => sum + parseFloat(r.amount) * (parseFloat(r.quantity) || 1), 0);
    const hasRecentInflow = records.some(
      r => r.category === "Inflow" && new Date(r.date) >= thirtyDaysAgo
    );
    const percent = hasRecentInflow && monthlyLoanTarget > 0 
      ? (inflow / monthlyLoanTarget) * 100 
      : 0;
    return {
      rollingInflow: inflow,
      loanCoveragePercent: percent,
      loanStatus: percent >= 100 ? "On Track" : "At Risk"
    };
  }, [records, monthlyLoanTarget]);

  const customerRevenueMap = useMemo(() => {
    const map = new Map();
    for (const r of filteredRecords) {
      if (r.category === "Inflow" && r.customer) {
        const rev = (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1);
        map.set(r.customer, (map.get(r.customer) || 0) + rev);
      }
    }
    return map;
  }, [filteredRecords]);

  const topCustomerShare = useMemo(() => {
    const totalRevenue = Array.from(customerRevenueMap.values()).reduce((a, b) => a + b, 0);
    if (totalRevenue === 0) return 0;
    return Math.max(...customerRevenueMap.values()) / totalRevenue;
  }, [customerRevenueMap]);

  const recordsWithStrategicScore = useMemo(() => {
    const scoredRecords = filteredRecords.map(r => {
      const baseWeight = STRATEGIC_WEIGHTS[r.category] || 0;
      let marginImpact = 0, loanImpact = 0, recencyBonus = 0, 
          customerPenalty = 0, cashFlowImpact = 0;
      const daysOld = Math.floor((new Date() - new Date(r.date)) / (1000 * 60 * 60 * 24));
      recencyBonus = Math.max(0, 5 - daysOld / 30);
      if (r.category === "Cash Flow Gap") {
        recencyBonus = -2;
        customerPenalty = -3;
      } else if (r.category === "Refund") {
        customerPenalty = -4;
        recencyBonus = -3;
      } else if (r.category === "Logistics") {
        const avgLogistics = totals.logistics / Math.max(
          filteredRecords.filter(rec => rec.category === "Logistics").length,
          1
        );
        const actualCost = parseFloat(r.amount) || 0;
        marginImpact = actualCost < avgLogistics ? 1 : -1;
      } else if (r.category === "Inflow") {
        const qty = parseFloat(r.quantity) || 1;
        const price = parseFloat(r.amount) || 0;
        let cost = parseFloat(r.cost_per_unit) || 0;
        if (!cost && r.description && inventoryCostMap[r.description]) {
          cost = inventoryCostMap[r.description];
        }
        const profit = (price - cost) * qty;
        marginImpact = profit > 0 ? profit / 1000 : 0;
        if (daysOld <= 30) {
          loanImpact = (price * qty) / 10000;
          cashFlowImpact = 2;
        }
        if (r.customer && topCustomerShare > 0.5) {
          customerPenalty = -2;
        }
      } else if (r.category === "On Hold Cash") {
        recencyBonus = -3;
        customerPenalty = -2;
      }
      return { 
        ...r, 
        strategicScore: baseWeight + marginImpact + loanImpact + 
                       recencyBonus + customerPenalty + cashFlowImpact 
      };
    });
    return scoredRecords.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return b.strategicScore - a.strategicScore;
    });
  }, [filteredRecords, inventoryCostMap, topCustomerShare, totals.logistics]);

  const { 
    monthlyBurn, 
    cashRunwayMonths, 
    liquidityRatio, 
    recurringRatio, 
    onHoldRatio, 
    businessHealthIndex 
  } = useMemo(() => {
    const burn = overheadWithRecurring + totals.outflow + totals.reinvestment;
    const runway = totals.inflow > 0 ? (totals.inflow - totals.onHoldCash) / burn : 0;
    const liquidity = totals.inflow > 0 ? (totals.inflow - totals.onHoldCash) / burn : 0;
    const recurring = totals.inflow > 0 ? (totalRecurring / totals.inflow) * 100 : 0;
    const onHold = totals.inflow > 0 ? (totals.onHoldCash / totals.inflow) * 100 : 0;
    const maturityData = [
      { stage: "Record Keeping", score: records.length > 0 ? 40 : 0 },
      {
        stage: "Cost Tracking",
        score: (
          (filteredRecords.filter(r => r.category === "Inflow" && r.cost_per_unit).length /
            Math.max(filteredRecords.filter(r => r.category === "Inflow").length, 1)) * 100
        ).toFixed(0),
      },
      {
        stage: "Customer Tracking",
        score: (
          (filteredRecords.filter(r => r.customer).length / Math.max(filteredRecords.length, 1)) * 100
        ).toFixed(0),
      },
      { stage: "Budgeting", score: Object.keys(budgets).length > 0 ? 80 : 20 },
    ];
    const dataCompletenessScore = (
      (maturityData.reduce((sum, m) => sum + parseFloat(m.score), 0) / 400) * 100
    ).toFixed(0);
    const healthIndex = Math.min(
      100,
      Math.round(
        (trueGrossMargin / 50) * 25 +
        (loanCoveragePercent / 100) * 25 +
        (liquidity > 1 ? 25 : liquidity * 25) +
        parseFloat(dataCompletenessScore) * 0.25 +
        (recurring < 30 ? 12.5 : 0) +
        (onHold < 20 ? 12.5 : 0)
      )
    );
    return { 
      monthlyBurn: burn, 
      cashRunwayMonths: runway, 
      liquidityRatio: liquidity, 
      recurringRatio: recurring, 
      onHoldRatio: onHold, 
      businessHealthIndex: healthIndex 
    };
  }, [totals, overheadWithRecurring, totalRecurring, records.length, 
      filteredRecords, budgets, trueGrossMargin, loanCoveragePercent]);

  const onHoldAlert = useMemo(() => 
    onHoldRatio > 20 && totals.inflow > 0 ? { percent: onHoldRatio.toFixed(1) } : null,
    [onHoldRatio, totals.inflow]
  );

  const recurringAlert = useMemo(() => 
    recurringRatio > 30 && totals.inflow > 0 ? { percent: recurringRatio.toFixed(1) } : null,
    [recurringRatio, totals.inflow]
  );

  const budgetAlerts = useMemo(() => {
    const alerts = [];
    for (const [category, budgetAmount] of Object.entries(budgets)) {
      const spent = filteredRecords
        .filter(r => r.category === category)
        .reduce((sum, r) => {
          if (r.category === "Inflow") {
            return sum + (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1);
          }
          return sum + (parseFloat(r.amount) || 0);
        }, 0);
      const percentUsed = (spent / budgetAmount) * 100;
      if (percentUsed >= 90) {
        alerts.push({
          category,
          spent,
          budget: budgetAmount,
          percentUsed,
          severity: percentUsed >= 100 ? "critical" : "warning",
        });
      }
    }
    return alerts;
  }, [filteredRecords, budgets]);

  // --- NEW: Missing Analysis Hooks ---
  const customerAnalysis = useMemo(() => {
    const map = new Map();
    for (const r of filteredRecords) {
      if (r.category !== "Inflow" || !r.customer) continue;
      const qty = parseFloat(r.quantity) || 1;
      const price = parseFloat(r.amount) || 0;
      let cost = parseFloat(r.cost_per_unit) || 0;
      if (!cost && r.description && inventoryCostMap[r.description]) {
        cost = inventoryCostMap[r.description];
      }
      const revenue = price * qty;
      const totalCost = cost * qty;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const key = r.customer;
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          revenue: 0,
          cost: 0,
          profit: 0,
          transactions: 0,
          avgTransaction: 0,
          clv: null,
          margin: 0
        });
      }
      const entry = map.get(key);
      entry.revenue += revenue;
      entry.cost += totalCost;
      entry.profit += profit;
      entry.transactions += 1;
    }
    return Array.from(map.values()).map(c => ({
      ...c,
      avgTransaction: c.revenue / c.transactions,
      margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);
  }, [filteredRecords, inventoryCostMap]);

  const hasSufficientHistory = useMemo(() => {
    if (records.length === 0) return false;
    const dates = records.map(r => new Date(r.date));
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const diffDays = (max - min) / (1000 * 60 * 60 * 24);
    return diffDays >= 90;
  }, [records]);

  const supplierAnalysis = useMemo(() => {
    const map = new Map();
    for (const r of filteredRecords) {
      if (!r.supplied_by || r.category !== "Inventory Purchase") continue;
      const cost = (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1);
      const key = r.supplied_by;
      if (!map.has(key)) {
        map.set(key, { name: key, cost: 0, transactions: 0 });
      }
      const entry = map.get(key);
      entry.cost += cost;
      entry.transactions += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [filteredRecords]);

  const productMargins = useMemo(() => {
    const map = new Map();
    for (const r of filteredRecords) {
      if (r.category !== "Inflow" || !r.description) continue;
      const qty = parseFloat(r.quantity) || 1;
      const price = parseFloat(r.amount) || 0;
      let cost = parseFloat(r.cost_per_unit) || 0;
      if (!cost && r.description && inventoryCostMap[r.description]) {
        cost = inventoryCostMap[r.description];
      }
      const key = r.description;
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          quantity: 0,
          totalRevenue: 0,
          totalCost: 0,
          customers: new Set(),
          inventoryTurnover: 0
        });
      }
      const entry = map.get(key);
      entry.quantity += qty;
      entry.totalRevenue += price * qty;
      entry.totalCost += cost * qty;
      if (r.customer) entry.customers.add(r.customer);
    }
    return Array.from(map.values()).map(p => {
      const avgPrice = p.totalRevenue / p.quantity;
      const avgCost = p.totalCost / p.quantity;
      const avgProfit = avgPrice - avgCost;
      const profit = p.totalRevenue - p.totalCost;
      const margin = p.totalRevenue > 0 ? (profit / p.totalRevenue) * 100 : 0;
      return {
        name: p.name,
        quantity: p.quantity,
        avgPrice,
        avgCost,
        avgProfit,
        profit,
        margin,
        customers: p.customers.size,
        inventoryTurnover: p.quantity / (p.totalCost > 0 ? p.totalCost : 1)
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [filteredRecords, inventoryCostMap]);

  const competitiveAnalysis = useMemo(() => {
    return filteredRecords
      .filter(r => r.category === "Inflow" && r.market_price != null)
      .map(r => {
        const sellingPrice = parseFloat(r.amount);
        const marketPrice = parseFloat(r.market_price);
        const cost = parseFloat(r.cost_per_unit) || 0;
        const qty = parseFloat(r.quantity) || 1;
        const revenue = sellingPrice * qty;
        const totalCost = cost * qty;
        const profit = revenue - totalCost;
        const grossMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const competitiveEdge = (marketPrice - sellingPrice) * qty;
        return {
          id: r.id,
          name: r.description,
          sellingPrice,
          marketPrice,
          grossMargin,
          competitiveEdge,
          underpriced: sellingPrice < marketPrice,
          overpriced: sellingPrice > marketPrice * 1.1
        };
      });
  }, [filteredRecords]);

  const competitiveTotals = useMemo(() => {
    const totalCompetitiveEdge = competitiveAnalysis.reduce((sum, a) => sum + a.competitiveEdge, 0);
    const avgMargin = competitiveAnalysis.reduce((sum, a) => sum + a.grossMargin, 0);
    return {
      totalCompetitiveEdge,
      avgMargin,
      count: competitiveAnalysis.length
    };
  }, [competitiveAnalysis]);

  const cashFlowGaps = useMemo(() => {
    return filteredRecords
      .filter(r => r.category === "Inflow" && r.payment_date)
      .map(r => {
        const invoiceDate = new Date(r.date);
        const paymentDate = new Date(r.payment_date);
        const gapDays = (paymentDate - invoiceDate) / (1000 * 60 * 60 * 24);
        return {
          id: r.id,
          customer: r.customer,
          description: r.description,
          amount: parseFloat(r.amount) * (parseFloat(r.quantity) || 1),
          gapDays,
          status: gapDays > 30 ? "Delayed" : "On Time"
        };
      });
  }, [filteredRecords]);

  const dailyData = useMemo(() => {
    const map = new Map();
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    for (const r of filteredRecords) {
      if (r.category !== "Inflow") continue;
      const recordDate = new Date(r.date);
      if (recordDate < thirtyDaysAgo || recordDate > now) continue;
      const dateStr = recordDate.toISOString().split('T')[0];
      const qty = parseFloat(r.quantity) || 1;
      const price = parseFloat(r.amount) || 0;
      let cost = parseFloat(r.cost_per_unit) || 0;
      if (!cost && r.description && inventoryCostMap[r.description]) {
        cost = inventoryCostMap[r.description];
      }
      const revenue = price * qty;
      const totalCost = cost * qty;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      if (!map.has(dateStr)) {
        map.set(dateStr, { date: dateStr, revenue: 0, profit: 0, margin: 0, count: 0 });
      }
      const entry = map.get(dateStr);
      entry.revenue += revenue;
      entry.profit += profit;
      entry.margin += margin;
      entry.count += 1;
    }
    return Array.from(map.values()).map(d => ({
      ...d,
      margin: d.count > 0 ? d.margin / d.count : 0
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords, inventoryCostMap]);

  const monthlyData = useMemo(() => {
    const map = new Map();
    for (const r of filteredRecords) {
      if (r.category !== "Inflow") continue;
      const recordDate = new Date(r.date);
      const monthStr = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
      const qty = parseFloat(r.quantity) || 1;
      const price = parseFloat(r.amount) || 0;
      let cost = parseFloat(r.cost_per_unit) || 0;
      if (!cost && r.description && inventoryCostMap[r.description]) {
        cost = inventoryCostMap[r.description];
      }
      const revenue = price * qty;
      const totalCost = cost * qty;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      if (!map.has(monthStr)) {
        map.set(monthStr, { month: monthStr, revenue: 0, profit: 0, margin: 0, count: 0 });
      }
      const entry = map.get(monthStr);
      entry.revenue += revenue;
      entry.profit += profit;
      entry.margin += margin;
      entry.count += 1;
    }
    return Array.from(map.values()).map(d => ({
      ...d,
      margin: d.count > 0 ? d.margin / d.count : 0
    })).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredRecords, inventoryCostMap]);

  const projectedCash = useMemo(() => {
    const now = new Date();
    const data = [];
    let netCash = totals.inflow - totals.outflow - overheadWithRecurring - totals.reinvestment;
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      data.push({
        date: date.toISOString().split('T')[0],
        net: netCash
      });
      netCash -= monthlyBurn / 30;
    }
    return data;
  }, [totals, overheadWithRecurring, monthlyBurn]);

  const businessValueData = useMemo(() => [
    { metric: "Margin Health", current: trueGrossMargin, target: 50 },
    { metric: "Loan Coverage", current: loanCoveragePercent, target: 100 },
    { metric: "Liquidity", current: liquidityRatio * 100, target: 100 },
    { metric: "Data Quality", current: parseFloat((
      (filteredRecords.filter(r => r.category === "Inflow" && r.cost_per_unit).length /
        Math.max(filteredRecords.filter(r => r.category === "Inflow").length, 1)) * 100
    ).toFixed(0)), target: 90 },
    { metric: "Customer Divers.", current: (1 - topCustomerShare) * 100, target: 80 }
  ], [trueGrossMargin, loanCoveragePercent, liquidityRatio, filteredRecords, topCustomerShare]);

  const roiTimeline = useMemo(() => [
    { month: "M0", investment: 100, return: 0, net: -100 },
    { month: "M1", investment: 0, return: 30, net: -70 },
    { month: "M2", investment: 0, return: 50, net: -20 },
    { month: "M3", investment: 0, return: 80, net: 60 },
    { month: "M4", investment: 0, return: 100, net: 160 },
    { month: "M5", investment: 0, return: 120, net: 280 }
  ], []);

  const breakEvenMonth = "M3";
  const roiPercentage = "180%";
  const paybackMonth = "M3";

  const maturityData = useMemo(() => [
    { stage: "Record Keeping", score: records.length > 0 ? 40 : 0 },
    {
      stage: "Cost Tracking",
      score: (
        (filteredRecords.filter(r => r.category === "Inflow" && r.cost_per_unit).length /
          Math.max(filteredRecords.filter(r => r.category === "Inflow").length, 1)) * 100
      ).toFixed(0),
    },
    {
      stage: "Customer Tracking",
      score: (
        (filteredRecords.filter(r => r.customer).length / Math.max(filteredRecords.length, 1)) * 100
      ).toFixed(0),
    },
    { stage: "Budgeting", score: Object.keys(budgets).length > 0 ? 80 : 20 },
  ], [records.length, filteredRecords, budgets]);

  const implementationPhases = [
    {
      phase: "Data Foundation",
      duration: "2-4 weeks",
      value: "Accurate Profitability",
      icon: Database,
      color: "bg-green-500",
      tasks: [
        "Add cost tracking to all sales",
        "Tag every transaction with customer & supplier",
        "Set up recurring costs and budgets"
      ]
    },
    {
      phase: "Margin Optimization",
      duration: "4-6 weeks",
      value: "+15-30% Gross Margin",
      icon: Percent,
      color: "bg-blue-500",
      tasks: [
        "Implement pricing recommendations",
        "Negotiate with top suppliers",
        "Eliminate unprofitable products"
      ]
    },
    {
      phase: "Cash Flow Control",
      duration: "6-8 weeks",
      value: "3+ Month Runway",
      icon: DollarSign,
      color: "bg-purple-500",
      tasks: [
        "Reduce on-hold cash by 50%",
        "Automate collections",
        "Refinance high-cost debt"
      ]
    }
  ];

  // --- Grouped Records for Records Tab ---
  const groupedRecords = useMemo(() => {
    if (groupBy === "none") return [];
    const map = new Map();
    for (const r of recordsWithStrategicScore) {
      let key = "";
      if (groupBy === "customer") key = r.customer || "Uncategorized";
      else if (groupBy === "product") key = r.description || "Uncategorized";
      else if (groupBy === "supplier") key = r.supplied_by || "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [recordsWithStrategicScore, groupBy]);

  // --- Form Handlers ---
  const handleSubmit = useCallback(async () => {
    if (!formData.description || !formData.amount) return;
    if (!formData.date) {
      alert("Please select a date");
      return;
    }
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Amount must be a positive number.");
      return;
    }
    try {
      const recordData = {
        date: formData.date,
        payment_date: formData.paymentDate || formData.date,
        description: formData.description,
        category: formData.category,
        amount: parseFloat(formData.amount),
        cost_per_unit: formData.costPerUnit ? parseFloat(formData.costPerUnit) : null,
        quantity: formData.quantity ? parseFloat(formData.quantity) : 1,
        notes: formData.notes || null,
        customer: formData.customer || null,
        project: formData.project || null,
        tags: formData.tags || null,
        market_price: formData.marketPrice ? parseFloat(formData.marketPrice) : null,
        supplied_by: formData.suppliedBy || null,
        approved: true,
      };
      if (isEditing !== null) {
        const { error } = await supabase
          .from("bookkeeping_records")
          .update(recordData)
          .eq("id", isEditing);
        if (error) throw error;
        setRecords(records.map(r => r.id === isEditing ? { ...recordData, id: r.id } : r));
        setIsEditing(null);
      } else {
        const { data, error } = await supabase
          .from("bookkeeping_records")
          .insert([recordData])
          .select();
        if (error) throw error;
        setRecords([data[0], ...records]);
      }
      resetForm();
    } catch (error) {
      console.error("Error saving record:", error);
      alert("Failed to save record.");
    }
  }, [formData, isEditing, records]);

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      paymentDate: "",
      description: "",
      category: "Inflow",
      amount: "",
      costPerUnit: "",
      quantity: "",
      notes: "",
      customer: "",
      project: "",
      tags: "",
      marketPrice: "",
      suppliedBy: "",
    });
  };

  const handleEdit = (index) => {
    const record = recordsWithStrategicScore[index];
    setFormData({
      date: record.date,
      paymentDate: record.payment_date || "",
      description: record.description,
      category: record.category,
      amount: record.amount.toString(),
      costPerUnit: record.cost_per_unit ? record.cost_per_unit.toString() : "",
      quantity: record.quantity ? record.quantity.toString() : "",
      notes: record.notes || "",
      customer: record.customer || "",
      project: record.project || "",
      tags: record.tags || "",
      marketPrice: record.market_price ? record.market_price.toString() : "",
      suppliedBy: record.supplied_by || "",
    });
    setIsEditing(record.id);
    setActiveTab("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    setIsEditing(null);
    resetForm();
  };

  const handleDelete = async (index) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      const recordToDelete = recordsWithStrategicScore[index];
      const { error } = await supabase
        .from("bookkeeping_records")
        .delete()
        .eq("id", recordToDelete.id);
      if (error) throw error;
      setRecords(records.filter(r => r.id !== recordToDelete.id));
    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Failed to delete record. Please try again.");
    }
  };

  const handleCsvImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data } = results;
        if (!Array.isArray(data) || data.length === 0) {
          alert("No valid records found in CSV.");
          return;
        }
        const normalizeHeader = (str) =>
          str?.trim().toLowerCase().replace(/\s+/g, "");
        const mappedRecords = data
          .map((row) => {
            const parseNumber = (val) =>
              val === "" || val == null ? null : parseFloat(val);
            const parseString = (val) =>
              val === "" || val == null ? null : String(val).trim();
            const headers = {};
            Object.keys(row).forEach((key) => {
              headers[normalizeHeader(key)] = row[key];
            });
            const categoryKey =
              Object.entries(categoryLabels).find(
                ([, label]) => normalizeHeader(label) === normalizeHeader(headers["category"])
              )?.[0] ||
              (internalCategories.includes(row["Category"])
                ? row["Category"]
                : "Inflow");
            return {
              date:
                parseString(headers["date"]) ||
                new Date().toISOString().split("T")[0],
              payment_date:
                parseString(headers["paymentdate"]) || parseString(headers["date"]),
              description: parseString(headers["description"]),
              category: internalCategories.includes(categoryKey)
                ? categoryKey
                : "Inflow",
              amount: parseNumber(headers["unitprice(lkr)"]),
              cost_per_unit: parseNumber(headers["costperunit(lkr)"]),
              quantity: parseNumber(headers["quantity"]) || 1,
              notes: parseString(headers["notes"]),
              customer: parseString(headers["customer"]),
              project: parseString(headers["project"]),
              tags: parseString(headers["tags"]),
              market_price:
                parseNumber(headers["market/competitorprice(lkr)"]) ||
                parseNumber(headers["marketprice"]),
              supplied_by: parseString(headers["suppliedby"]),
            };
          })
          .filter((r) => r.description && r.amount != null);
        if (mappedRecords.length === 0) {
          alert("No valid records to import.");
          return;
        }
        try {
          const { error } = await supabase
            .from("bookkeeping_records")
            .insert(mappedRecords);
          if (error) throw error;
          await loadRecords();
          alert(`Successfully imported ${mappedRecords.length} records.`);
          if (csvInputRef.current) csvInputRef.current.value = "";
        } catch (err) {
          console.error("Import error:", err);
          alert("Failed to import CSV. Check format and try again.");
        }
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        alert("Failed to parse CSV file.");
      },
    });
  };

  const exportToCSV = () => {
    const dataToExport = filteredRecords.length > 0 ? filteredRecords : records;
    if (dataToExport.length === 0) {
      alert("No records to export");
      return;
    }
    const headers = [
      "Date",
      "Description",
      "Category",
      "Unit Price (LKR)",
      "Cost per Unit (LKR)",
      "Quantity",
      "Total",
      "Total Cost",
      "Profit",
      "Margin %",
      "Customer",
      "Project",
      "Supplied By",
      "Tags",
      "Notes",
      "Strategic Score",
    ];
    const csvData = dataToExport.map((r) => {
      const qty = r.quantity || 1;
      const price = r.amount;
      const cost = r.cost_per_unit || 0;
      const revenue = price * qty;
      const totalCost = cost * qty;
      const profit = revenue - totalCost;
      const margin = price > 0 ? ((price - cost) / price) * 100 : null;
      return [
        r.date,
        `"${r.description}"`,
        categoryLabels[r.category] || r.category,
        price,
        cost,
        qty,
        revenue.toFixed(2),
        totalCost.toFixed(2),
        profit.toFixed(2),
        margin,
        `"${r.customer || ""}"`,
        `"${r.project || ""}"`,
        `"${r.supplied_by || ""}"`,
        `"${r.tags || ""}"`,
        `"${r.notes || ""}"`,
        r.strategicScore?.toFixed(1) || "0",
      ];
    });
    const dateRange =
      dateFilter.start || dateFilter.end
        ? `_${dateFilter.start || "start"}_to_${dateFilter.end || "end"}`
        : "";
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.join(",")),
    ].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `profit_analysis${dateRange}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const clearDateFilter = () => setDateFilter({ start: "", end: "" });
  const setQuickFilter = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateFilter({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });
  };

  // --- Recurring Cost Handlers ---
  const resetRecurringForm = () => {
    setRecurringForm({ description: "", amount: "", notes: "" });
    setIsEditingRecurring(null);
  };

  const saveRecurringCost = async () => {
    const { description, amount, notes } = recurringForm;
    if (!description || !amount) {
      alert("Please fill in description and amount");
      return;
    }
    try {
      if (isEditingRecurring !== null) {
        const { error } = await supabase
          .from("recurring_costs")
          .update({ description, amount: parseFloat(amount), notes })
          .eq("id", isEditingRecurring);
        if (error) throw error;
        setRecurringCosts(
          recurringCosts.map((r) =>
            r.id === isEditingRecurring
              ? { ...r, description, amount: parseFloat(amount), notes }
              : r
          )
        );
      } else {
        const { data, error } = await supabase
          .from("recurring_costs")
          .insert([{ description, amount: parseFloat(amount), notes }])
          .select();
        if (error) throw error;
        setRecurringCosts([data[0], ...recurringCosts]);
      }
      setShowRecurringModal(false);
      resetRecurringForm();
      alert("Recurring cost saved!");
    } catch (error) {
      console.error("Error saving recurring cost:", error);
      alert("Failed to save recurring cost.");
    }
  };

  const handleEditRecurring = (cost) => {
    setRecurringForm({
      description: cost.description,
      amount: cost.amount.toString(),
      notes: cost.notes || "",
    });
    setIsEditingRecurring(cost.id);
    setShowRecurringModal(true);
  };

  const handleDeleteRecurring = async (id) => {
    if (!window.confirm("Delete this recurring cost?")) return;
    try {
      const { error } = await supabase
        .from("recurring_costs")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setRecurringCosts(recurringCosts.filter((r) => r.id !== id));
      alert("Recurring cost deleted.");
    } catch (error) {
      console.error("Error deleting recurring cost:", error);
      alert("Failed to delete.");
    }
  };

  const generateRecurringRecords = async () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastGen = localStorage.getItem("lastRecurringGen");
    if (lastGen === monthKey) return;
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayStr = firstDay.toISOString().split("T")[0];
    const autoGenNote = "Auto-generated from recurring cost";
    for (const cost of recurringCosts) {
      const exists = records.some(
        (r) =>
          r.description === cost.description &&
          r.category === "Overhead" &&
          r.date.startsWith(monthKey) &&
          r.notes?.includes(autoGenNote)
      );
      if (!exists) {
        const recordData = {
          date: firstDayStr,
          payment_date: firstDayStr,
          description: cost.description,
          category: "Overhead",
          amount: cost.amount,
          notes: cost.notes || autoGenNote,
          approved: true,
        };
        const { data, error } = await supabase
          .from("bookkeeping_records")
          .insert([recordData])
          .select();
        if (!error) {
          setRecords((prev) => [data[0], ...prev]);
        }
      }
    }
    localStorage.setItem("lastRecurringGen", monthKey);
  };

  const saveBudget = async () => {
    if (!budgetAmount) {
      alert("Please enter a budget amount");
      return;
    }
    try {
      const { error } = await supabase.from("category_budgets").upsert({
        category: budgetCategory,
        amount: parseFloat(budgetAmount),
      });
      if (error) {
        throw error;
      }
      await loadBudgets();
      setShowBudgetModal(false);
      setBudgetAmount("");
      alert(
        `Budget for ${
          categoryLabels[budgetCategory] || budgetCategory
        } saved successfully!`
      );
    } catch (error) {
      console.error("Error saving budget:", error);
      alert("Failed to save budget. Please try again.");
    }
  };

  const saveLoanTarget = () => {
    if (monthlyLoanTarget <= 0) {
      alert("Please enter a valid monthly loan target");
      return;
    }
    localStorage.setItem("monthlyLoanTarget", monthlyLoanTarget.toString());
    setShowLoanModal(false);
    alert("Monthly loan target updated!");
  };

  useEffect(() => {
    const savedLoanTarget = localStorage.getItem("monthlyLoanTarget");
    if (savedLoanTarget) setMonthlyLoanTarget(parseFloat(savedLoanTarget));
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setDateFilter({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });
    syncRecords();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading your financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2">
                <Brain className="w-6 h-6 sm:w-8 sm:h-8" />
                SME Profit Intelligence Platform
              </h1>
              <p className="text-blue-100 text-sm sm:text-base">
                Payments → Cash Flow → Financial Controls → Reinvestment
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  <Percent className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>True Margin: {trueGrossMargin.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Loan Coverage: {loanCoveragePercent.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>On Hold: {onHoldRatio.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Database className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{records.length} transactions</span>
                </div>
                <div className="flex items-center gap-1">
                  <HeartPulse className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Health: {businessHealthIndex}/100</span>
                </div>
                <button
                  onClick={syncRecords}
                  disabled={syncing}
                  className="flex items-center gap-1 text-xs sm:text-sm bg-blue-500 px-2 py-1 rounded hover:bg-blue-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Syncing..." : "Sync"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-2">
              <button
                onClick={() => setShowTargetModal(true)}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-blue-500 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-md hover:bg-blue-400 transition-colors font-semibold shadow-md"
              >
                <Target className="w-3 h-3 sm:w-4 sm:h-4" />
                Target
              </button>
              <button
                onClick={() => setShowLoanModal(true)}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-indigo-500 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-md hover:bg-indigo-400 transition-colors font-semibold shadow-md"
              >
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4" />
                Loan Plan
              </button>
              <button
                onClick={() => setShowBudgetModal(true)}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-blue-500 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-md hover:bg-blue-400 transition-colors font-semibold shadow-md"
              >
                <Bell className="w-3 h-3 sm:w-4 sm:h-4" />
                Budgets
              </button>
              <button
                onClick={() => setShowRecurringModal(true)}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-purple-500 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-md hover:bg-purple-400 transition-colors font-semibold shadow-md"
              >
                <Repeat className="w-3 h-3 sm:w-4 sm:h-4" />
                Recurring
              </button>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvImport}
                ref={csvInputRef}
                className="hidden"
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-white text-blue-700 px-2 sm:px-4 py-1 sm:py-2 rounded-md hover:bg-blue-50 transition-colors font-semibold shadow-md"
              >
                <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4" />
                Import
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-white text-blue-700 px-2 sm:px-4 py-1 sm:py-2 rounded-md hover:bg-blue-50 transition-colors font-semibold shadow-md"
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Loan Health Alert */}
        <div className="mb-4 sm:mb-6">
          <div
            className={`p-3 sm:p-4 rounded-lg flex items-center gap-2 sm:gap-3 ${
              loanStatus === "On Track"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <DollarSign
              className={`w-5 h-5 ${
                loanStatus === "On Track" ? "text-green-600" : "text-red-600"
              }`}
            />
            <div>
              <h3 className="font-semibold text-sm sm:text-base">
                {loanStatus === "On Track"
                  ? "✅ Loan Coverage On Track"
                  : "⚠️ Loan Coverage At Risk"}
              </h3>
              <p className="text-xs sm:text-sm">
                Rolling 30-day inflow: LKR {formatLKR(rollingInflow)} / LKR{" "}
                {formatLKR(monthlyLoanTarget)} ({loanCoveragePercent.toFixed(1)}
                %)
              </p>
            </div>
          </div>
        </div>

        {/* Strategic Alerts */}
        <div className="grid grid-cols-1 gap-4 mb-4 sm:mb-6">
          {budgetAlerts.length > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 rounded-r-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 text-sm sm:text-base mb-1 sm:mb-2">
                    Budget Alerts
                  </h3>
                  <div className="space-y-1 sm:space-y-2">
                    {budgetAlerts.slice(0, 2).map((alert, idx) => (
                      <div key={idx} className="text-xs sm:text-sm text-yellow-800">
                        <strong>
                          {categoryLabels[alert.category] || alert.category}:
                        </strong>{" "}
                        {alert.percentUsed.toFixed(0)}% used
                        {alert.severity === "critical" && " - OVER BUDGET!"}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {pricingRecommendations.length > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-400 p-3 sm:p-4 rounded-r-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 text-sm sm:text-base mb-1 sm:mb-2">
                    Pricing Opportunities
                  </h3>
                  <div className="space-y-1 sm:space-y-2">
                    {pricingRecommendations.slice(0, 2).map((rec, idx) => (
                      <div key={idx} className="text-xs sm:text-sm text-orange-800">
                        <strong>{rec.product}:</strong> +
                        {rec.percentIncrease.toFixed(0)}% price = +LKR{" "}
                        {formatLKR(rec.potentialRevenue)} revenue
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {recurringAlert && (
            <div className="bg-purple-50 border-l-4 border-purple-400 p-3 sm:p-4 rounded-r-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <Repeat className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-purple-900 text-sm sm:text-base mb-1 sm:mb-2">
                    Recurring Cost Alert
                  </h3>
                  <p className="text-xs sm:text-sm text-purple-800">
                    Recurring costs are {recurringAlert.percent}% of revenue.
                    Consider optimization if above 30%.
                  </p>
                </div>
              </div>
            </div>
          )}
          {onHoldAlert && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-3 sm:p-4 rounded-r-lg">
              <div className="flex items-start gap-2 sm:gap-3">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 text-sm sm:text-base mb-1 sm:mb-2">
                    On Hold Cash Alert
                  </h3>
                  <p className="text-xs sm:text-sm text-amber-800">
                    {onHoldAlert.percent}% of revenue is committed but not spent.
                    Review pending commitments if above 20%.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-4 sm:mb-6 overflow-hidden">
          <div className="flex overflow-x-auto">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "health", label: "Business Health", icon: HeartPulse },
              { id: "margins", label: "Profit Margins", icon: Percent },
              { id: "competitive", label: "Competitive Edge", icon: Target },
              { id: "products", label: "Products", icon: Package },
              { id: "customers", label: "Customers", icon: Users },
              { id: "suppliers", label: "Suppliers", icon: Factory },
              { id: "pricing", label: "Pricing Intel", icon: Sparkles },
              { id: "recurring", label: "Recurring Costs", icon: Repeat },
              {
                id: "analytics",
                label: "Strategic Analytics",
                icon: TrendingUp,
              },
              { id: "records", label: "All Records", icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filter */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, start: e.target.value })
              }
              className="px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-600 text-xs sm:text-sm">to</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, end: e.target.value })
              }
              className="px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={clearDateFilter}
              className="px-3 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
            <div className="flex gap-1 sm:gap-2 ml-auto">
              <button
                onClick={() => setQuickFilter(30)}
                className="px-2 py-1 text-xs sm:px-3 sm:py-2 sm:text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                30D
              </button>
              <button
                onClick={() => setQuickFilter(90)}
                className="px-2 py-1 text-xs sm:px-3 sm:py-2 sm:text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                90D
              </button>
              <button
                onClick={() => setQuickFilter(180)}
                className="px-2 py-1 text-xs sm:px-3 sm:py-2 sm:text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                6M
              </button>
              <button
                onClick={() => setQuickFilter(365)}
                className="px-2 py-1 text-xs sm:px-3 sm:py-2 sm:text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                1Y
              </button>
            </div>
          </div>
        </div>

        {/* All Tabs Rendered Below - No Changes Needed */}
        {activeTab === "recurring" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2">
                <Repeat className="w-6 h-6 sm:w-7 sm:h-7" />
                Recurring Monthly Costs
              </h2>
              <p className="text-purple-100 text-sm sm:text-base">
                Manage fixed monthly expenses like rent, software, and salaries
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h3 className="text-lg font-semibold mb-2 sm:mb-0">Your Recurring Costs</h3>
                <button
                  onClick={() => {
                    resetRecurringForm();
                    setShowRecurringModal(true);
                  }}
                  className="bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-md flex items-center gap-1 sm:gap-2 text-sm hover:bg-purple-700"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" /> Add Cost
                </button>
              </div>
              {recurringCosts.length === 0 ? (
                <div className="text-center py-8 sm:py-12 text-gray-500">
                  <Repeat className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                  <p>No recurring costs added yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                          Description
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Monthly Amount
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                          Notes
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {recurringCosts.map((cost) => (
                        <tr key={cost.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-900 font-medium text-xs sm:text-sm">
                            {cost.description}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-red-600 text-xs sm:text-sm">
                            LKR {formatLKR(cost.amount)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600 text-xs sm:text-sm">
                            {cost.notes || "—"}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                            <button
                              onClick={() => handleEditRecurring(cost)}
                              className="text-blue-600 hover:text-blue-800 mx-0.5 sm:mx-1"
                            >
                              <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecurring(cost.id)}
                              className="text-red-600 hover:text-red-800 mx-0.5 sm:mx-1"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-1 sm:mb-2 text-sm sm:text-base">
                  Summary
                </h4>
                <p className="text-purple-800 text-xs sm:text-sm">
                  Total Recurring Costs:{" "}
                  <span className="font-bold text-purple-600">
                    LKR {formatLKR(totalRecurring)}
                  </span>
                  {totals.inflow > 0 && (
                    <>
                      {" "}({recurringRatio.toFixed(1)}% of revenue)
                    </>
                  )}
                </p>
                <p className="text-xs sm:text-sm text-purple-700 mt-1 sm:mt-2">
                  These costs are automatically added to your "Overhead" each
                  month on the 1st.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "health" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2">
                <HeartPulse className="w-6 h-6 sm:w-7 sm:h-7" />
                Business Health Dashboard
              </h2>
              <p className="text-rose-100 text-sm sm:text-base">
                Monitor your financial stability and operational resilience
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white rounded-lg shadow-md p-3 sm:p-5 text-center">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1">Health Index</h3>
                <p
                  className={`text-lg sm:text-2xl font-bold ${
                    businessHealthIndex >= 80
                      ? "text-green-600"
                      : businessHealthIndex >= 60
                      ? "text-blue-600"
                      : "text-orange-600"
                  }`}
                >
                  {businessHealthIndex}/100
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-3 sm:p-5 text-center">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1">Cash Runway</h3>
                <p className="text-lg sm:text-2xl font-bold text-blue-600">
                  {cashRunwayMonths > 0 ? cashRunwayMonths.toFixed(1) : "∞"}{" "}
                  months
                </p>
                <p className="text-black text-gray-500 mt-1 text-xs sm:text-sm">
                  At current burn rate (excl. on-hold cash)
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-3 sm:p-5 text-center">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1">Burn Rate</h3>
                <p className="text-lg sm:text-2xl font-bold text-red-600">
                  LKR {formatLKR(monthlyBurn)}
                </p>
                <p className="text-black text-gray-500 mt-1 text-xs sm:text-sm">
                  Monthly expenses (incl. recurring)
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-3 sm:p-5 text-center">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1">Liquidity Ratio</h3>
                <p className="text-lg sm:text-2xl font-bold text-green-600">
                  {liquidityRatio > 0 ? liquidityRatio.toFixed(2) : "0"}x
                </p>
                <p className="text-black text-gray-500 mt-1 text-xs sm:text-sm">
                  Available cash vs monthly burn
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-3 sm:p-5 text-center">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1">On Hold Ratio</h3>
                <p className="text-lg sm:text-2xl font-bold text-amber-600">
                  {onHoldRatio > 0 ? onHoldRatio.toFixed(1) : "0"}%
                </p>
                <p className="text-black text-gray-500 mt-1 text-xs sm:text-sm">
                  Committed but not spent
                </p>
              </div>
            </div>
            {/* AI Insights Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-5 border border-blue-200">
              <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3 text-blue-900">
                🧠 AI-Powered Business Summary
              </h3>
              <p className="text-blue-800 text-xs sm:text-sm">
                {businessHealthIndex >= 80
                  ? "Your business is in excellent health! Focus on scaling and reinvestment."
                  : businessHealthIndex >= 60
                  ? "Good foundation—optimize margins and diversify customers."
                  : "⚠️ Action needed: improve cash flow, reduce dependency, and enhance data tracking."}
              </p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-5 border border-blue-200">
              <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3 text-blue-900">
                Strategic Recommendations
              </h3>
              <ul className="space-y-2 text-blue-800 text-xs sm:text-sm">
                {cashRunwayMonths < 3 && (
                  <li className="flex items-start gap-1 sm:gap-2">
                    <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Urgent:</strong> Cash runway under 3 months. Focus
                      on accelerating collections and reducing non-essential
                      spend.
                    </span>
                  </li>
                )}
                {trueGrossMargin < 30 && (
                  <li className="flex items-start gap-1 sm:gap-2">
                    <Percent className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Margin Alert:</strong> Gross margin below 30%.
                      Review pricing and cost structure immediately.
                    </span>
                  </li>
                )}
                {topCustomerShare > 0.5 && (
                  <li className="flex items-start gap-1 sm:gap-2">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Risk:</strong> Over{" "}
                      {Math.round(topCustomerShare * 100)}% revenue from one
                      customer. Diversify your client base.
                    </span>
                  </li>
                )}
                {parseFloat(maturityData[1].score) < 70 && (
                  <li className="flex items-start gap-1 sm:gap-2">
                    <Database className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Improve Data:</strong> Add cost, customer, and
                      supplier details to unlock deeper insights.
                    </span>
                  </li>
                )}
                {recurringRatio > 30 && (
                  <li className="flex items-start gap-1 sm:gap-2">
                    <Repeat className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Recurring Cost Review:</strong> Fixed costs exceed
                      30% of revenue. Negotiate or eliminate non-essential
                      subscriptions.
                    </span>
                  </li>
                )}
                {onHoldRatio > 20 && (
                  <li className="flex items-start gap-1 sm:gap-2">
                    <Lock className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>On Hold Cash Review:</strong> Over 20% of revenue
                      is committed but not spent. Release trapped cash by
                      finalizing or canceling pending commitments.
                    </span>
                  </li>
                )}
                {hasSufficientHistory && customerAnalysis.some(c => c.clv !== null) && (
                  <li className="flex items-start gap-1 sm:gap-2">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>High-CLV customers identified.</strong> Focus retention efforts on top 20%.
                    </span>
                  </li>
                )}
              </ul>
            </div>
            {cashFlowGaps.length > 0 &&
              cashFlowGaps.filter((g) => g.status === "Delayed").length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-3 sm:p-4 rounded-r-lg mb-4 sm:mb-6">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900 mb-1 sm:mb-2 text-sm sm:text-base">
                        Cash Flow Delay Risk
                      </h3>
                      <p className="text-xs sm:text-sm text-red-800">
                        {
                          cashFlowGaps.filter((g) => g.status === "Delayed")
                            .length
                        }{" "}
                        invoices paid late. Avg delay:{" "}
                        {(
                          cashFlowGaps.reduce((sum, g) => sum + g.gapDays, 0) /
                          cashFlowGaps.length
                        ).toFixed(1)}{" "}
                        days.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                Customer Payment Timing Risk
              </h3>
              {cashFlowGaps.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="text-center p-2 sm:p-3 bg-amber-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">
                        Total Invoices Tracked
                      </p>
                      <p className="text-base sm:text-xl font-bold text-amber-700">
                        {cashFlowGaps.length}
                      </p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-red-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">
                        Delayed Payments ({">"}30d)
                      </p>
                      <p className="text-base sm:text-xl font-bold text-red-600">
                        {
                          cashFlowGaps.filter((g) => g.status === "Delayed")
                            .length
                        }
                      </p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">Avg Delay (All)</p>
                      <p className="text-base sm:text-xl font-bold text-blue-600">
                        {(
                          cashFlowGaps.reduce((sum, g) => sum + g.gapDays, 0) /
                          cashFlowGaps.length
                        ).toFixed(1)}{" "}
                        days
                      </p>
                    </div>
                  </div>
                  <h4 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Top Delayed Customers</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 sm:px-3 py-1 sm:py-2 text-left">Customer</th>
                          <th className="px-2 sm:px-3 py-1 sm:py-2 text-left">Description</th>
                          <th className="px-2 sm:px-3 py-1 sm:py-2 text-right">Amount (LKR)</th>
                          <th className="px-2 sm:px-3 py-1 sm:py-2 text-right">Delay (Days)</th>
                          <th className="px-2 sm:px-3 py-1 sm:py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cashFlowGaps
                          .filter((g) => g.status === "Delayed")
                          .sort((a, b) => b.gapDays - a.gapDays)
                          .slice(0, 5)
                          .map((gap) => (
                            <tr key={gap.id} className="hover:bg-gray-50">
                              <td className="px-2 sm:px-3 py-1 sm:py-2 font-medium">
                                {gap.customer || "—"}{" "}
                              </td>
                              <td className="px-2 sm:px-3 py-1 sm:py-2">{gap.description}</td>
                              <td className="px-2 sm:px-3 py-1 sm:py-2 text-right">
                                LKR {formatLKR(gap.amount)}
                              </td>
                              <td className="px-2 sm:px-3 py-1 sm:py-2 text-right font-bold text-red-600">
                                {gap.gapDays}
                              </td>
                              <td className="px-2 sm:px-3 py-1 sm:py-2 text-center">
                                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                  Delayed
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-gray-400" />
                  <p className="text-sm sm:text-base">No payment date data available.</p>
                  <p className="text-xs sm:text-sm mt-1">
                    Add <strong>Payment Date</strong> to your Inflow records to
                    track cash flow timing.
                  </p>
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                Revenue & Profit Trends (Last 30 Days)
              </h3>
              {dailyData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => `LKR ${formatLKR(value)}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Revenue"
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Profit"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">Avg Daily Revenue</p>
                      <p className="text-base sm:text-xl font-bold text-green-600">
                        LKR{" "}
                        {formatLKR(
                          dailyData.reduce((sum, d) => sum + d.revenue, 0) /
                            dailyData.length
                        )}
                      </p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">Avg Daily Profit</p>
                      <p className="text-base sm:text-xl font-bold text-blue-600">
                        LKR{" "}
                        {formatLKR(
                          dailyData.reduce((sum, d) => sum + d.profit, 0) /
                            dailyData.length
                        )}
                      </p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">Avg Margin</p>
                      <p className="text-base sm:text-xl font-bold text-purple-600">
                        {(
                          dailyData.reduce((sum, d) => sum + d.margin, 0) /
                          dailyData.length
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 sm:py-12 text-gray-500">
                  <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                  <p className="text-sm sm:text-base">Add records from the last 30 days to see trends</p>
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">
                30-Day Cash Flow Forecast (incl. Recurring & On Hold)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={projectedCash}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 8 }}
                    tickFormatter={(date) => {
                      const d = new Date(date);
                      return d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis />
                  <Tooltip formatter={(value) => `LKR ${formatLKR(value)}`} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Projected Net Cash"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-3 sm:p-5">
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-black text-xs sm:text-sm">
                    Revenue
                  </span>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-1">
                  LKR {formatLKR(totals.inflow)}
                </h3>
                <p className="text-xs sm:text-sm opacity-90">Total Inflow</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-3 sm:p-5">
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-black text-xs sm:text-sm">
                    COGS
                  </span>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-1">
                  LKR {formatLKR(totals.inflowCost)}
                </h3>
                <p className="text-xs sm:text-sm opacity-90">Cost of Goods Sold</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-3 sm:p-5">
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <Award className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-black text-xs sm:text-sm">
                    {trueGrossMargin.toFixed(1)}%
                  </span>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-1">
                  LKR {formatLKR(totals.inflowProfit)}
                </h3>
                <p className="text-xs sm:text-sm opacity-90">Gross Profit (True)</p>
              </div>
              <div
                className={`bg-gradient-to-br ${
                  netProfit >= 0
                    ? "from-purple-500 to-purple-600"
                    : "from-orange-500 to-orange-600"
                } text-white rounded-lg shadow-lg p-3 sm:p-5`}
              >
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-black text-xs sm:text-sm">
                    Net
                  </span>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-1">
                  LKR {formatLKR(netProfit)}
                </h3>
                <p className="text-xs sm:text-sm opacity-90">Net Profit</p>
              </div>
              <div
                className={`bg-gradient-to-br ${
                  loanStatus === "On Track"
                    ? "from-green-500 to-teal-600"
                    : "from-red-500 to-orange-600"
                } text-white rounded-lg shadow-lg p-3 sm:p-5`}
              >
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-black text-xs sm:text-sm">
                    {loanCoveragePercent.toFixed(0)}%
                  </span>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-1">Loan Health</h3>
                <p className="text-xs sm:text-sm opacity-90">{loanStatus}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-lg p-3 sm:p-5">
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <Lock className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-black text-xs sm:text-sm">
                    {onHoldRatio.toFixed(0)}%
                  </span>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold mb-1">
                  LKR {formatLKR(totals.onHoldCash)}
                </h3>
                <p className="text-xs sm:text-sm opacity-90">On Hold Cash</p>
              </div>
            </div>
            {/* Entry Form */}
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                {isEditing !== null ? "Edit Record" : "Add New Record"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-4">
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  placeholder="Payment Date (optional)"
                  value={formData.paymentDate}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentDate: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description *"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {userSelectableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Quantity (default: 1)"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Supplied By (optional)"
                  value={formData.suppliedBy}
                  onChange={(e) =>
                    setFormData({ ...formData, suppliedBy: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Selling Price per Unit (LKR) *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 100"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Market/Competitor Price (LKR) - for competitive analysis
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 120"
                    value={formData.marketPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, marketPrice: e.target.value })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Cost per Unit (LKR){" "}
                    {formData.category === "Inflow" && "- for margin tracking"}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 60"
                    value={formData.costPerUnit}
                    onChange={(e) =>
                      setFormData({ ...formData, costPerUnit: e.target.value })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Profit Preview */}
              {formData.quantity &&
                formData.amount &&
                formData.costPerUnit &&
                formData.category === "Inflow" && (
                  <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="text-gray-600 font-medium">
                          Total Revenue
                        </p>
                        <p className="text-base sm:text-lg font-bold text-green-600">
                          LKR{" "}
                          {formatLKR(
                            parseFloat(formData.quantity) *
                              parseFloat(formData.amount)
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Total Cost</p>
                        <p className="text-base sm:text-lg font-bold text-red-600">
                          LKR{" "}
                          {formatLKR(
                            parseFloat(formData.quantity) *
                              parseFloat(formData.costPerUnit)
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">
                          Gross Profit
                        </p>
                        <p className="text-base sm:text-lg font-bold text-blue-600">
                          LKR{" "}
                          {formatLKR(
                            parseFloat(formData.quantity) *
                              (parseFloat(formData.amount) -
                                parseFloat(formData.costPerUnit))
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Margin</p>
                        <p className="text-base sm:text-lg font-bold text-purple-600">
                          {(
                            ((parseFloat(formData.amount) -
                              parseFloat(formData.costPerUnit)) /
                              parseFloat(formData.amount)) *
                            100
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
                <input
                  type="text"
                  placeholder="Customer (optional)"
                  value={formData.customer}
                  onChange={(e) =>
                    setFormData({ ...formData, customer: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Project (optional)"
                  value={formData.project}
                  onChange={(e) =>
                    setFormData({ ...formData, project: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Tags (comma-separated)"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4"
                rows="2"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold text-sm"
                >
                  {isEditing !== null ? "Update" : "Add Record"}
                </button>
                {isEditing !== null && (
                  <button
                    onClick={handleCancel}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
            {/* Recent Records Preview */}
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h2 className="text-base sm:text-xl font-bold mb-3 sm:mb-4">Recent Transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                        Date
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                        Description
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                        Category
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Qty
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Unit Price
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Total
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Margin
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRecords.slice(0, 10).map((record, index) => {
                      const qty = record.quantity || 1;
                      const price = record.amount;
                      const cost = record.cost_per_unit || 0;
                      const total = price * qty;
                      const revenue = price * qty;
                      const totalCost = cost * qty;
                      const profit = revenue - totalCost;
                      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                      return (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                            {record.date}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                            {record.description}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <span
                              className={`px-2 py-1 text-black rounded-full text-xs ${
                                record.category === "Inflow"
                                  ? "bg-green-100 text-green-800"
                                  : record.category === "Outflow"
                                  ? "bg-red-100 text-red-800"
                                  : record.category === "On Hold Cash"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {record.category}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            {qty}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            LKR {formatLKR(price)}
                          </td>
                          <td
                            className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold ${
                              record.category === "Inflow" ||
                              record.category === "Loan Received"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {record.category === "Inflow" ||
                            record.category === "Loan Received"
                              ? "+"
                              : "−"}{" "}
                            LKR {formatLKR(total)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right">
                            {margin !== null ? (
                              <span
                                className={`font-semibold ${
                                  margin >= 50
                                    ? "text-green-600"
                                    : margin >= 30
                                    ? "text-blue-600"
                                    : "text-orange-600"
                                }`}
                              >
                                {margin.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                            <button
                              onClick={() =>
                                handleEdit(
                                  recordsWithStrategicScore.findIndex(
                                    (r) => r.id === record.id
                                  )
                                )
                              }
                              className="text-blue-600 hover:text-blue-800 mx-0.5 sm:mx-1"
                            >
                              <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(
                                  recordsWithStrategicScore.findIndex(
                                    (r) => r.id === record.id
                                  )
                                )
                              }
                              className="text-red-600 hover:text-red-800 mx-0.5 sm:mx-1"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "suppliers" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2">
                <Factory className="w-6 h-6 sm:w-7 sm:h-7" />
                Supplier Cost Analysis
              </h2>
              <p className="text-amber-100 text-sm sm:text-base">
                Track spending by supplier to optimize procurement
              </p>
            </div>
            {supplierAnalysis.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6 text-center">
                <Factory className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-600 mx-auto mb-2 sm:mb-3" />
                <p className="text-yellow-800 text-sm sm:text-base">
                  No supplier data available. Add “Supplied By” to your records
                  to see analysis.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                          Supplier
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Total Cost
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Transactions
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          % of COGS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {supplierAnalysis.map((supplier, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">
                            {supplier.name}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-red-600">
                            LKR {formatLKR(supplier.cost)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            {supplier.transactions}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-blue-600 font-medium">
                            {totals.inflowCost > 0
                              ? (
                                  (supplier.cost / totals.inflowCost) *
                                  100
                                ).toFixed(1)
                              : "0"}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "records" && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-xl font-bold flex items-center gap-2 mb-2 sm:mb-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                Complete Transaction History (Strategically Ranked)
              </h2>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No Grouping</option>
                <option value="customer">Group by Customer</option>
                <option value="product">Group by Product</option>
                <option value="supplier">Group by Supplier</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              {groupBy === "none" ? (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                        Date
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                        Description
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                        Category
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                        Customer
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                        Supplied By
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Qty
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Unit Price
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Cost/Unit
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Total
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Profit
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                        Margin
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-600">
                        Strategic Rank
                      </th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recordsWithStrategicScore.map((record, index) => {
                      const qty = record.quantity || 1;
                      const price = record.amount;
                      const cost = record.cost_per_unit || 0;
                      const total = price * qty;
                      const totalCost = cost * qty;
                      const profit = total - totalCost;
                      const margin =
                        price > 0 && cost > 0
                          ? ((price - cost) / price) * 100
                          : null;
                      return (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                            {record.date}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                            {record.description}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <span
                              className={`px-2 py-1 text-black rounded-full text-xs ${
                                record.category === "Inflow"
                                  ? "bg-green-100 text-green-800"
                                  : record.category === "Outflow"
                                  ? "bg-red-100 text-red-800"
                                  : record.category === "Reinvestment"
                                  ? "bg-blue-100 text-blue-800"
                                  : record.category === "Overhead"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : record.category === "On Hold Cash"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {record.category}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                            {record.customer || "-"}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                            {record.supplied_by || "-"}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            {qty}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            LKR {formatLKR(price)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            {cost > 0 ? `LKR ${formatLKR(cost)}` : "-"}
                          </td>
                          <td
                            className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold ${
                              record.category === "Inflow" ||
                              record.category === "Loan Received"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {record.category === "Inflow" ||
                            record.category === "Loan Received"
                              ? "+"
                              : "−"}{" "}
                            LKR {formatLKR(total)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-blue-600">
                            {record.category === "Inflow" && cost > 0
                              ? `LKR ${formatLKR(profit)}`
                              : "-"}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right">
                            {margin !== null ? (
                              <span
                                className={`font-semibold ${
                                  margin >= 50
                                    ? "text-green-600"
                                    : margin >= 30
                                    ? "text-blue-600"
                                    : margin >= 15
                                    ? "text-orange-600"
                                    : "text-red-600"
                                }`}
                              >
                                {margin.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-black rounded-full font-medium text-xs">
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                            <button
                              onClick={() => handleEdit(index)}
                              className="text-blue-600 hover:text-blue-800 mx-0.5 sm:mx-1"
                            >
                              <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(index)}
                              className="text-red-600 hover:text-red-800 mx-0.5 sm:mx-1"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-4">
                  {groupedRecords.map(({ group, items }) => (
                    <div key={group} className="border rounded-lg p-3 sm:p-4">
                      <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3">{group}</h3>
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 sm:px-3 py-1 sm:py-2 text-left">Date</th>
                            <th className="px-2 sm:px-3 py-1 sm:py-2 text-left">Description</th>
                            <th className="px-2 sm:px-3 py-1 sm:py-2 text-right">Total</th>
                            <th className="px-2 sm:px-3 py-1 sm:py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((record, idx) => {
                            const total =
                              (parseFloat(record.amount) || 0) *
                              (parseFloat(record.quantity) || 1);
                            return (
                              <tr key={record.id} className="border-b">
                                <td className="px-2 sm:px-3 py-1 sm:py-2">{record.date}</td>
                                <td className="px-2 sm:px-3 py-1 sm:py-2">
                                  {record.description}
                                </td>
                                <td className="px-2 sm:px-3 py-1 sm:py-2 text-right">
                                  LKR {formatLKR(total)}
                                </td>
                                <td className="px-2 sm:px-3 py-1 sm:py-2 text-right">
                                  <button
                                    onClick={() =>
                                      handleEdit(
                                        recordsWithStrategicScore.findIndex(
                                          (r) => r.id === record.id
                                        )
                                      )
                                    }
                                    className="text-blue-600 hover:text-blue-800 mx-0.5 sm:mx-1"
                                  >
                                    <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDelete(
                                        recordsWithStrategicScore.findIndex(
                                          (r) => r.id === record.id
                                        )
                                      )
                                    }
                                    className="text-red-600 hover:text-red-800 mx-0.5 sm:mx-1"
                                  >
                                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "margins" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2">
                <Percent className="w-6 h-6 sm:w-7 sm:h-7" />
                Profit Margin Intelligence
              </h2>
              <p className="text-purple-100 text-sm sm:text-base">
                Deep dive into your product/service profitability
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Average Margin</h3>
                <p className="text-xl sm:text-3xl font-bold text-blue-600">
                  {trueGrossMargin.toFixed(1)}%
                </p>
                <p className="text-black text-gray-500 mt-1 text-xs sm:text-sm">
                  Across all products
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Total Markup</h3>
                <p className="text-xl sm:text-3xl font-bold text-green-600">
                  LKR {formatLKR(totals.inflowProfit)}
                </p>
                <p className="text-black text-gray-500 mt-1 text-xs sm:text-sm">
                  Gross profit from sales
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">COGS</h3>
                <p className="text-xl sm:text-3xl font-bold text-red-600">
                  LKR {formatLKR(totals.inflowCost)}
                </p>
                <p className="text-black text-gray-500 mt-1 text-xs sm:text-sm">
                  Cost of goods sold
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">Markup Ratio</h3>
                <p className="text-xl sm:text-3xl font-bold text-purple-600">
                  {totals.inflowCost > 0
                    ? (totals.inflowProfit / totals.inflowCost).toFixed(2)
                    : "0"}
                  x
                </p>
                <p className="text-black text-gray-500 mt-1 text-xs sm:text-sm">
                  Profit per cost LKR
                </p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-5">
              <div className="flex items-start gap-2 sm:gap-3">
                <Lightbulb className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-1" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1 sm:mb-2 text-sm sm:text-base">
                    Margin Health Check
                  </h3>
                  <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-blue-800">
                    {trueGrossMargin >= 50 && (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>
                          Excellent margins - you have strong pricing power
                        </span>
                      </div>
                    )}
                    {trueGrossMargin >= 30 && trueGrossMargin < 50 && (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>
                          Good margins - consider testing price increases on
                          high-demand items
                        </span>
                      </div>
                    )}
                    {trueGrossMargin < 30 && trueGrossMargin > 0 && (
                      <div className="flex items-center gap-1 sm:gap-2">
                        <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>
                          Margins below target - review pricing strategy and
                          cost optimization
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2">
                <Package className="w-6 h-6 sm:w-7 sm:h-7" />
                Product/Service Performance
              </h2>
              <p className="text-teal-100 text-sm sm:text-base">
                Identify your profit champions and underperformers
              </p>
            </div>
            {productMargins.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6 text-center">
                <Package className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-600 mx-auto mb-2 sm:mb-3" />
                <p className="text-yellow-800 text-sm sm:text-base">
                  No product data available. Add cost tracking to your inflow
                  records to see detailed analysis.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                          Product/Service
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Qty Sold
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Avg Price
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Avg Cost
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Unit Profit
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Total Profit
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Margin %
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Customers
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                          Turnover
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {productMargins.map((product, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">
                            {product.name}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            {product.quantity.toFixed(0)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            LKR {formatLKR(product.avgPrice)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            LKR {formatLKR(product.avgCost)}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold">
                            {product.avgProfit >= 0 ? (
                              <span className="text-green-600">
                                + LKR {formatLKR(product.avgProfit)}
                              </span>
                            ) : (
                              <span className="text-red-600">
                                − LKR {formatLKR(Math.abs(product.avgProfit))}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold">
                            {product.profit >= 0 ? (
                              <span className="text-green-600">
                                + LKR {formatLKR(product.profit)}
                              </span>
                            ) : (
                              <span className="text-red-600">
                                − LKR {formatLKR(Math.abs(product.profit))}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right">
                            <span
                              className={`font-bold ${
                                product.margin >= 50
                                  ? "text-green-600"
                                  : product.margin >= 30
                                  ? "text-blue-600"
                                  : product.margin >= 15
                                  ? "text-orange-600"
                                  : "text-red-600"
                              }`}
                            >
                              {product.margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            {product.customers}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                            {product.inventoryTurnover.toFixed(1)}x
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "customers" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2">
                <Users className="w-6 h-6 sm:w-7 sm:h-7" />
                Customer Profitability Analysis
              </h2>
              <p className="text-indigo-100 text-sm sm:text-base">
                Understand which customers drive the most profit
              </p>
            </div>
            {customerAnalysis.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6 text-center">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-600 mx-auto mb-2 sm:mb-3" />
                <p className="text-yellow-800 text-sm sm:text-base">
                  No customer data available. Add customer names to your inflow
                  records to see analysis.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                            Customer
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Revenue
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Cost
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Profit
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Margin
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Transactions
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Avg Order
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Estimated CLV
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {customerAnalysis.map((customer, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">
                              {customer.name}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-green-600">
                              LKR {formatLKR(customer.revenue)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-red-600">
                              LKR {formatLKR(customer.cost)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-blue-600">
                              LKR {formatLKR(customer.profit)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right">
                              <span
                                className={`font-bold ${
                                  customer.margin >= 50
                                    ? "text-green-600"
                                    : customer.margin >= 30
                                    ? "text-blue-600"
                                    : "text-orange-600"
                                }`}
                              >
                                {customer.margin.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                              {customer.transactions}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                              LKR {formatLKR(customer.avgTransaction)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-purple-600">
                              {customer.clv !== null
                                ? `LKR ${formatLKR(customer.clv)}`
                                : hasSufficientHistory
                                ? "—"
                                : (
                                  <span className="text-gray-400" title="Need ≥90 days of data for CLV">
                                    CLV not available
                                  </span>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">
                    Customer Concentration Risk
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={customerAnalysis.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => `LKR ${formatLKR(value)}`}
                      />
                      <Legend />
                      <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
                      <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "pricing" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
                AI-Powered Pricing Intelligence
              </h2>
              <p className="text-orange-100 text-sm sm:text-base">
                Data-driven recommendations to optimize your margins
              </p>
            </div>
            {pricingRecommendations.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-6 text-center">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 mx-auto mb-2 sm:mb-3" />
                <p className="text-green-800 font-semibold text-sm sm:text-base">
                  All products have healthy margins (30%+)
                </p>
                <p className="text-green-700 text-xs sm:text-sm mt-1 sm:mt-2">
                  Continue monitoring and consider testing premium pricing on
                  best sellers
                </p>
              </div>
            ) : (
              <>
                <div className="bg-orange-50 border-l-4 border-orange-500 p-4 sm:p-5 rounded-r-lg">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Zap className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600 flex-shrink-0 mt-0.5 sm:mt-1" />
                    <div>
                      <h3 className="font-bold text-orange-900 mb-1 sm:mb-2 text-sm sm:text-base">
                        Quick Win Opportunities
                      </h3>
                      <p className="text-xs sm:text-sm text-orange-800 mb-2 sm:mb-3">
                        Implementing these price adjustments could generate an
                        additional{" "}
                        <span className="font-bold">
                          LKR{" "}
                          {formatLKR(
                            pricingRecommendations.reduce(
                              (sum, r) => sum + r.potentialRevenue,
                              0
                            )
                          )}
                        </span>{" "}
                        in revenue without changing volume.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-600">
                            Product/Service
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Current Margin
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Current Price
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Recommended Price
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Increase
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-600">
                            Potential Revenue
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-600">
                            Priority
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pricingRecommendations.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">
                              {rec.product}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right">
                              <span className="text-red-600 font-bold">
                                {rec.currentMargin.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-600">
                              LKR {formatLKR(rec.currentPrice)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-green-600">
                              LKR {formatLKR(rec.recommendedPrice)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right">
                              <span className="text-orange-600 font-bold">
                                +{rec.percentIncrease.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-bold text-blue-600">
                              +LKR {formatLKR(rec.potentialRevenue)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                              <span
                                className={`px-2 sm:px-3 py-0.5 sm:py-1 text-black font-semibold rounded-full text-xs ${
                                  idx < 3
                                    ? "bg-red-100 text-red-800"
                                    : idx < 6
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {idx < 3 ? "High" : idx < 6 ? "Medium" : "Low"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-5">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Lightbulb className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-1" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1 sm:mb-2 text-sm sm:text-base">
                        Implementation Strategy
                      </h3>
                      <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-blue-800">
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Test incrementally:</strong> Start with
                            10-15% increases to gauge customer response
                          </span>
                        </li>
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Bundle strategically:</strong> Combine
                            low-margin items with high-margin services
                          </span>
                        </li>
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Value communication:</strong> Ensure pricing
                            reflects the quality and outcomes you deliver
                          </span>
                        </li>
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Monitor closely:</strong> Track conversion
                            rates and customer feedback after adjustments
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <div className="bg-gradient-to-br from-rose-50 to-red-100 border-2 border-red-300 rounded-lg p-4 sm:p-5">
                <h3 className="font-bold text-red-900 mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  Top Strategic Risks & Opportunities
                </h3>
                <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-red-800">
                  {recordsWithStrategicScore
                    .filter((r) => r.strategicScore < 0)
                    .sort((a, b) => a.strategicScore - b.strategicScore)
                    .slice(0, 3)
                    .map((r, idx) => (
                      <li key={r.id} className="flex items-start gap-1 sm:gap-2">
                        <span className="font-mono bg-red-200 text-red-900 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs">
                          {r.strategicScore.toFixed(1)}
                        </span>
                        <span>
                          <strong>{r.description}</strong> ({r.category}) on{" "}
                          {r.date} —
                          {r.category === "Refund"
                            ? " High customer dissatisfaction risk"
                            : r.category === "Logistics"
                            ? " Above-average logistics cost"
                            : r.category === "On Hold Cash"
                            ? " High committed cash ratio"
                            : "Low strategic impact"}
                        </span>
                      </li>
                    ))}
                  {recordsWithStrategicScore.filter((r) => r.strategicScore < 0)
                    .length === 0 && (
                    <li className="flex items-center gap-1 sm:gap-2">
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                      No high-risk transactions detected in the selected period.
                    </li>
                  )}
                </ul>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" />
                Strategic Business Analytics
              </h2>
              <p className="text-purple-100 text-sm sm:text-base">
                Enterprise-grade insights for data-driven decision making
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                Business Performance Scorecard
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={businessValueData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Current"
                    dataKey="current"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.6}
                  />
                  <Radar
                    name="Target"
                    dataKey="target"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mt-3 sm:mt-4">
                {businessValueData.map((item, idx) => (
                  <div key={idx} className="text-center">
                    <p className="text-xs sm:text-sm text-gray-600">{item.metric}</p>
                    <p className="text-lg sm:text-2xl font-bold text-purple-600">
                      {Number(item.current).toFixed(0)}%
                    </p>
                    <p className="text-black text-gray-500 text-xs sm:text-sm">
                      Target: {item.target}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                Investment ROI Timeline
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={roiTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value}K`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="investment"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Investment"
                  />
                  <Line
                    type="monotone"
                    dataKey="return"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Return"
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    name="Net Gain"
                  />
                </LineChart>
              </ResponsiveContainer>
              {hasSufficientHistory ? (
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-green-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-green-800">
                    <strong>Break-even projection:</strong> {breakEvenMonth || "N/A"} |{" "}
                    <strong className="ml-2 sm:ml-3">12-month ROI:</strong> {roiPercentage}% |{" "}
                    <strong className="ml-2 sm:ml-3">Payback period:</strong> {paybackMonth || "N/A"}
                  </p>
                </div>
              ) : (
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-yellow-50 border-l-4 border-yellow-400 text-xs sm:text-sm text-yellow-800">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  ROI projections require at least 3 months of transaction history.
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                Analytics Maturity Assessment
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={maturityData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="stage" type="category" width={80} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="score" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 sm:mt-4 space-y-2">
                {maturityData.map((stage, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs sm:text-sm"
                  >
                    <span className="font-medium text-gray-700">
                      {stage.stage}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 sm:w-48 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${stage.score}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 w-8 sm:w-12 text-right">
                        {stage.score}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                Revenue & Profit Trends (This Month)
              </h3>
              {monthlyData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => `LKR ${formatLKR(value)}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Revenue"
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Profit"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">
                        Avg Monthly Revenue
                      </p>
                      <p className="text-base sm:text-xl font-bold text-green-600">
                        LKR{" "}
                        {formatLKR(
                          monthlyData.reduce((sum, m) => sum + m.revenue, 0) /
                            monthlyData.length
                        )}
                      </p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">
                        Avg Monthly Profit
                      </p>
                      <p className="text-base sm:text-xl font-bold text-blue-600">
                        LKR{" "}
                        {formatLKR(
                          monthlyData.reduce((sum, m) => sum + m.profit, 0) /
                            monthlyData.length
                        )}
                      </p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">Avg Margin</p>
                      <p className="text-base sm:text-xl font-bold text-purple-600">
                        {(
                          monthlyData.reduce((sum, m) => sum + m.margin, 0) /
                          monthlyData.length
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-400" />
                  <p className="text-sm sm:text-base">Add more records with dates to see monthly trends</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4 sm:p-5">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Target className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-1" />
                  <div>
                    <h3 className="font-bold text-blue-900 mb-1 sm:mb-2 text-sm sm:text-base">
                      Current Performance
                    </h3>
                    <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-blue-800">
                      <li className="flex items-start gap-1 sm:gap-2">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Records tracked:</strong> {records.length}{" "}
                          transactions
                        </span>
                      </li>
                      <li className="flex items-start gap-1 sm:gap-2">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Cost tracking:</strong>{" "}
                          {(
                            (filteredRecords.filter(
                              (r) => r.category === "Inflow" && r.cost_per_unit
                            ).length /
                              Math.max(
                                filteredRecords.filter(
                                  (r) => r.category === "Inflow"
                                ).length,
                                1
                              )) *
                            100
                          ).toFixed(0)}
                          % of sales have cost data
                        </span>
                      </li>
                      <li className="flex items-start gap-1 sm:gap-2">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Customer tracking:</strong>{" "}
                          {customerAnalysis.length} unique customers identified
                        </span>
                      </li>
                      <li className="flex items-start gap-1 sm:gap-2">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Recurring costs:</strong> {recurringCosts.length}{" "}
                          fixed expenses managed
                        </span>
                      </li>
                      <li className="flex items-start gap-1 sm:gap-2">
                        <Lock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>On Hold Cash:</strong> {totals.onHoldCash > 0 ? `LKR ${formatLKR(totals.onHoldCash)}` : "None"} tracked
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4 sm:p-5">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Lightbulb className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-1" />
                  <div>
                    <h3 className="font-bold text-purple-900 mb-1 sm:mb-2 text-sm sm:text-base">
                      Next Steps to Improve
                    </h3>
                    <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-purple-800">
                      {filteredRecords.filter(
                        (r) => r.category === "Inflow" && !r.cost_per_unit
                      ).length > 0 && (
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Add cost tracking to{" "}
                            {
                              filteredRecords.filter(
                                (r) =>
                                  r.category === "Inflow" && !r.cost_per_unit
                              ).length
                            }{" "}
                            sales records for better margin analysis
                          </span>
                        </li>
                      )}
                      {filteredRecords.filter((r) => !r.customer).length >
                        0 && (
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Add customer names to{" "}
                            {filteredRecords.filter((r) => !r.customer).length}{" "}
                            records for customer profitability tracking
                          </span>
                        </li>
                      )}
                      {filteredRecords.filter((r) => !r.supplied_by).length >
                        0 && (
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Add supplier info to{" "}
                            {
                              filteredRecords.filter((r) => !r.supplied_by)
                                .length
                            }{" "}
                            records for procurement insights
                          </span>
                        </li>
                      )}
                      {Object.keys(budgets).length === 0 && (
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Set budgets for expense categories to enable budget
                            monitoring and alerts
                          </span>
                        </li>
                      )}
                      {records.length < 50 && (
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Add more transaction history for better trend
                            analysis and insights
                          </span>
                        </li>
                      )}
                      {recurringCosts.length === 0 && (
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Add recurring costs to automate overhead tracking
                            and improve forecasting
                          </span>
                        </li>
                      )}
                      {totals.onHoldCash === 0 && (
                        <li className="flex items-start gap-1 sm:gap-2">
                          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Start tracking "On Hold Cash" to monitor committed funds and improve cash flow visibility
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "competitive" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-lg shadow-lg p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 flex items-center gap-2">
                <Target className="w-6 h-6 sm:w-7 sm:h-7" />
                Competitive Positioning Intelligence
              </h2>
              <p className="text-indigo-100 text-sm sm:text-base">
                Understand your pricing power vs market rates and competitors
              </p>
            </div>
            {competitiveAnalysis.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6 text-center">
                <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-600 mx-auto mb-2 sm:mb-3" />
                <p className="text-yellow-800 font-semibold mb-1 sm:mb-2 text-sm sm:text-base">
                  No competitive data available yet
                </p>
                <p className="text-yellow-700 text-xs sm:text-sm">
                  Add market pricing data to your inflow records to unlock
                  competitive analysis and see where you can capture more value.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-4 sm:p-5">
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                      <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-xs sm:text-sm">
                        Tracked
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-bold mb-1">
                      {competitiveAnalysis.length}
                    </h3>
                    <p className="text-xs sm:text-sm opacity-90">
                      Products with Market Data
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-4 sm:p-5">
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <Zap className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                      <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-xs sm:text-sm">
                        Opportunity
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-bold mb-1">
                      LKR {formatLKR(competitiveTotals.totalCompetitiveEdge)}
                    </h3>
                    <p className="text-xs sm:text-sm opacity-90">
                      Potential Revenue Upside
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-4 sm:p-5">
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <Percent className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                      <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-xs sm:text-sm">
                        Margin
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-bold mb-1">
                      {competitiveTotals.count > 0
                        ? (
                            competitiveTotals.avgMargin /
                            competitiveTotals.count
                          ).toFixed(1)
                        : "0"}
                      %
                    </h3>
                    <p className="text-xs sm:text-sm opacity-90">Avg Competitive Margin</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-4 sm:p-5">
                    <div className="flex justify-between items-start mb-1 sm:mb-2">
                      <Calculator className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                      <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-xs sm:text-sm">
                        Position
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-bold mb-1">
                      {competitiveAnalysis.filter((a) => a.underpriced).length}
                    </h3>
                    <p className="text-xs sm:text-sm opacity-90">Underpriced Products</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                    Competitive Positioning by Product
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={competitiveAnalysis.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => `LKR ${formatLKR(value)}`}
                      />
                      <Legend />
                      <Bar
                        dataKey="sellingPrice"
                        fill="#3b82f6"
                        name="Your Price"
                      />
                      <Bar
                        dataKey="marketPrice"
                        fill="#10b981"
                        name="Market Price"
                      />
                      <Bar
                        dataKey="competitiveEdge"
                        fill="#8b5cf6"
                        name="Competitive Edge"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">
                    Detailed Competitive Analysis
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-semibold text-gray-600">
                            Product
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-600">
                            Your Price
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-600">
                            Market Price
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-600">
                            Price Position
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-600">
                            Margin %
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-gray-600">
                            Competitive Edge
                          </th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-center font-semibold text-gray-600">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {competitiveAnalysis.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-900 font-medium">
                              {item.name}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-right">
                              LKR {formatLKR(item.sellingPrice)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-right">
                              LKR {formatLKR(item.marketPrice)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold">
                              {(
                                (item.sellingPrice / item.marketPrice) *
                                100
                              ).toFixed(0)}
                              %
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-green-600">
                              {item.grossMargin.toFixed(1)}%
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-right font-semibold text-purple-600">
                              LKR {formatLKR(item.competitiveEdge)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                              {item.underpriced && (
                                <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-black font-semibold bg-green-100 text-green-800 rounded-full text-xs">
                                  UNDERPRICED ↗️
                                </span>
                              )}
                              {item.overpriced && (
                                <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-black font-semibold bg-orange-100 text-orange-800 rounded-full text-xs">
                                  PREMIUM 💎
                                </span>
                              )}
                              {!item.underpriced && !item.overpriced && (
                                <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-black font-semibold bg-blue-100 text-blue-800 rounded-full text-xs">
                                  MARKET RATE ✓
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  {competitiveAnalysis.filter((a) => a.underpriced).length >
                    0 && (
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4 sm:p-5">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Zap className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 flex-shrink-0 mt-0.5 sm:mt-1" />
                        <div>
                          <h3 className="font-bold text-green-900 mb-1 sm:mb-2 text-sm sm:text-base">
                            Quick Win Opportunities
                          </h3>
                          <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-green-800">
                            {competitiveAnalysis
                              .filter((a) => a.underpriced)
                              .slice(0, 3)
                              .map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-1 sm:gap-2"
                                >
                                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 mt-0.5" />
                                  <span>
                                    <strong>{item.name}:</strong> Raise price to
                                    LKR {formatLKR(item.marketPrice)}= +LKR{" "}
                                    {formatLKR(item.competitiveEdge)} revenue
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4 sm:p-5">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Lightbulb className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-1" />
                      <div>
                        <h3 className="font-bold text-blue-900 mb-1 sm:mb-2 text-sm sm:text-base">
                          Competitive Positioning Guide
                        </h3>
                        <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm text-blue-800">
                          <li className="flex items-start gap-1 sm:gap-2">
                            <span className="font-bold">UNDERPRICED ↗️:</span>
                            You're below market. Test gradual price increases to
                            capture more value without losing customers.
                          </li>
                          <li className="flex items-start gap-1 sm:gap-2">
                            <span className="font-bold">PREMIUM 💎:</span>
                            You're above market but profitable. Emphasize unique
                            value and quality to justify premium pricing.
                          </li>
                          <li className="flex items-start gap-1 sm:gap-2">
                            <span className="font-bold">MARKET RATE ✓:</span>
                            Competitive pricing. Focus on service
                            differentiation and customer loyalty programs.
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modals */}
        {showTargetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-md w-full mx-auto">
              <h3 className="text-base sm:text-xl font-bold mb-3 sm:mb-4">Set Revenue Target</h3>
              <input
                type="number"
                inputMode="decimal"
                value={targetRevenue}
                onChange={(e) =>
                  setTargetRevenue(parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4"
                placeholder="Enter target revenue (LKR)"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTargetModal(false)}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowTargetModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showLoanModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-md w-full mx-auto">
              <h3 className="text-base sm:text-xl font-bold mb-3 sm:mb-4">
                Set Monthly Loan Target
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                This is the minimum monthly inflow needed to comfortably cover
                your loan payments.
              </p>
              <input
                type="number"
                inputMode="decimal"
                value={monthlyLoanTarget}
                onChange={(e) =>
                  setMonthlyLoanTarget(parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4"
                placeholder="Enter monthly loan target (LKR)"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveLoanTarget}
                  className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 transition-colors text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showBudgetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-md w-full mx-auto">
              <h3 className="text-base sm:text-xl font-bold mb-3 sm:mb-4">Set Category Budget</h3>
              <select
                value={budgetCategory}
                onChange={(e) => setBudgetCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4"
              >
                {categories
                  .filter((c) => c !== "Inflow")
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4"
                placeholder="Enter budget amount (LKR)"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveBudget}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  Save Budget
                </button>
                <button
                  onClick={() => {
                    setShowBudgetModal(false);
                    setBudgetAmount("");
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showRecurringModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-xs sm:max-w-md w-full mx-auto">
              <h3 className="text-base sm:text-xl font-bold mb-3 sm:mb-4">
                {isEditingRecurring ? "Edit" : "Add"} Recurring Cost
              </h3>
              <input
                type="text"
                placeholder="Description (e.g., Office Rent)"
                value={recurringForm.description}
                onChange={(e) =>
                  setRecurringForm({
                    ...recurringForm,
                    description: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2 sm:mb-3"
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="Monthly Amount (LKR)"
                value={recurringForm.amount}
                onChange={(e) =>
                  setRecurringForm({ ...recurringForm, amount: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2 sm:mb-3"
              />
              <textarea
                placeholder="Notes (optional)"
                value={recurringForm.notes}
                onChange={(e) =>
                  setRecurringForm({ ...recurringForm, notes: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3 sm:mb-4"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveRecurringCost}
                  className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm"
                >
                  {isEditingRecurring ? "Update" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setShowRecurringModal(false);
                    resetRecurringForm();
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showStrategyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-4xl sm:max-w-6xl w-full my-4 sm:my-8 mx-auto">
              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 flex items-center gap-2">
                    <Layers className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600" />
                    Strategic Implementation Roadmap
                  </h3>
                  <p className="text-gray-600 text-sm sm:text-base">
                    Transform your business with data-driven sales analytics
                  </p>
                </div>
                <button
                  onClick={() => setShowStrategyModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <span className="text-xl sm:text-2xl">×</span>
                </button>
              </div>
              <div className="space-y-4 sm:space-y-6">
                {implementationPhases.map((phase, idx) => {
                  const Icon = phase.icon;
                  const isExpanded = expandedSection === idx;
                  return (
                    <div
                      key={idx}
                      className="border-2 border-gray-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedSection(isExpanded ? null : idx)
                        }
                        className="w-full p-3 sm:p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div
                            className={`${phase.color} p-2 sm:p-3 rounded-lg text-white`}
                          >
                            <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-base sm:text-lg text-gray-900">
                              Phase {idx + 1}: {phase.phase}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-600">
                              {phase.duration} • Expected Value: {phase.value}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span
                            className={`text-black font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm ${
                              idx === 0
                                ? "bg-green-100 text-green-700"
                                : idx === 1
                                ? "bg-blue-100 text-blue-700"
                                : idx === 2
                                ? "bg-purple-100 text-purple-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {idx === 0
                              ? "Ready to Start"
                              : idx === 1
                              ? "Next Priority"
                              : idx === 2
                              ? "Future Phase"
                              : "Long-term"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="p-3 sm:p-5 bg-gray-50 border-t-2 border-gray-200">
                          <h5 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">
                            Key Deliverables:
                          </h5>
                          <ul className="space-y-1 sm:space-y-2">
                            {phase.tasks.map((task, taskIdx) => (
                              <li
                                key={taskIdx}
                                className="flex items-start gap-2 sm:gap-3"
                              >
                                <div className="mt-0.5">
                                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="w-2 h-2 sm:w-3 sm:h-3 text-green-600" />
                                  </div>
                                </div>
                                <span className="text-gray-700 text-xs sm:text-sm">{task}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 sm:mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 sm:p-5 rounded-lg border-2 border-green-300">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <Database className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
                    <h4 className="font-bold text-green-900 text-sm sm:text-base">
                      Data Foundation
                    </h4>
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-green-600 mb-1 sm:mb-2">
                    {records.length}
                  </p>
                  <p className="text-xs sm:text-sm text-green-800">
                    Total records collected. Build to 200+ for robust analytics
                    and predictive insights.
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 sm:p-5 rounded-lg border-2 border-blue-300">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <Percent className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                    <h4 className="font-bold text-blue-900 text-sm sm:text-base">Margin Quality</h4>
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-blue-600 mb-1 sm:mb-2">
                    {(
                      (filteredRecords.filter(
                        (r) => r.category === "Inflow" && r.cost_per_unit
                      ).length /
                        Math.max(
                          filteredRecords.filter(
                            (r) => r.category === "Inflow"
                          ).length,
                          1
                        )) *
                      100
                    ).toFixed(0)}
                    %
                  </p>
                  <p className="text-xs sm:text-sm text-blue-800">
                    Sales with cost tracking. Target 90%+ for accurate
                    profitability analysis.
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 sm:p-5 rounded-lg border-2 border-purple-300">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <Users className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
                    <h4 className="font-bold text-purple-900 text-sm sm:text-base">
                      Customer Insights
                    </h4>
                  </div>
                  <p className="text-xl sm:text-3xl font-bold text-purple-600 mb-1 sm:mb-2">
                    {customerAnalysis.length}
                  </p>
                  <p className="text-xs sm:text-sm text-purple-800">
                    Unique customers tracked. Segment and analyze for better
                    targeting strategies.
                  </p>
                </div>
              </div>
              <div className="mt-4 sm:mt-8 p-4 sm:p-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg text-white">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                  <div>
                    <h4 className="font-bold text-lg sm:text-xl mb-1 sm:mb-2">
                      Ready to Transform Your Sales Process?
                    </h4>
                    <p className="text-purple-100 text-sm sm:text-base">
                      Start with Phase 1 and see measurable results in 6-8 weeks
                    </p>
                  </div>
                  <button className="bg-white text-purple-600 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors shadow-lg text-sm sm:text-base">
                    Schedule Strategy Session
                  </button>
                </div>
              </div>
              <div className="mt-4 sm:mt-6 flex justify-end">
                <button
                  onClick={() => setShowStrategyModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm sm:text-base"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}