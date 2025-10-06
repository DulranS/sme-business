"use client";
import { useState, useMemo, useEffect } from "react";
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
} from "recharts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function BookkeepingApp() {
const [records, setRecords] = useState([]);
const [isEditing, setIsEditing] = useState(null);
const [loading, setLoading] = useState(true);
const [syncing, setSyncing] = useState(false);
const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
const [formData, setFormData] = useState({
  date: new Date().toISOString().split("T")[0],
  description: "",
  category: "Inflow",
  amount: "",
  costPerUnit: "",
  quantity: "",
  notes: "",
  customer: "",
  project: "",
  tags: "",
});
const [targetRevenue, setTargetRevenue] = useState(100000);
const [showTargetModal, setShowTargetModal] = useState(false);
const [showBudgetModal, setShowBudgetModal] = useState(false);
const [activeTab, setActiveTab] = useState("overview");
const [budgets, setBudgets] = useState({});
const [budgetCategory, setBudgetCategory] = useState("Overhead");
const [budgetAmount, setBudgetAmount] = useState("");
const [expandedSection, setExpandedSection] = useState(null);
const [showStrategyModal, setShowStrategyModal] = useState(false);

const categories = [
  "Inflow",
  "Outflow",
  "Reinvestment",
  "Overhead",
  "Loan Payment",
  "Loan Received",
];

  const syncRecords = async () => {
    setSyncing(true);
    await loadRecords();
    await loadBudgets();
    setSyncing(false);
  };

useEffect(() => {
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
    const { data, error } = await supabase.from("category_budgets").select("*");
    if (!error && data) {
      const budgetMap = {};
      data.forEach((b) => (budgetMap[b.category] = b.amount));
      setBudgets(budgetMap);
    }
  } catch (error) {
    console.error("Error loading budgets:", error);
  }
};

// --- Filtered Records ---
const filteredRecords = useMemo(() => {
  if (!dateFilter.start && !dateFilter.end) return records;

  return records.filter((r) => {
    const recordDate = new Date(r.date);
    const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
    const endDate = dateFilter.end ? new Date(dateFilter.end) : null;

    if (startDate && endDate) return recordDate >= startDate && recordDate <= endDate;
    if (startDate) return recordDate >= startDate;
    if (endDate) return recordDate <= endDate;
    return true;
  });
}, [records, dateFilter]);

// --- Monthly Data Aggregation ---
const monthlyData = useMemo(() => {
  if (!filteredRecords || filteredRecords.length === 0) return [];

  const grouped = {};

  filteredRecords.forEach((r) => {
    const date = new Date(r.date);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    if (!grouped[monthKey]) grouped[monthKey] = { revenue: 0, cost: 0, profit: 0 };

    const qty = parseFloat(r.quantity) || 1;
    const price = parseFloat(r.amount) || 0;
    const cost = parseFloat(r.cost_per_unit) || 0;
    const revenue = price * qty;
    const totalCost = cost * qty;
    const profit = revenue - totalCost;

    if (r.category === "Inflow") {
      grouped[monthKey].revenue += revenue;
      grouped[monthKey].cost += totalCost;
      grouped[monthKey].profit += profit;
    } else if (["Outflow", "Overhead", "Reinvestment"].includes(r.category)) {
      grouped[monthKey].cost += revenue;
      grouped[monthKey].profit -= revenue;
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
}, [filteredRecords]);

  const handleSubmit = async () => {
    if (!formData.description || !formData.amount) return;

    try {
      const recordData = {
        date: formData.date,
        description: formData.description,
        category: formData.category,
        amount: parseFloat(formData.amount),
        cost_per_unit: formData.costPerUnit ? parseFloat(formData.costPerUnit) : null,
        quantity: formData.quantity ? parseFloat(formData.quantity) : 1,
        notes: formData.notes,
        customer: formData.customer || null,
        project: formData.project || null,
        tags: formData.tags || null
      };

      if (isEditing !== null) {
        const recordToUpdate = records[isEditing];
        const { error } = await supabase
          .from('bookkeeping_records')
          .update(recordData)
          .eq('id', recordToUpdate.id);

        if (error) throw error;
        setRecords(records.map((r, i) => i === isEditing ? { ...recordData, id: r.id } : r));
        setIsEditing(null);
      } else {
        const { data, error } = await supabase
          .from('bookkeeping_records')
          .insert([recordData])
          .select();

        if (error) throw error;
        setRecords([data[0], ...records]);
      }

      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        category: 'Inflow',
        amount: '',
        costPerUnit: '',
        quantity: '',
        notes: '',
        customer: '',
        project: '',
        tags: ''
      });
    } catch (error) {
      console.error('Error saving record:', error);
      alert('Failed to save record. Please check your Supabase configuration.');
    }
  };

// --- ROI Timeline & Calculations ---
const roiTimeline = useMemo(() => {
  const grouped = {};
  filteredRecords.forEach((r) => {
    if (!r.date) return;
    const month = new Date(r.date).toLocaleString("default", {
      month: "short",
      year: "2-digit",
    });
    if (!grouped[month]) grouped[month] = { month, investment: 0, return: 0, net: 0 };

    if (["Outflow", "Overhead", "Reinvestment"].includes(r.category)) {
      grouped[month].investment += parseFloat(r.amount) || 0;
      grouped[month].net -= parseFloat(r.amount) || 0;
    } else if (r.category === "Inflow") {
      grouped[month].return += parseFloat(r.amount) || 0;
      grouped[month].net += parseFloat(r.amount) || 0;
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
        ? (((totalReturn - totalInvestment) / totalInvestment) * 100).toFixed(0)
        : 0,
  };
}, [roiTimeline]);

// --- Totals & Business Value Data ---

  const exportToCSV = () => {
    const dataToExport = filteredRecords.length > 0 ? filteredRecords : records;
    
    if (dataToExport.length === 0) {
      alert('No records to export');
      return;
    }

    const headers = ['Date', 'Description', 'Category', 'Unit Price (LKR)', 'Cost per Unit (LKR)', 'Quantity', 'Total Revenue', 'Total Cost', 'Profit', 'Margin %', 'Customer', 'Project', 'Tags', 'Notes'];
    const csvData = dataToExport.map(r => {
      const qty = r.quantity || 1;
      const price = r.amount;
      const cost = r.cost_per_unit || 0;
      const revenue = price * qty;
      const totalCost = cost * qty;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(2) : '0';
      
      return [
        r.date,
        `"${r.description}"`,
        r.category,
        price,
        cost,
        qty,
        revenue.toFixed(2),
        totalCost.toFixed(2),
        profit.toFixed(2),
        margin,
        `"${r.customer || ''}"`,
        `"${r.project || ''}"`,
        `"${r.tags || ''}"`,
        `"${r.notes || ''}"`
      ];
    });

    const dateRange = dateFilter.start || dateFilter.end 
      ? `_${dateFilter.start || 'start'}_to_${dateFilter.end || 'end'}`
      : '';

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `profit_analysis${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };
const totals = filteredRecords.reduce(
  (acc, r) => {
    const amount = parseFloat(r.amount) || 0;
    const costPerUnit = parseFloat(r.cost_per_unit) || 0;
    const quantity = parseFloat(r.quantity) || 1;
    const revenue = amount * quantity;
    const cost = costPerUnit * quantity;

    if (r.category === "Inflow") {
      acc.inflow += revenue;
      acc.inflowCost += cost;
      acc.inflowProfit += revenue - cost;
    }
    if (r.category === "Outflow") acc.outflow += revenue;
    if (r.category === "Reinvestment") acc.reinvestment += revenue;
    if (r.category === "Overhead") acc.overhead += revenue;
    if (r.category === "Loan Payment") acc.loanPayment += revenue;
    if (r.category === "Loan Received") acc.loanReceived += revenue;

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
  }
);

const grossProfit = totals.inflow - totals.outflow;
const grossMarginPercent = totals.inflow > 0 ? (grossProfit / totals.inflow) * 100 : 0;
const trueGrossMargin = totals.inflow > 0 ? (totals.inflowProfit / totals.inflow) * 100 : 0;
const operatingProfit = grossProfit - totals.overhead - totals.reinvestment;
const netLoanImpact = totals.loanReceived - totals.loanPayment;
const netProfit = operatingProfit + netLoanImpact;

// --- Customer Profitability Analysis ---
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
        };

        
      }
      const qty = parseFloat(r.quantity) || 1;
      customers[r.customer].revenue += parseFloat(r.amount) * qty;
      customers[r.customer].cost += parseFloat(r.cost_per_unit || 0) * qty;
      customers[r.customer].transactions += 1;
      if (r.project) customers[r.customer].projects.add(r.project);
    }
  });

  return Object.entries(customers)
    .map(([name, data]) => ({
      name,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      margin:
        data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
      transactions: data.transactions,
      projectCount: data.projects.size,
      avgTransaction: data.revenue / data.transactions,
    }))
    .sort((a, b) => b.profit - a.profit);
}, [filteredRecords]);


  const productMargins = useMemo(() => {
    const products = {};
    
    filteredRecords.filter(r => r.category === 'Inflow').forEach(r => {
      const key = r.description;
      if (!products[key]) {
        products[key] = { 
          revenue: 0, 
          cost: 0, 
          quantity: 0,
          transactions: 0,
          customers: new Set()
        };
      }
      
      const qty = parseFloat(r.quantity) || 1;
      const revenue = parseFloat(r.amount) * qty;
      const cost = parseFloat(r.cost_per_unit || 0) * qty;
      
      products[key].revenue += revenue;
      products[key].cost += cost;
      products[key].quantity += qty;
      products[key].transactions += 1;
      if (r.customer) products[key].customers.add(r.customer);
    });
    
    return Object.entries(products)
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        cost: data.cost,
        quantity: data.quantity,
        transactions: data.transactions,
        customers: data.customers.size,
        profit: data.revenue - data.cost,
        margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
        avgPrice: data.revenue / data.quantity,
        avgCost: data.cost / data.quantity,
        avgProfit: (data.revenue - data.cost) / data.quantity
      }))
      .sort((a, b) => b.margin - a.margin);
  }, [filteredRecords]);

  const budgetAlerts = useMemo(() => {
    const alerts = [];
    Object.entries(budgets).forEach(([category, budgetAmount]) => {
      const spent = filteredRecords
        .filter(r => r.category === category)
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1), 0);
      
      const percentUsed = (spent / budgetAmount) * 100;
      
      if (percentUsed >= 90) {
        alerts.push({
          category,
          spent,
          budget: budgetAmount,
          percentUsed,
          severity: percentUsed >= 100 ? 'critical' : 'warning'
        });
      }
    });
    return alerts;
  }, [filteredRecords, budgets]);

    const pricingRecommendations = useMemo(() => {
    return productMargins
      .filter(p => p.cost > 0)
      .map(p => {
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
          needsAction: p.margin < 30
        };
      })
      .filter(r => r.needsAction)
      .sort((a, b) => b.potentialRevenue - a.potentialRevenue);
  }, [productMargins]);
const businessValueData = [
  { metric: "Revenue", current: (totals.inflow / targetRevenue) * 100, target: 100 },
  { metric: "Margin", current: trueGrossMargin, target: 50 },
  { metric: "Cost Coverage", current: totals.inflow > 0 ? (totals.outflow / totals.inflow) * 100 : 0, target: 70 },
  { metric: "Customer Coverage", current: (customerAnalysis.length / Math.max(filteredRecords.length, 1)) * 100, target: 100 },
];



// --- Analytics Maturity ---
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

  const implementationPhases = [
    {
      phase: "Foundation",
      duration: "6-8 weeks",
      icon: Database,
      color: "bg-blue-500",
      value: "$50K-100K",
      tasks: [
        "Data Infrastructure Setup",
        "CRM Integration & Clean-up",
        "Analytics Platform Selection",
        "Baseline Metrics Definition",
      ],
    },
    {
      phase: "Quick Wins",
      duration: "4-6 weeks",
      icon: Zap,
      color: "bg-green-500",
      value: "$75K-150K",
      tasks: [
        "Sales Dashboard Deployment",
        "Lead Scoring Model v1",
        "Pipeline Health Reports",
        "Sales Rep Training",
      ],
    },
    {
      phase: "Advanced Analytics",
      duration: "8-12 weeks",
      icon: Brain,
      color: "bg-purple-500",
      value: "$200K-400K",
      tasks: [
        "Predictive Win Probability",
        "Customer Segmentation",
        "Next-Best-Action AI",
        "Churn Prediction",
      ],
    },
    {
      phase: "Optimization",
      duration: "Ongoing",
      icon: TrendingUp,
      color: "bg-orange-500",
      value: "$500K+",
      tasks: [
        "Model Performance Monitoring",
        "Process Refinement",
        "Advanced Experiments",
        "AI Capability Expansion",
      ],
    },
  ];

  const formatLKR = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const clearDateFilter = () => {
    setDateFilter({ start: "", end: "" });
  };

  const setQuickFilter = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateFilter({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });
  };

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
                AI-powered margin analysis • Pricing intelligence • Strategic
                profitability insights
              </p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 text-sm">
                  <Percent className="w-4 h-4" />
                  <span>True Margin: {trueGrossMargin.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Database className="w-4 h-4" />
                  <span>{records.length} transactions</span>
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
                onClick={() => setShowStrategyModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-md hover:from-purple-600 hover:to-purple-700 transition-all font-semibold shadow-md"
              >
                <Layers className="w-4 h-4" />
                Strategy
              </button>
              <button
                onClick={() => setShowTargetModal(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-400 transition-colors font-semibold shadow-md"
              >
                <Target className="w-4 h-4" />
                Target
              </button>
              <button
                onClick={() => setShowBudgetModal(true)}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-400 transition-colors font-semibold shadow-md"
              >
                <Bell className="w-4 h-4" />
                Budgets
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
                          <strong>{alert.category}:</strong>{" "}
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
              { id: "margins", label: "Profit Margins", icon: Percent },
              { id: "products", label: "Products", icon: Package },
              { id: "customers", label: "Customers", icon: Users },
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

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <TrendingUp className="w-8 h-8 opacity-80" />
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded text-white">
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
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded text-white">
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
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded text-white">
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
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded text-white">
                    Net
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">
                  LKR {formatLKR(netProfit)}
                </h3>
                <p className="text-sm opacity-90">Net Profit</p>
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
                      const margin =
                        price > 0 && cost > 0
                          ? ((price - cost) / price) * 100
                          : null;

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.date}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {record.description}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
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
              </div>
            </div>
          </>
        )}

        {/* Profit Margins Tab */}
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
                <p className="text-xs text-gray-500 mt-1">
                  Across all products
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm text-gray-600 mb-2">Total Markup</h3>
                <p className="text-3xl font-bold text-green-600">
                  LKR {formatLKR(totals.inflowProfit)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Gross profit from sales
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm text-gray-600 mb-2">COGS</h3>
                <p className="text-3xl font-bold text-red-600">
                  LKR {formatLKR(totals.inflowCost)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Cost of goods sold</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm text-gray-600 mb-2">Markup Ratio</h3>
                <p className="text-3xl font-bold text-purple-600">
                  {totals.inflowCost > 0
                    ? (totals.inflowProfit / totals.inflowCost).toFixed(2)
                    : "0"}
                  x
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Profit per cost dollar
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

        {/* Products Tab */}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customers Tab */}
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
                            % of Revenue
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
                            <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">
                              {(
                                (customer.revenue / totals.inflow) *
                                100
                              ).toFixed(1)}
                              %
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

        {/* Pricing Intelligence Tab */}
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
                                className={`px-3 py-1 text-xs font-semibold rounded-full ${
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

        {/* Strategic Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-lg shadow-lg p-6">
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
      <p className="text-xs text-gray-500">
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
                  {breakEvenMonth || "N/A"} |
                  <strong className="ml-3">12-month ROI:</strong>{" "}
                  {roiPercentage}% |
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
                Revenue & Profit Trends (Last 6 Months)
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

        {/* All Records Tab */}
        {activeTab === "records" && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Complete Transaction History
            </h2>
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
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">
                      Customer
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
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.map((record, index) => {
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
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {record.date}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {record.description}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
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
            </div>
          </div>
        )}

        {/* Target Modal */}
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

        {/* Budget Modal */}
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

        {/* Strategy Implementation Modal */}
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
                            className={`text-xs font-semibold px-3 py-1 rounded-full ${
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
