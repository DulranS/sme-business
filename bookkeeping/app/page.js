"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import Papa from "papaparse";
import {
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Download,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  AlertCircle,
  Target,
  Lightbulb,
  Award,
  AlertTriangle,
  CheckCircle,
  Database,
  RefreshCw,
  Brain,
  Users,
  FileText,
  Layers,
  Bell,
  Calculator,
  Percent,
  ShoppingCart,
  Package,
  Sparkles,
  ArrowRight,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  Factory,
  CreditCard,
  Shield,
  Recycle,
  ArrowUp,
  HeartPulse,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const STRATEGIC_WEIGHTS = {
  Inflow: 10,
  Reinvestment: 8,
  "Loan Received": 7,
  "Inventory Purchase": 5,
  Logistics: -2, // ← new: operational cost
  Refund: -6, // ← new: customer dissatisfaction + lost margin
  Outflow: -3,
  Overhead: -4,
  "Loan Payment": -2,
};
const categoryLabels = {
  Inflow: "Revenue",
  Outflow: "Payment",
  Overhead: "Financial Control",
  Reinvestment: "Reinvestment",
  "Loan Payment": "Loan Payment",
  "Loan Received": "Loan Received",
  "Inventory Purchase": "Inventory Purchase",
  Logistics: "Logistics", // ← new
  Refund: "Refund", // ← new
};

const internalCategories = [
  "Inflow",
  "Outflow",
  "Reinvestment",
  "Overhead",
  "Loan Payment",
  "Loan Received",
  "Inventory Purchase",
  "Logistics", // ← new
  "Refund", // ← new
];

export default function BookkeepingApp() {
  const [records, setRecords] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
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
  const [targetRevenue, setTargetRevenue] = useState(100000);
  const [monthlyLoanTarget, setMonthlyLoanTarget] = useState(458333);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [budgets, setBudgets] = useState({});
  const [budgetCategory, setBudgetCategory] = useState("Overhead");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [expandedSection, setExpandedSection] = useState(null);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [groupBy, setGroupBy] = useState("none");
  const categories = internalCategories;

  // --- Save Budget ---
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

  // --- Save Loan Target ---
  const saveLoanTarget = () => {
    if (monthlyLoanTarget <= 0) {
      alert("Please enter a valid monthly loan target");
      return;
    }
    localStorage.setItem("monthlyLoanTarget", monthlyLoanTarget.toString());
    setShowLoanModal(false);
    alert("Monthly loan target updated!");
  };

  // --- Sync Data ---
  const syncRecords = async () => {
    setSyncing(true);
    try {
      await loadRecords();
      await loadBudgets();
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Failed to sync data. Please check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  };

  // --- Load Data ---
  useEffect(() => {
    const savedLoanTarget = localStorage.getItem("monthlyLoanTarget");
    if (savedLoanTarget) setMonthlyLoanTarget(parseFloat(savedLoanTarget));

    // Set default date filter to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setDateFilter({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });

    loadRecords();
    loadBudgets();
  }, []);

  const loadRecords = async () => {
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
  };

  const loadBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from("category_budgets")
        .select("*");
      if (!error && data) {
        const budgetMap = {};
        data.forEach((b) => (budgetMap[b.category] = b.amount));
        setBudgets(budgetMap);
      }
    } catch (error) {
      console.error("Error loading budgets:", error);
    }
  };

  const filteredRecords = useMemo(() => {
    if (!dateFilter.start && !dateFilter.end) return records;
    return records.filter((r) => {
      const recordDate = new Date(r.date);
      const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
      const endDate = dateFilter.end ? new Date(dateFilter.end) : null;
      if (startDate && endDate)
        return recordDate >= startDate && recordDate <= endDate;
      if (startDate) return recordDate >= startDate;
      if (endDate) return recordDate <= endDate;
      return true;
    });
  }, [records, dateFilter]);

  const inventoryCostMap = useMemo(() => {
    const map = {};
    const inventoryRecords = filteredRecords.filter(
      (r) => r.category === "Inventory Purchase"
    );
    inventoryRecords.forEach((r) => {
      const key = r.description;
      const qty = parseFloat(r.quantity) || 0;
      const cost = parseFloat(r.cost_per_unit) || 0;
if (!key || cost <= 0) return;
      if (!map[key]) {
        map[key] = { totalCost: 0, totalQty: 0 };
      }
map[key].totalCost += cost * qty; // qty can be negative
map[key].totalQty += qty;
    });
    Object.keys(map).forEach((key) => {
      map[key] =
        map[key].totalQty > 0 ? map[key].totalCost / map[key].totalQty : 0;
    });
    return map;
  }, [filteredRecords]);

  // --- Totals & Loan Coverage ---
  const totals = filteredRecords.reduce(
    (acc, r) => {
      const amount = parseFloat(r.amount) || 0;
      let totalAmount = amount;
      if (r.category === "Inflow") {
        const quantity = parseFloat(r.quantity) || 1;
        totalAmount = amount * quantity;
        let costPerUnit = parseFloat(r.cost_per_unit) || 0;
        if (!costPerUnit && r.description && inventoryCostMap[r.description]) {
          costPerUnit = inventoryCostMap[r.description];
        }
        const cost = costPerUnit * quantity;
        acc.inflow += totalAmount;
        acc.inflowCost += cost;
        acc.inflowProfit += totalAmount - cost;
      } else {
        if (r.category === "Outflow") acc.outflow += totalAmount;
        if (r.category === "Reinvestment") acc.reinvestment += totalAmount;
        if (r.category === "Overhead") acc.overhead += totalAmount;
        if (r.category === "Loan Payment") acc.loanPayment += totalAmount;
        if (r.category === "Loan Received") acc.loanReceived += totalAmount;
        if (r.category === "Logistics") acc.logistics += totalAmount;
        if (r.category === "Refund") acc.refund += totalAmount;
      }
      return acc;
    },
    {
      inflow: 0,
      inflowCost: 0,
      inflowProfit: 0,
      outflow: 0,
      reinvestment: 0,
      overhead: 0,
      loanPayment: 0,
      loanReceived: 0,
      logistics: 0, // ← new
      refund: 0, // ← new
    }
  );

  const grossProfit = totals.inflow - totals.outflow;
  const trueGrossMargin =
    totals.inflow > 0 ? (totals.inflowProfit / totals.inflow) * 100 : 0;
  const operatingProfit = grossProfit - totals.overhead - totals.reinvestment;
  const netLoanImpact = totals.loanReceived - totals.loanPayment;
  // Example: Net Profit should subtract logistics & refunds
  const netProfit =
    operatingProfit + netLoanImpact - totals.logistics - totals.refund;

  // ✅ Loan Coverage Logic (Rolling 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const rollingInflow =  records.filter(
      (r) =>
        r.category === "Inflow" &&
        new Date(r.date) >= thirtyDaysAgo &&
        new Date(r.date) <= today
    )
    .reduce(
      (sum, r) => sum + parseFloat(r.amount) * (parseFloat(r.quantity) || 1),
      0
    );
  const loanCoveragePercent =
    monthlyLoanTarget > 0 ? (rollingInflow / monthlyLoanTarget) * 100 : 0;
  const loanStatus = loanCoveragePercent >= 100 ? "On Track" : "At Risk";

  // --- Customer Concentration for Strategic Scoring ---
  const customerRevenueMap = useMemo(() => {
    const map = {};
    filteredRecords.forEach((r) => {
      if (r.category === "Inflow" && r.customer) {
        const rev = (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1);
        map[r.customer] = (map[r.customer] || 0) + rev;
      }
    });
    return map;
  }, [filteredRecords]);

  const totalCustomerRevenue = Object.values(customerRevenueMap).reduce(
    (sum, rev) => sum + rev,
    0
  );
  const topCustomerShare =
    totalCustomerRevenue > 0
      ? Math.max(...Object.values(customerRevenueMap)) / totalCustomerRevenue
      : 0;

  // --- Supplier Analysis ---
  const supplierAnalysis = useMemo(() => {
    const suppliers = {};
    filteredRecords.forEach((r) => {
      if (r.supplied_by && r.category !== "Inflow") {
        const amount = parseFloat(r.amount) || 0;
        const qty = parseFloat(r.quantity) || 1;
        const totalCost = amount * qty; // 👈 critical fix

        if (!suppliers[r.supplied_by]) {
          suppliers[r.supplied_by] = { cost: 0, transactions: 0 };
        }
        suppliers[r.supplied_by].cost += totalCost;
        suppliers[r.supplied_by].transactions += 1;
      }
    });
    return Object.entries(suppliers)
      .map(([name, data]) => ({
        name,
        cost: data.cost,
        transactions: data.transactions,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredRecords]);

  // --- Strategic Scoring (Enhanced) ---
  const recordsWithStrategicScore = useMemo(() => {
    return filteredRecords
      .map((r) => {
        const baseWeight = STRATEGIC_WEIGHTS[r.category] || 0;
        let marginImpact = 0;
        let loanImpact = 0;
        let recencyBonus = 0;
        let customerPenalty = 0;
        let cashFlowImpact = 0;
        const daysOld = Math.floor(
          (new Date() - new Date(r.date)) / (1000 * 60 * 60 * 24)
        );
        recencyBonus = Math.max(0, 5 - daysOld / 30);

        if (r.category === "Refund") {
          customerPenalty = -4; // stronger penalty
          recencyBonus = -3; // recent refunds hurt more
        }
        if (r.category === "Logistics") {
          // Compare to avg logistics cost (you can compute this separately)
          const avgLogistics =
            totals.logistics /
            Math.max(
              filteredRecords.filter((rec) => rec.category === "Logistics")
                .length,
              1
            );
          const actualCost = parseFloat(r.amount) || 0;
          marginImpact = actualCost < avgLogistics ? 1 : -1; // reward efficiency
        }

        if (r.category === "Inflow") {
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
        }

        const strategicScore =
          baseWeight +
          marginImpact +
          loanImpact +
          recencyBonus +
          customerPenalty +
          cashFlowImpact;
        return { ...r, strategicScore };
      })
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateB.getTime() !== dateA.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
        return b.strategicScore - a.strategicScore;
      });
  }, [filteredRecords, inventoryCostMap, topCustomerShare]);

  // --- Business Health Index ---
  const monthlyBurn = totals.overhead + totals.outflow + totals.reinvestment;
  const cashRunwayMonths = totals.inflow > 0 ? totals.inflow / monthlyBurn : 0;
  const liquidityRatio = totals.inflow > 0 ? totals.inflow / monthlyBurn : 0;
  const refundRate =
    totals.inflow > 0 ? (totals.refund / totals.inflow) * 100 : 0;
  const maturityData = [
    { stage: "Record Keeping", score: records.length > 0 ? 40 : 0 },
    {
      stage: "Cost Tracking",
      score: (
        (filteredRecords.filter(
          (r) => r.category === "Inflow" && r.cost_per_unit
        ).length /
          Math.max(
            filteredRecords.filter((r) => r.category === "Inflow").length,
            1
          )) *
        100
      ).toFixed(0),
    },
    {
      stage: "Customer Tracking",
      score: (
        (filteredRecords.filter((r) => r.customer).length /
          Math.max(filteredRecords.length, 1)) *
        100
      ).toFixed(0),
    },
    { stage: "Budgeting", score: Object.keys(budgets).length > 0 ? 80 : 20 },
  ];
  const dataCompletenessScore = (
    (maturityData.reduce((sum, m) => sum + parseFloat(m.score), 0) / 400) *
    100
  ).toFixed(0);
  const businessHealthIndex = Math.min(
    100,
    Math.round(
      (trueGrossMargin / 50) * 25 +
        (loanCoveragePercent / 100) * 25 +
        (liquidityRatio > 1 ? 25 : liquidityRatio * 25) +
        parseFloat(dataCompletenessScore) * 0.25
    )
  );

  // --- Auto-trigger Strategy Modal if data is sparse ---
  // useEffect(() => {
  //   if (dataCompletenessScore < 60 && !showStrategyModal) {
  //     const timer = setTimeout(() => setShowStrategyModal(true), 3000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [dataCompletenessScore]);

  // --- Handle Form Submit ---
  const handleSubmit = async () => {
    if (!formData.description || !formData.amount) return;
    try {
      const recordData = {
        date: formData.date,
        payment_date: formData.paymentDate || formData.date,
        description: formData.description,
        category: formData.category,
        amount: parseFloat(formData.amount),
        cost_per_unit: formData.costPerUnit
          ? parseFloat(formData.costPerUnit)
          : null,
        quantity: formData.quantity ? parseFloat(formData.quantity) : 1,
        notes: formData.notes,
        customer: formData.customer || null,
        project: formData.project || null,
        tags: formData.tags || null,
        market_price: formData.marketPrice
          ? parseFloat(formData.marketPrice)
          : null,
        supplied_by: formData.suppliedBy || null,
      };
      if (isEditing !== null) {
        const { error } = await supabase
          .from("bookkeeping_records")
          .update(recordData)
          .eq("id", isEditing);
        if (error) throw error;
        setRecords(
          records.map((r) =>
            r.id === isEditing ? { ...recordData, id: r.id } : r
          )
        );
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
      alert("Failed to save record. Please check your Supabase configuration.");
    }
  };

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
      suppliedBy: record.supplied_by || "", // ✅ FIXED: use record.supplied_by
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
      setRecords(records.filter((r) => r.id !== recordToDelete.id));
    } catch (error) {
      console.error("Error deleting record:", error);
      alert("Failed to delete record. Please try again.");
    }
  };

  const csvInputRef = useRef(null);
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
        const mappedRecords = data
          .map((row) => {
            const parseNumber = (val) =>
              val === "" || val == null ? null : parseFloat(val);
            const parseString = (val) =>
              val === "" || val == null ? null : String(val).trim();
            // In handleCsvImport, improve category resolution:
            const categoryKey =
              Object.entries(categoryLabels).find(
                ([, label]) => label === row["Category"]
              )?.[0] ||
              (internalCategories.includes(row["Category"])
                ? row["Category"]
                : "Inflow");
            return {
              date:
                parseString(row["Date"]) ||
                new Date().toISOString().split("T")[0],
              payment_date:
                parseString(row["Payment Date"]) || parseString(row["Date"]),
              description: parseString(row["Description"]),
              category: internalCategories.includes(categoryKey)
                ? categoryKey
                : "Inflow",
              amount: parseNumber(row["Unit Price (LKR)"]),
              cost_per_unit: parseNumber(row["Cost per Unit (LKR)"]),
              quantity: parseNumber(row["Quantity"]) || 1,
              notes: parseString(row["Notes"]),
              customer: parseString(row["Customer"]),
              project: parseString(row["Project"]),
              tags: parseString(row["Tags"]),
              market_price:
                parseNumber(row["Market/Competitor Price (LKR)"]) ||
                parseNumber(row["Market Price"]),
              supplied_by: parseString(row["Supplied By"]),
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

  // --- Export to CSV ---
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
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `profit_analysis${dateRange}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
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

  // --- Reused analytics (unchanged logic but now use fixed totals) ---
  const competitiveAnalysis = useMemo(() => {
    return filteredRecords
      .filter(
        (r) =>
          r.category === "Inflow" &&
          r.market_price != null &&
          r.market_price > 0
      )
      .map((r) => {
        const qty = parseFloat(r.quantity) || 1;
        const sellingPrice = parseFloat(r.amount) || 0;
        let cost = parseFloat(r.cost_per_unit) || 0;
        if (!cost && r.description && inventoryCostMap[r.description]) {
          cost = inventoryCostMap[r.description];
        }
        const marketPrice = parseFloat(r.market_price) || sellingPrice;
        const grossProfit = (sellingPrice - cost) * qty;
        const grossMargin =
          sellingPrice > 0 ? ((sellingPrice - cost) / sellingPrice) * 100 : 0;
        const competitiveEdge =
          marketPrice > sellingPrice ? (marketPrice - sellingPrice) * qty : 0;
        const underpriced = marketPrice > sellingPrice;
        const overpriced = marketPrice < sellingPrice;
        return {
          id: r.id,
          name: r.description,
          sellingPrice,
          cost,
          marketPrice,
          quantity: qty,
          grossProfit,
          grossMargin,
          competitiveEdge,
          underpriced,
          overpriced,
          customer: r.customer,
          date: r.date,
        };
      })
      .sort((a, b) => b.competitiveEdge - a.competitiveEdge);
  }, [filteredRecords, inventoryCostMap]);

  const competitiveTotals = useMemo(() => {
    return competitiveAnalysis.reduce(
      (acc, item) => ({
        totalRevenue: acc.totalRevenue + item.sellingPrice * item.quantity,
        totalCost: acc.totalCost + item.cost * item.quantity,
        totalProfit: acc.totalProfit + item.grossProfit,
        totalCompetitiveEdge: acc.totalCompetitiveEdge + item.competitiveEdge,
        avgMargin: acc.avgMargin + item.grossMargin,
        count: acc.count + 1,
      }),
      {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        totalCompetitiveEdge: 0,
        avgMargin: 0,
        count: 0,
      }
    );
  }, [competitiveAnalysis]);

  const monthlyData = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return [];

    // Get current year-month (e.g., "2024-06")
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    const grouped = {};
    filteredRecords.forEach((r) => {
      const date = new Date(r.date);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      // 👇 Only include current month
      if (monthKey !== currentMonthKey) return;

      if (!grouped[monthKey])
        grouped[monthKey] = { revenue: 0, cost: 0, profit: 0 };

      const qty = parseFloat(r.quantity) || 1;
      const price = parseFloat(r.amount) || 0;
      let cost = parseFloat(r.cost_per_unit) || 0;
      if (!cost && r.description && inventoryCostMap[r.description]) {
        cost = inventoryCostMap[r.description];
      }
      const revenue = price * qty;
      const totalCost = cost * qty;
      const profit = revenue - totalCost;

      if (r.category === "Inflow") {
        grouped[monthKey].revenue += revenue;
        grouped[monthKey].cost += totalCost;
        grouped[monthKey].profit += profit;
      } else if (["Outflow", "Overhead", "Reinvestment"].includes(r.category)) {
        grouped[monthKey].cost += price;
        grouped[monthKey].profit -= price;
      }
    });

    return Object.entries(grouped)
      .map(([month, vals]) => ({
        month,
        revenue: vals.revenue,
        profit: vals.profit,
        margin: vals.revenue > 0 ? (vals.profit / vals.revenue) * 100 : 0,
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));
  }, [filteredRecords, inventoryCostMap]);

  const dailyData = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return [];

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const dayMap = {};
    // Initialize all days in last 30 days
    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split("T")[0]; // YYYY-MM-DD
      dayMap[key] = { date: key, revenue: 0, profit: 0, cost: 0 };
    }

    filteredRecords.forEach((r) => {
      const recordDate = r.date; // assume format YYYY-MM-DD
      if (recordDate < thirtyDaysAgo.toISOString().split("T")[0]) return;

      if (!dayMap[recordDate]) {
        dayMap[recordDate] = {
          date: recordDate,
          revenue: 0,
          profit: 0,
          cost: 0,
        };
      }

      const qty = parseFloat(r.quantity) || 1;
      const price = parseFloat(r.amount) || 0;
      let cost = parseFloat(r.cost_per_unit) || 0;
      if (!cost && r.description && inventoryCostMap[r.description]) {
        cost = inventoryCostMap[r.description];
      }
      const revenue = price * qty;
      const totalCost = cost * qty;
      const profit = revenue - totalCost;

      if (r.category === "Inflow") {
        dayMap[recordDate].revenue += revenue;
        dayMap[recordDate].profit += profit;
        dayMap[recordDate].cost += totalCost;
      } else if (["Outflow", "Overhead", "Reinvestment"].includes(r.category)) {
        dayMap[recordDate].profit -= price;
      }
    });

    return Object.values(dayMap).map((day) => ({
      ...day,
      margin: day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0,
    }));
  }, [filteredRecords, inventoryCostMap]);

  const cashFlowGaps = useMemo(() => {
    return filteredRecords
      .filter((r) => r.payment_date && r.category === "Inflow")
      .map((r) => {
        const issueDate = new Date(r.date);
        const paidDate = new Date(r.payment_date);
        const gapDays = Math.max(
          0,
          Math.ceil((paidDate - issueDate) / (1000 * 60 * 60 * 24))
        );
        return {
          id: r.id,
          description: r.description,
          amount: r.amount,
          customer: r.customer,
          gapDays,
          status: gapDays > 30 ? "Delayed" : "On Time",
        };
      });
  }, [filteredRecords]);

  const roiTimeline = useMemo(() => {
    const grouped = {};
    filteredRecords.forEach((r) => {
      if (!r.date) return;
      const month = new Date(r.date).toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      if (!grouped[month])
        grouped[month] = { month, investment: 0, return: 0, net: 0 };
      if (["Outflow", "Overhead", "Reinvestment"].includes(r.category)) {
        grouped[month].investment += parseFloat(r.amount) || 0;
        grouped[month].net -= parseFloat(r.amount) || 0;
      } else if (r.category === "Inflow") {
        const qty = parseFloat(r.quantity) || 1;
        grouped[month].return += (parseFloat(r.amount) || 0) * qty;
        grouped[month].net += (parseFloat(r.amount) || 0) * qty;
      }
    });
    return Object.values(grouped);
  }, [filteredRecords]);

  const { breakEvenMonth, paybackMonth, roiPercentage } = useMemo(() => {
    let breakEvenMonth = null;
    let paybackMonth = null;
    let totalInvestment = 0;
    let totalReturn = 0;
    let cumulativeNet = 0;
    roiTimeline.forEach((point) => {
      totalInvestment += point.investment;
      totalReturn += point.return;
      cumulativeNet += point.net;
      if (!breakEvenMonth && point.return >= point.investment) {
        breakEvenMonth = point.month;
      }
      if (!paybackMonth && cumulativeNet >= 0) {
        paybackMonth = point.month;
      }
    });
    return {
      breakEvenMonth,
      paybackMonth,
      roiPercentage:
        totalInvestment > 0
          ? (((totalReturn - totalInvestment) / totalInvestment) * 100).toFixed(
              0
            )
          : 0,
    };
  }, [roiTimeline]);

  const customerAnalysis = useMemo(() => {
    const customers = {};
    filteredRecords.forEach((r) => {
      if (r.customer && r.category === "Inflow") {
        if (!customers[r.customer]) {
          customers[r.customer] = {
            revenue: 0,
            cost: 0,
            transactions: 0,
            projects: new Set(),
            dates: [],
          };
        }
        const qty = parseFloat(r.quantity) || 1;
        customers[r.customer].revenue += parseFloat(r.amount) * qty;
        let costPerUnit = parseFloat(r.cost_per_unit) || 0;
        if (!costPerUnit && r.description && inventoryCostMap[r.description]) {
          costPerUnit = inventoryCostMap[r.description];
        }
        customers[r.customer].cost += costPerUnit * qty;
        customers[r.customer].transactions += 1;
        if (r.project) customers[r.customer].projects.add(r.project);
        customers[r.customer].dates.push(new Date(r.date));
      }
    });
    return Object.entries(customers)
      .map(([name, data]) => {
        const firstDate = new Date(
          Math.min(...data.dates.map((d) => d.getTime()))
        );
        const lastDate = new Date(
          Math.max(...data.dates.map((d) => d.getTime()))
        );
        const monthsActive =
          (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
          (lastDate.getMonth() - firstDate.getMonth()) +
          1;
const clv = (data.revenue / monthsActive) * 12 * ((data.revenue - data.cost) / data.revenue);
        return {
          name,
          revenue: data.revenue,
          cost: data.cost,
          profit: data.revenue - data.cost,
          margin:
            data.revenue > 0
              ? ((data.revenue - data.cost) / data.revenue) * 100
              : 0,
          transactions: data.transactions,
          projectCount: data.projects.size,
          avgTransaction: data.revenue / data.transactions,
          clv: clv,
        };
      })
      .sort((a, b) => b.profit - a.profit);
  }, [filteredRecords, inventoryCostMap]);

  const productMargins = useMemo(() => {
    const products = {};
    filteredRecords
      .filter((r) => r.category === "Inflow")
      .forEach((r) => {
        const key = r.description;
        if (!products[key]) {
          products[key] = {
            revenue: 0,
            cost: 0,
            quantity: 0,
            transactions: 0,
            customers: new Set(),
            dates: [],
          };
        }
        const qty = parseFloat(r.quantity) || 1;
        const revenue = parseFloat(r.amount) * qty;
        let cost = parseFloat(r.cost_per_unit) || 0;
        if (!cost && r.description && inventoryCostMap[r.description]) {
          cost = inventoryCostMap[r.description];
        }
        products[key].revenue += revenue;
        products[key].cost += cost;
        products[key].quantity += qty;
        products[key].transactions += 1;
        if (r.customer) products[key].customers.add(r.customer);
        products[key].dates.push(new Date(r.date));
      });
    return Object.entries(products)
      .map(([name, data]) => {
        const firstDate = new Date(
          Math.min(...data.dates.map((d) => d.getTime()))
        );
        const lastDate = new Date(
          Math.max(...data.dates.map((d) => d.getTime()))
        );
        const daysActive = (lastDate - firstDate) / (1000 * 60 * 60 * 24) || 1;
        const inventoryTurnover =
          daysActive > 0 ? data.quantity / (daysActive / 30) : 0;
        return {
          name,
          revenue: data.revenue,
          cost: data.cost,
          quantity: data.quantity,
          transactions: data.transactions,
          customers: data.customers.size,
          profit: data.revenue - data.cost,
          margin:
            data.revenue > 0
              ? ((data.revenue - data.cost) / data.revenue) * 100
              : 0,
          avgPrice: data.revenue / data.quantity,
          avgCost: data.cost / data.quantity,
          avgProfit: (data.revenue - data.cost) / data.quantity,
          inventoryTurnover,
        };
      })
      .sort((a, b) => b.margin - a.margin);
  }, [filteredRecords, inventoryCostMap]);

  const budgetAlerts = useMemo(() => {
    const alerts = [];
    Object.entries(budgets).forEach(([category, budgetAmount]) => {
      const spent = filteredRecords
        .filter((r) => r.category === category)
        .reduce((sum, r) => {
          if (r.category === "Inflow") {
            return (
              sum + (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1)
            );
          } else {
            return sum + (parseFloat(r.amount) || 0);
          }
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
    });
    return alerts;
  }, [filteredRecords, budgets]);

  const pricingRecommendations = useMemo(() => {
    return productMargins
      .filter((p) => p.cost > 0)
      .map((p) => {
const targetMargin = 50;
const recommendedPrice = p.avgCost / (1 - targetMargin / 100);
        const priceIncrease = recommendedPrice - p.avgPrice;
        const percentIncrease = (priceIncrease / p.avgPrice) * 100;
        return {
          product: p.name,
          currentMargin: p.margin,
          currentPrice: p.avgPrice,
          recommendedPrice,
          priceIncrease,
          percentIncrease,
          potentialRevenue: priceIncrease * p.quantity,
          needsAction: p.margin < 30,
        };
      })
      .filter((r) => r.needsAction)
      .sort((a, b) => b.potentialRevenue - a.potentialRevenue);
  }, [productMargins]);

  const businessValueData = [
    {
      metric: "Revenue",
      current: (totals.inflow / targetRevenue) * 100,
      target: 100,
    },
    { metric: "Margin", current: trueGrossMargin, target: 50 },
    {
      metric: "Cost Coverage",
      current: totals.inflow > 0 ? (totals.outflow / totals.inflow) * 100 : 0,
      target: 70,
    },
    {
      metric: "Loan Coverage",
      current: loanCoveragePercent,
      target: 100,
    },
  ];

  const implementationPhases = [
    {
      phase: "Payments & Cash Flow",
      duration: "2-4 weeks",
      icon: CreditCard,
      color: "bg-blue-500",
      value: "$25K-50K",
      tasks: [
        "Supplier Payment Tracking",
        "Cash Flow Gap Analysis",
        "Payment Terms Optimization",
        "Automated Reminders",
      ],
    },
    {
      phase: "Financial Controls",
      duration: "4-6 weeks",
      icon: Shield,
      color: "bg-green-500",
      value: "$50K-100K",
      tasks: [
        "Budget Monitoring",
        "Expense Categorization",
        "Compliance Tracking",
        "Audit Readiness",
      ],
    },
    {
      phase: "Reinvestment Strategy",
      duration: "6-8 weeks",
      icon: Recycle,
      color: "bg-purple-500",
      value: "$150K-300K",
      tasks: [
        "ROI Tracking by Initiative",
        "Growth Spend Allocation",
        "Performance Benchmarking",
        "Reinvestment Dashboard",
      ],
    },
    {
      phase: "AI-Powered Forecasting",
      duration: "Ongoing",
      icon: Brain,
      color: "bg-orange-500",
      value: "$500K+",
      tasks: [
        "Cash Flow Prediction",
        "Dynamic Pricing",
        "Customer Lifetime Value",
        "Scenario Planning",
      ],
    },
  ];

  const groupedRecords = useMemo(() => {
    if (groupBy === "none") return [];
    const groups = {};
    recordsWithStrategicScore.forEach((r) => {
      let key = "-";
      if (groupBy === "customer") key = r.customer || "-";
      else if (groupBy === "product") key = r.description || "-";
      else if (groupBy === "supplier") key = r.supplied_by || "-";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.entries(groups).map(([group, items]) => ({ group, items }));
  }, [recordsWithStrategicScore, groupBy]);

  // --- Cash Flow Forecast (30-day) ---
  const forecastDays = 30;
  const avgDailyInflow = rollingInflow / 30;
  const outflowCategories = [
    "Outflow",
    "Overhead",
    "Reinvestment",
    "Loan Payment",
    "Logistics",
    "Refund",
  ];
  const recentOutflow = filteredRecords
    .filter(
      (r) =>
        outflowCategories.includes(r.category) &&
        new Date(r.date) >= thirtyDaysAgo &&
        new Date(r.date) <= today
    )
    .reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const avgDailyOutflow = recentOutflow / 30;
  // Compute 30-day net cash position (inflow - all outflows)
  // Forecast shows CUMULATIVE NET CASH FLOW over next 30 days (starting from 0)
  const projectedCash = Array.from({ length: forecastDays }, (_, i) => {
    const date = new Date();
    date.setDate(today.getDate() + i + 1);
    const isoDate = date.toISOString().split("T")[0];
    const net = (avgDailyInflow - avgDailyOutflow) * (i + 1);
    return { date: isoDate, net };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            Loading your financial data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Brain className="w-8 h-8" />
                SME Profit Intelligence Platform
              </h1>
              <p className="text-blue-100">
                Payments → Cash Flow → Financial Controls → Reinvestment
              </p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 text-sm">
                  <Percent className="w-4 h-4" />
                  <span>True Margin: {trueGrossMargin.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <DollarSign className="w-4 h-4" />
                  <span>Loan Coverage: {loanCoveragePercent.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Database className="w-4 h-4" />
                  <span>{records.length} transactions</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <HeartPulse className="w-4 h-4" />
                  <span>Health: {businessHealthIndex}/100</span>
                </div>
                <button
                  onClick={syncRecords}
                  disabled={syncing}
                  className="flex items-center gap-1 text-sm bg-blue-500 px-2 py-1 rounded hover:bg-blue-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`}
                  />
                  {syncing ? "Syncing..." : "Sync"}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTargetModal(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-400 transition-colors font-semibold shadow-md"
              >
                <Target className="w-4 h-4" />
                Target
              </button>
              <button
                onClick={() => setShowLoanModal(true)}
                className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-md hover:bg-indigo-400 transition-colors font-semibold shadow-md"
              >
                <DollarSign className="w-4 h-4" />
                Loan Plan
              </button>
              <button
                onClick={() => setShowBudgetModal(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-400 transition-colors font-semibold shadow-md"
              >
                <Bell className="w-4 h-4" />
                Budgets
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
                className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-md hover:bg-blue-50 transition-colors font-semibold shadow-md"
              >
                <ArrowUp className="w-4 h-4" />
                Import
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-md hover:bg-blue-50 transition-colors font-semibold shadow-md"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Loan Health Alert with Trend */}
        <div className="mb-6">
          <div
            className={`p-4 rounded-lg flex items-center gap-3 ${
              loanStatus === "On Track"
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <DollarSign
              className={`w-6 h-6 ${
                loanStatus === "On Track" ? "text-green-600" : "text-red-600"
              }`}
            />
            <div>
              <h3 className="font-semibold">
                {loanStatus === "On Track"
                  ? "✅ Loan Coverage On Track"
                  : "⚠️ Loan Coverage At Risk"}
              </h3>
              <p className="text-sm">
                Rolling 30-day inflow: LKR {formatLKR(rollingInflow)} / LKR{" "}
                {formatLKR(monthlyLoanTarget)} ({loanCoveragePercent.toFixed(1)}
                %)
              </p>
            </div>
          </div>
        </div>

        {/* Strategic Alerts */}
        {(budgetAlerts.length > 0 || pricingRecommendations.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {budgetAlerts.length > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-900 mb-2">
                      Budget Alerts
                    </h3>
                    <div className="space-y-2">
                      {budgetAlerts.slice(0, 2).map((alert, idx) => (
                        <div key={idx} className="text-sm text-yellow-800">
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
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 mb-2">
                      Pricing Opportunities
                    </h3>
                    <div className="space-y-2">
                      {pricingRecommendations.slice(0, 2).map((rec, idx) => (
                        <div key={idx} className="text-sm text-orange-800">
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
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
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
                  className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-600" />
            <input
              type="date"
              value={dateFilter.start}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, start: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-600">to</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, end: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={clearDateFilter}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setQuickFilter(30)}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                30D
              </button>
              <button
                onClick={() => setQuickFilter(90)}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                90D
              </button>
              <button
                onClick={() => setQuickFilter(180)}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                6M
              </button>
              <button
                onClick={() => setQuickFilter(365)}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                1Y
              </button>
            </div>
          </div>
        </div>

        {/* Business Health Tab */}
        {activeTab === "health" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <HeartPulse className="w-7 h-7" />
                Business Health Dashboard
              </h2>
              <p className="text-rose-100">
                Monitor your financial stability and operational resilience
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg shadow-md p-5 text-center">
                <h3 className="text-sm text-gray-600 mb-1">Health Index</h3>
                <p
                  className={`text-2xl font-bold ${
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
              <div className="bg-white rounded-lg shadow-md p-5 text-center">
                <h3 className="text-sm text-gray-600 mb-1">Cash Runway</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {cashRunwayMonths > 0 ? cashRunwayMonths.toFixed(1) : "∞"}{" "}
                  months
                </p>
                <p className="text-black text-gray-500 mt-1">
                  At current burn rate
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-5 text-center">
                <h3 className="text-sm text-gray-600 mb-1">Burn Rate</h3>
                <p className="text-2xl font-bold text-red-600">
                  LKR {formatLKR(monthlyBurn)}
                </p>
                <p className="text-black text-gray-500 mt-1">
                  Monthly expenses
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-5 text-center">
                <h3 className="text-sm text-gray-600 mb-1">Liquidity Ratio</h3>
                <p className="text-2xl font-bold text-green-600">
                  {liquidityRatio > 0 ? liquidityRatio.toFixed(2) : "0"}x
                </p>
                <p className="text-black text-gray-500 mt-1">
                  Revenue vs monthly burn
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-5 text-center">
                <h3 className="text-sm text-gray-600 mb-1">Data Quality</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {dataCompletenessScore}%
                </p>
                <p className="text-black text-gray-500 mt-1">
                  Bookkeeping completeness
                </p>
              </div>
            </div>

            {/* AI Insights Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
              <h3 className="font-bold text-lg mb-3 text-blue-900">
                🧠 AI-Powered Business Summary
              </h3>
              <p className="text-blue-800">
                {businessHealthIndex >= 80
                  ? "Your business is in excellent health! Focus on scaling and reinvestment."
                  : businessHealthIndex >= 60
                  ? "Good foundation—optimize margins and diversify customers."
                  : "⚠️ Action needed: improve cash flow, reduce dependency, and enhance data tracking."}
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
              <h3 className="font-bold text-lg mb-3 text-blue-900">
                Strategic Recommendations
              </h3>
              <ul className="space-y-2 text-blue-800">
                {cashRunwayMonths < 3 && (
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Urgent:</strong> Cash runway under 3 months. Focus
                      on accelerating collections and reducing non-essential
                      spend.
                    </span>
                  </li>
                )}
                {trueGrossMargin < 30 && (
                  <li className="flex items-start gap-2">
                    <Percent className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Margin Alert:</strong> Gross margin below 30%.
                      Review pricing and cost structure immediately.
                    </span>
                  </li>
                )}
                {topCustomerShare > 0.5 && (
                  <li className="flex items-start gap-2">
                    <Users className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Risk:</strong> Over{" "}
                      {Math.round(topCustomerShare * 100)}% revenue from one
                      customer. Diversify your client base.
                    </span>
                  </li>
                )}
                {dataCompletenessScore < 70 && (
                  <li className="flex items-start gap-2">
                    <Database className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Improve Data:</strong> Add cost, customer, and
                      supplier details to unlock deeper insights.
                    </span>
                  </li>
                )}
              </ul>
            </div>
            {/* Strategic Alert - Cash Flow Delay Risk */}
            {cashFlowGaps.length > 0 &&
              cashFlowGaps.filter((g) => g.status === "Delayed").length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900 mb-2">
                        Cash Flow Delay Risk
                      </h3>
                      <p className="text-sm text-red-800">
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

            {/* Payment Timing Risk Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Customer Payment Timing Risk
              </h3>
              {cashFlowGaps.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Total Invoices Tracked
                      </p>
                      <p className="text-xl font-bold text-amber-700">
                        {cashFlowGaps.length}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Delayed Payments ({">"}30d)
                      </p>
                      <p className="text-xl font-bold text-red-600">
                        {
                          cashFlowGaps.filter((g) => g.status === "Delayed")
                            .length
                        }
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Avg Delay (All)</p>
                      <p className="text-xl font-bold text-blue-600">
                        {(
                          cashFlowGaps.reduce((sum, g) => sum + g.gapDays, 0) /
                          cashFlowGaps.length
                        ).toFixed(1)}{" "}
                        days
                      </p>
                    </div>
                  </div>

                  <h4 className="font-semibold mb-3">Top Delayed Customers</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Customer</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-right">Amount (LKR)</th>
                          <th className="px-3 py-2 text-right">Delay (Days)</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {cashFlowGaps
                          .filter((g) => g.status === "Delayed")
                          .sort((a, b) => b.gapDays - a.gapDays)
                          .slice(0, 5)
                          .map((gap) => (
                            <tr key={gap.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">
                                {gap.customer || "—"}{" "}
                              </td>
                              <td className="px-3 py-2">{gap.description}</td>
                              <td className="px-3 py-2 text-right">
                                LKR {formatLKR(gap.amount)}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-red-600">
                                {gap.gapDays}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
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
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p>No payment date data available.</p>
                  <p className="text-sm mt-1">
                    Add <strong>Payment Date</strong> to your Inflow records to
                    track cash flow timing.
                  </p>
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Revenue & Profit Trends (Last 30 Days)
              </h3>
              {dailyData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
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
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Avg Daily Revenue</p>
                      <p className="text-xl font-bold text-green-600">
                        LKR{" "}
                        {formatLKR(
                          dailyData.reduce((sum, d) => sum + d.revenue, 0) /
                            dailyData.length
                        )}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Avg Daily Profit</p>
                      <p className="text-xl font-bold text-blue-600">
                        LKR{" "}
                        {formatLKR(
                          dailyData.reduce((sum, d) => sum + d.profit, 0) /
                            dailyData.length
                        )}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600">Avg Margin</p>
                      <p className="text-xl font-bold text-purple-600">
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
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Add records from the last 30 days to see trends</p>
                </div>
              )}
            </div>

            {/* Cash Flow Forecast Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-lg mb-4">
                30-Day Cash Flow Forecast
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={projectedCash}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
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

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <TrendingUp className="w-8 h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-black">
                    Revenue
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">
                  LKR {formatLKR(totals.inflow)}
                </h3>
                <p className="text-sm opacity-90">Total Inflow</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <ShoppingCart className="w-8 h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-black">
                    COGS
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">
                  LKR {formatLKR(totals.inflowCost)}
                </h3>
                <p className="text-sm opacity-90">Cost of Goods Sold</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <Award className="w-8 h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-black">
                    {trueGrossMargin.toFixed(1)}%
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">
                  LKR {formatLKR(totals.inflowProfit)}
                </h3>
                <p className="text-sm opacity-90">Gross Profit (True)</p>
              </div>
              <div
                className={`bg-gradient-to-br ${
                  netProfit >= 0
                    ? "from-purple-500 to-purple-600"
                    : "from-orange-500 to-orange-600"
                } text-white rounded-lg shadow-lg p-5`}
              >
                <div className="flex justify-between items-start mb-2">
                  <DollarSign className="w-8 h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-black">
                    Net
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">
                  LKR {formatLKR(netProfit)}
                </h3>
                <p className="text-sm opacity-90">Net Profit</p>
              </div>
              <div
                className={`bg-gradient-to-br ${
                  loanStatus === "On Track"
                    ? "from-green-500 to-teal-600"
                    : "from-red-500 to-orange-600"
                } text-white rounded-lg shadow-lg p-5`}
              >
                <div className="flex justify-between items-start mb-2">
                  <DollarSign className="w-8 h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-black">
                    {loanCoveragePercent.toFixed(0)}%
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">Loan Health</h3>
                <p className="text-sm opacity-90">{loanStatus}</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <HeartPulse className="w-8 h-8 opacity-80" />
                  <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded text-black">
                    Health
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">
                  {businessHealthIndex}
                </h3>
                <p className="text-sm opacity-90">Business Health Index</p>
              </div>
            </div>

            {/* Entry Form */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {isEditing !== null ? "Edit Record" : "Add New Record"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  placeholder="Payment Date (optional)"
                  value={formData.paymentDate}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentDate: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description *"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Quantity (default: 1)"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Supplied By (optional)"
                  value={formData.suppliedBy}
                  onChange={(e) =>
                    setFormData({ ...formData, suppliedBy: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selling Price per Unit (LKR) *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 100"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Market/Competitor Price (LKR) - for competitive analysis
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 120"
                    value={formData.marketPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, marketPrice: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost per Unit (LKR){" "}
                    {formData.category === "Inflow" && "- for margin tracking"}
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 60"
                    value={formData.costPerUnit}
                    onChange={(e) =>
                      setFormData({ ...formData, costPerUnit: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {/* Profit Preview */}
              {formData.quantity &&
                formData.amount &&
                formData.costPerUnit &&
                formData.category === "Inflow" && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 font-medium">
                          Total Revenue
                        </p>
                        <p className="text-lg font-bold text-green-600">
                          LKR{" "}
                          {formatLKR(
                            parseFloat(formData.quantity) *
                              parseFloat(formData.amount)
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Total Cost</p>
                        <p className="text-lg font-bold text-red-600">
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
                        <p className="text-lg font-bold text-blue-600">
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
                        <p className="text-lg font-bold text-purple-600">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Customer (optional)"
                  value={formData.customer}
                  onChange={(e) =>
                    setFormData({ ...formData, customer: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Project (optional)"
                  value={formData.project}
                  onChange={(e) =>
                    setFormData({ ...formData, project: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Tags (comma-separated)"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                rows="2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold"
                >
                  {isEditing !== null ? "Update" : "Add Record"}
                </button>
                {isEditing !== null && (
                  <button
                    onClick={handleCancel}
                    className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Recent Records Preview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Category
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Margin
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
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
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.date}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {record.description}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-black rounded-full ${
                                record.category === "Inflow"
                                  ? "bg-green-100 text-green-800"
                                  : record.category === "Outflow"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {record.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {qty}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            LKR {formatLKR(price)}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm text-right font-semibold ${
                              record.category === "Inflow"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {record.category === "Inflow" ? "+" : "−"} LKR{" "}
                            {formatLKR(total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
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
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                handleEdit(
                                  recordsWithStrategicScore.findIndex(
                                    (r) => r.id === record.id
                                  )
                                )
                              }
                              className="text-blue-600 hover:text-blue-800 mx-1"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(
                                  recordsWithStrategicScore.findIndex(
                                    (r) => r.id === record.id
                                  )
                                )
                              }
                              className="text-red-600 hover:text-red-800 mx-1"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* Suppliers Tab */}
        {activeTab === "suppliers" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Factory className="w-7 h-7" />
                Supplier Cost Analysis
              </h2>
              <p className="text-amber-100">
                Track spending by supplier to optimize procurement
              </p>
            </div>
            {supplierAnalysis.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <Factory className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <p className="text-yellow-800">
                  No supplier data available. Add “Supplied By” to your records
                  to see analysis.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                          Supplier
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Total Cost
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Transactions
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          % of COGS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {supplierAnalysis.map((supplier, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {supplier.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                            LKR {formatLKR(supplier.cost)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {supplier.transactions}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">
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

        {/* All Records Tab with Strategic Ranking */}
        {activeTab === "records" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Complete Transaction History (Strategically Ranked)
              </h2>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                        Supplied By
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Cost/Unit
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Profit
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                        Margin
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
                        Strategic Rank
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
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
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.date}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {record.description}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-black rounded-full ${
                                record.category === "Inflow"
                                  ? "bg-green-100 text-green-800"
                                  : record.category === "Outflow"
                                  ? "bg-red-100 text-red-800"
                                  : record.category === "Reinvestment"
                                  ? "bg-blue-100 text-blue-800"
                                  : record.category === "Overhead"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {record.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.customer || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.supplied_by || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {qty}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            LKR {formatLKR(price)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {cost > 0 ? `LKR ${formatLKR(cost)}` : "-"}
                          </td>
                          <td
                            className={`px-4 py-3 text-sm text-right font-semibold ${
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
                          <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                            {record.category === "Inflow" && cost > 0
                              ? `LKR ${formatLKR(profit)}`
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
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
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-black rounded-full font-medium">
                              #{index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleEdit(index)}
                              className="text-blue-600 hover:text-blue-800 mx-1"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(index)}
                              className="text-red-600 hover:text-red-800 mx-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-6">
                  {groupedRecords.map(({ group, items }) => (
                    <div key={group} className="border rounded-lg p-4">
                      <h3 className="font-bold text-lg mb-3">{group}</h3>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-right">Total</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((record, idx) => {
                            const total =
                              (parseFloat(record.amount) || 0) *
                              (parseFloat(record.quantity) || 1);
                            return (
                              <tr key={record.id} className="border-b">
                                <td className="px-3 py-2">{record.date}</td>
                                <td className="px-3 py-2">
                                  {record.description}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  LKR {formatLKR(total)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() =>
                                      handleEdit(
                                        recordsWithStrategicScore.findIndex(
                                          (r) => r.id === record.id
                                        )
                                      )
                                    }
                                    className="text-blue-600 hover:text-blue-800 mx-1"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDelete(
                                        recordsWithStrategicScore.findIndex(
                                          (r) => r.id === record.id
                                        )
                                      )
                                    }
                                    className="text-red-600 hover:text-red-800 mx-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
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

        {/* Other tabs remain with minor enhancements */}
        {activeTab === "margins" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Percent className="w-7 h-7" />
                Profit Margin Intelligence
              </h2>
              <p className="text-purple-100">
                Deep dive into your product/service profitability
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm text-gray-600 mb-2">Average Margin</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {trueGrossMargin.toFixed(1)}%
                </p>
                <p className="text-black text-gray-500 mt-1">
                  Across all products
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm text-gray-600 mb-2">Total Markup</h3>
                <p className="text-3xl font-bold text-green-600">
                  LKR {formatLKR(totals.inflowProfit)}
                </p>
                <p className="text-black text-gray-500 mt-1">
                  Gross profit from sales
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm text-gray-600 mb-2">COGS</h3>
                <p className="text-3xl font-bold text-red-600">
                  LKR {formatLKR(totals.inflowCost)}
                </p>
                <p className="text-black text-gray-500 mt-1">
                  Cost of goods sold
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm text-gray-600 mb-2">Markup Ratio</h3>
                <p className="text-3xl font-bold text-purple-600">
                  {totals.inflowCost > 0
                    ? (totals.inflowProfit / totals.inflowCost).toFixed(2)
                    : "0"}
                  x
                </p>
                <p className="text-black text-gray-500 mt-1">
                  Profit per cost LKR
                </p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">
                    Margin Health Check
                  </h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    {trueGrossMargin >= 50 && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>
                          Excellent margins - you have strong pricing power
                        </span>
                      </div>
                    )}
                    {trueGrossMargin >= 30 && trueGrossMargin < 50 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>
                          Good margins - consider testing price increases on
                          high-demand items
                        </span>
                      </div>
                    )}
                    {trueGrossMargin < 30 && trueGrossMargin > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
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
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Package className="w-7 h-7" />
                Product/Service Performance
              </h2>
              <p className="text-teal-100">
                Identify your profit champions and underperformers
              </p>
            </div>
            {productMargins.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <Package className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <p className="text-yellow-800">
                  No product data available. Add cost tracking to your inflow
                  records to see detailed analysis.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                          Product/Service
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Qty Sold
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Avg Price
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Avg Cost
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Unit Profit
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Total Profit
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Margin %
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Customers
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                          Turnover
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {productMargins.map((product, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {product.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {product.quantity.toFixed(0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            LKR {formatLKR(product.avgPrice)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            LKR {formatLKR(product.avgCost)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                            LKR {formatLKR(product.avgProfit)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                            LKR {formatLKR(product.profit)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
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
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {product.customers}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
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
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Users className="w-7 h-7" />
                Customer Profitability Analysis
              </h2>
              <p className="text-indigo-100">
                Understand which customers drive the most profit
              </p>
            </div>
            {customerAnalysis.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <Users className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <p className="text-yellow-800">
                  No customer data available. Add customer names to your inflow
                  records to see analysis.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                            Customer
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Revenue
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Cost
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Profit
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Margin
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Transactions
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Avg Order
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            CLV
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {customerAnalysis.map((customer, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {customer.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                              LKR {formatLKR(customer.revenue)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                              LKR {formatLKR(customer.cost)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                              LKR {formatLKR(customer.profit)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
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
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              {customer.transactions}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              LKR {formatLKR(customer.avgTransaction)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-purple-600">
                              LKR {formatLKR(customer.clv)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="font-bold text-lg mb-4">
                    Customer Concentration Risk
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={customerAnalysis.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
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
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-7 h-7" />
                AI-Powered Pricing Intelligence
              </h2>
              <p className="text-orange-100">
                Data-driven recommendations to optimize your margins
              </p>
            </div>
            {pricingRecommendations.length === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-green-800 font-semibold">
                  All products have healthy margins (30%+)
                </p>
                <p className="text-green-700 text-sm mt-2">
                  Continue monitoring and consider testing premium pricing on
                  best sellers
                </p>
              </div>
            ) : (
              <>
                <div className="bg-orange-50 border-l-4 border-orange-500 p-5 rounded-r-lg">
                  <div className="flex items-start gap-3">
                    <Zap className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-orange-900 mb-2">
                        Quick Win Opportunities
                      </h3>
                      <p className="text-sm text-orange-800 mb-3">
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
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                            Product/Service
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Current Margin
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Current Price
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Recommended Price
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Increase
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                            Potential Revenue
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">
                            Priority
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pricingRecommendations.map((rec, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {rec.product}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className="text-red-600 font-bold">
                                {rec.currentMargin.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600">
                              LKR {formatLKR(rec.currentPrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                              LKR {formatLKR(rec.recommendedPrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className="text-orange-600 font-bold">
                                +{rec.percentIncrease.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                              +LKR {formatLKR(rec.potentialRevenue)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`px-3 py-1 text-black font-semibold rounded-full ${
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-2">
                        Implementation Strategy
                      </h3>
                      <ul className="space-y-2 text-sm text-blue-800">
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Test incrementally:</strong> Start with
                            10-15% increases to gauge customer response
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Bundle strategically:</strong> Combine
                            low-margin items with high-margin services
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Value communication:</strong> Ensure pricing
                            reflects the quality and outcomes you deliver
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
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
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-lg shadow-lg p-6">
              {/* Strategic Opportunity Summary */}
              <div className="bg-gradient-to-br from-rose-50 to-red-100 border-2 border-red-300 rounded-lg p-5">
                <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Top Strategic Risks & Opportunities
                </h3>
                <ul className="space-y-2 text-sm text-red-800">
                  {recordsWithStrategicScore
                    .filter((r) => r.strategicScore < 0)
                    .sort((a, b) => a.strategicScore - b.strategicScore)
                    .slice(0, 3)
                    .map((r, idx) => (
                      <li key={r.id} className="flex items-start gap-2">
                        <span className="font-mono bg-red-200 text-red-900 px-2 py-0.5 rounded">
                          {r.strategicScore.toFixed(1)}
                        </span>
                        <span>
                          <strong>{r.description}</strong> ({r.category}) on{" "}
                          {r.date} —
                          {r.category === "Refund"
                            ? " High customer dissatisfaction risk"
                            : r.category === "Logistics"
                            ? " Above-average logistics cost"
                            : "Low strategic impact"}
                        </span>
                      </li>
                    ))}
                  {recordsWithStrategicScore.filter((r) => r.strategicScore < 0)
                    .length === 0 && (
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      No high-risk transactions detected in the selected period.
                    </li>
                  )}
                </ul>
              </div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <TrendingUp className="w-7 h-7" />
                Strategic Business Analytics
              </h2>
              <p className="text-purple-100">
                Enterprise-grade insights for data-driven decision making
              </p>
            </div>
            {/* Business Health Score */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" />
                Business Performance Scorecard
              </h3>
              <ResponsiveContainer width="100%" height={300}>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {businessValueData.map((item, idx) => (
                  <div key={idx} className="text-center">
                    <p className="text-sm text-gray-600">{item.metric}</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {Number(item.current).toFixed(0)}%
                    </p>
                    <p className="text-black text-gray-500">
                      Target: {item.target}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {/* ROI Projection Timeline */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Investment ROI Timeline
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={roiTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
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
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Break-even projection:</strong>{" "}
                  {breakEvenMonth || "N/A"} |{" "}
                  <strong className="ml-3">12-month ROI:</strong>{" "}
                  {roiPercentage}% |{" "}
                  <strong className="ml-3">Payback period:</strong>{" "}
                  {paybackMonth || "N/A"}
                </p>
              </div>
            </div>
            {/* Analytics Maturity Model */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Analytics Maturity Assessment
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maturityData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="stage" type="category" width={100} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="score" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {maturityData.map((stage, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="font-medium text-gray-700">
                      {stage.stage}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-48 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${stage.score}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-gray-600 w-12 text-right">
                        {stage.score}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Monthly Trend Analysis */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Revenue & Profit Trends (This Month)
              </h3>
              {monthlyData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
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
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Avg Monthly Revenue
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        LKR{" "}
                        {formatLKR(
                          monthlyData.reduce((sum, m) => sum + m.revenue, 0) /
                            monthlyData.length
                        )}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Avg Monthly Profit
                      </p>
                      <p className="text-xl font-bold text-blue-600">
                        LKR{" "}
                        {formatLKR(
                          monthlyData.reduce((sum, m) => sum + m.profit, 0) /
                            monthlyData.length
                        )}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600">Avg Margin</p>
                      <p className="text-xl font-bold text-purple-600">
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
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Add more records with dates to see monthly trends</p>
                </div>
              )}
            </div>
            {/* Key Insights Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <Target className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-blue-900 mb-2">
                      Current Performance
                    </h3>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Records tracked:</strong> {records.length}{" "}
                          transactions
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
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
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Customer tracking:</strong>{" "}
                          {customerAnalysis.length} unique customers identified
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-purple-900 mb-2">
                      Next Steps to Improve
                    </h3>
                    <ul className="space-y-2 text-sm text-purple-800">
                      {filteredRecords.filter(
                        (r) => r.category === "Inflow" && !r.cost_per_unit
                      ).length > 0 && (
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
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
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Add customer names to{" "}
                            {filteredRecords.filter((r) => !r.customer).length}{" "}
                            records for customer profitability tracking
                          </span>
                        </li>
                      )}
                      {filteredRecords.filter((r) => !r.supplied_by).length >
                        0 && (
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
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
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Set budgets for expense categories to enable budget
                            monitoring and alerts
                          </span>
                        </li>
                      )}
                      {records.length < 50 && (
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Add more transaction history for better trend
                            analysis and insights
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
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Target className="w-7 h-7" />
                Competitive Positioning Intelligence
              </h2>
              <p className="text-indigo-100">
                Understand your pricing power vs market rates and competitors
              </p>
            </div>
            {competitiveAnalysis.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <p className="text-yellow-800 font-semibold mb-2">
                  No competitive data available yet
                </p>
                <p className="text-yellow-700 text-sm">
                  Add market pricing data to your inflow records to unlock
                  competitive analysis and see where you can capture more value.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-5">
                    <div className="flex justify-between items-start mb-2">
                      <TrendingUp className="w-8 h-8 opacity-80" />
                      <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded">
                        Tracked
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">
                      {competitiveAnalysis.length}
                    </h3>
                    <p className="text-sm opacity-90">
                      Products with Market Data
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-5">
                    <div className="flex justify-between items-start mb-2">
                      <Zap className="w-8 h-8 opacity-80" />
                      <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded">
                        Opportunity
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">
                      LKR {formatLKR(competitiveTotals.totalCompetitiveEdge)}
                    </h3>
                    <p className="text-sm opacity-90">
                      Potential Revenue Upside
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-5">
                    <div className="flex justify-between items-start mb-2">
                      <Percent className="w-8 h-8 opacity-80" />
                      <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded">
                        Margin
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">
                      {competitiveTotals.count > 0
                        ? (
                            competitiveTotals.avgMargin /
                            competitiveTotals.count
                          ).toFixed(1)
                        : "0"}
                      %
                    </h3>
                    <p className="text-sm opacity-90">Avg Competitive Margin</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-5">
                    <div className="flex justify-between items-start mb-2">
                      <Calculator className="w-8 h-8 opacity-80" />
                      <span className="text-black bg-white bg-opacity-20 px-2 py-1 rounded">
                        Position
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">
                      {competitiveAnalysis.filter((a) => a.underpriced).length}
                    </h3>
                    <p className="text-sm opacity-90">Underpriced Products</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Competitive Positioning by Product
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={competitiveAnalysis.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
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
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="font-bold text-lg mb-4">
                    Detailed Competitive Analysis
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">
                            Product
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-600">
                            Your Price
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-600">
                            Market Price
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-600">
                            Price Position
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-600">
                            Margin %
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-600">
                            Competitive Edge
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {competitiveAnalysis.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 font-medium">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-right">
                              LKR {formatLKR(item.sellingPrice)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              LKR {formatLKR(item.marketPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {(
                                (item.sellingPrice / item.marketPrice) *
                                100
                              ).toFixed(0)}
                              %
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                              {item.grossMargin.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-purple-600">
                              LKR {formatLKR(item.competitiveEdge)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {item.underpriced && (
                                <span className="px-3 py-1 text-black font-semibold bg-green-100 text-green-800 rounded-full">
                                  UNDERPRICED ⬆️
                                </span>
                              )}
                              {item.overpriced && (
                                <span className="px-3 py-1 text-black font-semibold bg-orange-100 text-orange-800 rounded-full">
                                  PREMIUM 💎
                                </span>
                              )}
                              {!item.underpriced && !item.overpriced && (
                                <span className="px-3 py-1 text-black font-semibold bg-blue-100 text-blue-800 rounded-full">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {competitiveAnalysis.filter((a) => a.underpriced).length >
                    0 && (
                    <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-5">
                      <div className="flex items-start gap-3">
                        <Zap className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                        <div>
                          <h3 className="font-bold text-green-900 mb-2">
                            Quick Win Opportunities
                          </h3>
                          <div className="space-y-2 text-sm text-green-800">
                            {competitiveAnalysis
                              .filter((a) => a.underpriced)
                              .slice(0, 3)
                              .map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2"
                                >
                                  <ArrowRight className="w-4 h-4 flex-shrink-0 mt-0.5" />
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
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-5">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-bold text-blue-900 mb-2">
                          Competitive Positioning Guide
                        </h3>
                        <ul className="space-y-2 text-sm text-blue-800">
                          <li className="flex items-start gap-2">
                            <span className="font-bold">UNDERPRICED ⬆️:</span>
                            You're below market. Test gradual price increases to
                            capture more value without losing customers.
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold">PREMIUM 💎:</span>
                            You're above market but profitable. Emphasize unique
                            value and quality to justify premium pricing.
                          </li>
                          <li className="flex items-start gap-2">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Set Revenue Target</h3>
              <input
                type="number"
                value={targetRevenue}
                onChange={(e) =>
                  setTargetRevenue(parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                placeholder="Enter target revenue (LKR)"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTargetModal(false)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowTargetModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showLoanModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">
                Set Monthly Loan Target
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                This is the minimum monthly inflow needed to comfortably cover
                your loan payments.
              </p>
              <input
                type="number"
                value={monthlyLoanTarget}
                onChange={(e) =>
                  setMonthlyLoanTarget(parseFloat(e.target.value) || 0)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                placeholder="Enter monthly loan target (LKR)"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveLoanTarget}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showBudgetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Set Category Budget</h3>
              <select
                value={budgetCategory}
                onChange={(e) => setBudgetCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
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
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                placeholder="Enter budget amount (LKR)"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveBudget}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save Budget
                </button>
                <button
                  onClick={() => {
                    setShowBudgetModal(false);
                    setBudgetAmount("");
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showStrategyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg p-6 max-w-6xl w-full my-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <Layers className="w-7 h-7 text-purple-600" />
                    Strategic Implementation Roadmap
                  </h3>
                  <p className="text-gray-600">
                    Transform your business with data-driven sales analytics
                  </p>
                </div>
                <button
                  onClick={() => setShowStrategyModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              {/* Implementation Phases */}
              <div className="space-y-6">
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
                        className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`${phase.color} p-3 rounded-lg text-white`}
                          >
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-lg text-gray-900">
                              Phase {idx + 1}: {phase.phase}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {phase.duration} • Expected Value: {phase.value}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-black font-semibold px-3 py-1 rounded-full ${
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
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="p-5 bg-gray-50 border-t-2 border-gray-200">
                          <h5 className="font-semibold mb-3">
                            Key Deliverables:
                          </h5>
                          <ul className="space-y-2">
                            {phase.tasks.map((task, taskIdx) => (
                              <li
                                key={taskIdx}
                                className="flex items-start gap-3"
                              >
                                <div className="mt-1">
                                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="w-3 h-3 text-green-600" />
                                  </div>
                                </div>
                                <span className="text-gray-700">{task}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Expected Outcomes */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-lg border-2 border-green-300">
                  <div className="flex items-center gap-3 mb-3">
                    <Database className="w-6 h-6 text-green-600" />
                    <h4 className="font-bold text-green-900">
                      Data Foundation
                    </h4>
                  </div>
                  <p className="text-3xl font-bold text-green-600 mb-2">
                    {records.length}
                  </p>
                  <p className="text-sm text-green-800">
                    Total records collected. Build to 200+ for robust analytics
                    and predictive insights.
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg border-2 border-blue-300">
                  <div className="flex items-center gap-3 mb-3">
                    <Percent className="w-6 h-6 text-blue-600" />
                    <h4 className="font-bold text-blue-900">Margin Quality</h4>
                  </div>
                  <p className="text-3xl font-bold text-blue-600 mb-2">
                    {(
                      (filteredRecords.filter(
                        (r) => r.category === "Inflow" && r.cost_per_unit
                      ).length /
                        Math.max(
                          filteredRecords.filter((r) => r.category === "Inflow")
                            .length,
                          1
                        )) *
                      100
                    ).toFixed(0)}
                    %
                  </p>
                  <p className="text-sm text-blue-800">
                    Sales with cost tracking. Target 90%+ for accurate
                    profitability analysis.
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-lg border-2 border-purple-300">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="w-6 h-6 text-purple-600" />
                    <h4 className="font-bold text-purple-900">
                      Customer Insights
                    </h4>
                  </div>
                  <p className="text-3xl font-bold text-purple-600 mb-2">
                    {customerAnalysis.length}
                  </p>
                  <p className="text-sm text-purple-800">
                    Unique customers tracked. Segment and analyze for better
                    targeting strategies.
                  </p>
                </div>
              </div>
              {/* Action Button */}
              <div className="mt-8 p-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg text-white">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h4 className="font-bold text-xl mb-2">
                      Ready to Transform Your Sales Process?
                    </h4>
                    <p className="text-purple-100">
                      Start with Phase 1 and see measurable results in 6-8 weeks
                    </p>
                  </div>
                  <button className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors shadow-lg">
                    Schedule Strategy Session
                  </button>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowStrategyModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
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
