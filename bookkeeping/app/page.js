'use client';
import { useState, useMemo, useEffect } from 'react';
import { Plus, Pencil, Trash2, DollarSign, Download, TrendingUp, TrendingDown, Calendar, PieChart, BarChart3, AlertCircle, Target, Zap, Activity, Lightbulb, Award, AlertTriangle, CheckCircle, Database, RefreshCw, Brain, Users, FileText, Shield, Layers, Filter, Tag, Bell, Calculator, TrendingUp as Growth, BarChart2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { FinancialStrategyMap } from '@/components/FinancialStrategyMap';
import FinancialChartDashboard from '@/components/FinancialChartDashboard';
import { storage } from "@/utils/storage";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function BookkeepingApp() {
  const [records, setRecords] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Inflow',
    amount: '',
    notes: '',
    customer: '',
    project: '',
    tags: ''
  });
  const [showInsights, setShowInsights] = useState(true);
  const [targetRevenue, setTargetRevenue] = useState(() => {
    const saved = storage.getItem('targetRevenue');
    return saved ? parseFloat(saved) : 100000;
  });
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview','strategy',"forecast (diagram)");
  const [budgets, setBudgets] = useState({});
  const [budgetCategory, setBudgetCategory] = useState('Overhead');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [scenarioForm, setScenarioForm] = useState({
    name: '',
    inflowChange: 0,
    outflowChange: 0,
    overheadChange: 0
  });

  const categories = ['Inflow', 'Outflow', 'Reinvestment', 'Overhead', 'Loan Payment', 'Loan Received'];

  useEffect(() => {
    loadRecords();
    loadBudgets();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookkeeping_records')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading records:', error);
      const localRecords = storage.getItem('bookkeeping_records');
      if (localRecords) setRecords(JSON.parse(localRecords));
    } finally {
      setLoading(false);
    }
  };

  const loadBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('category_budgets')
        .select('*');

      if (!error && data) {
        const budgetMap = {};
        data.forEach(b => budgetMap[b.category] = b.amount);
        setBudgets(budgetMap);
      }
    } catch (error) {
      const saved = storage.getItem('categoryBudgets');
      if (saved) setBudgets(JSON.parse(saved));
    }
  };

  const syncRecords = async () => {
    setSyncing(true);
    await loadRecords();
    await loadBudgets();
    setSyncing(false);
  };

  useEffect(() => {
    storage.setItem('targetRevenue', targetRevenue.toString());
  }, [targetRevenue]);

  useEffect(() => {
    storage.setItem('categoryBudgets', JSON.stringify(budgets));
  }, [budgets]);

  const filteredRecords = useMemo(() => {
    if (!dateFilter.start && !dateFilter.end) return records;
    
    return records.filter(r => {
      const recordDate = new Date(r.date);
      const startDate = dateFilter.start ? new Date(dateFilter.start) : null;
      const endDate = dateFilter.end ? new Date(dateFilter.end) : null;
      
      if (startDate && endDate) {
        return recordDate >= startDate && recordDate <= endDate;
      } else if (startDate) {
        return recordDate >= startDate;
      } else if (endDate) {
        return recordDate <= endDate;
      }
      return true;
    });
  }, [records, dateFilter]);

  const handleSubmit = async () => {
    if (!formData.description || !formData.amount) return;

    try {
      const recordData = {
        date: formData.date,
        description: formData.description,
        category: formData.category,
        amount: parseFloat(formData.amount),
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

  const handleEdit = (index) => {
    const record = records[index];
    setFormData({
      date: record.date,
      description: record.description,
      category: record.category,
      amount: record.amount.toString(),
      notes: record.notes || '',
      customer: record.customer || '',
      project: record.project || '',
      tags: record.tags || ''
    });
    setIsEditing(index);
  };

  const handleDelete = async (index) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const recordToDelete = records[index];
      const { error } = await supabase
        .from('bookkeeping_records')
        .delete()
        .eq('id', recordToDelete.id);

      if (error) throw error;
      setRecords(records.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record.');
    }
  };

  const handleCancel = () => {
    setIsEditing(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: 'Inflow',
      amount: '',
      notes: '',
      customer: '',
      project: '',
      tags: ''
    });
  };

  const saveBudget = async () => {
    if (!budgetAmount) return;
    
    try {
      const { error } = await supabase
        .from('category_budgets')
        .upsert({
          category: budgetCategory,
          amount: parseFloat(budgetAmount)
        }, { onConflict: 'category' });

      if (error) throw error;
      setBudgets({ ...budgets, [budgetCategory]: parseFloat(budgetAmount) });
      setBudgetAmount('');
      setShowBudgetModal(false);
    } catch (error) {
      console.error('Error saving budget:', error);
      setBudgets({ ...budgets, [budgetCategory]: parseFloat(budgetAmount) });
      setBudgetAmount('');
      setShowBudgetModal(false);
    }
  };

  const exportToCSV = () => {
    const dataToExport = filteredRecords.length > 0 ? filteredRecords : records;
    
    if (dataToExport.length === 0) {
      alert('No records to export');
      return;
    }

    const headers = ['Date', 'Description', 'Category', 'Amount (LKR)', 'Customer', 'Project', 'Tags', 'Notes'];
    const csvData = dataToExport.map(r => [
      r.date,
      `"${r.description}"`,
      r.category,
      r.amount,
      `"${r.customer || ''}"`,
      `"${r.project || ''}"`,
      `"${r.tags || ''}"`,
      `"${r.notes || ''}"`
    ]);

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
    link.download = `bookkeeping${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const totals = filteredRecords.reduce((acc, r) => {
    const amount = parseFloat(r.amount) || 0;
    if (r.category === 'Inflow') acc.inflow += amount;
    if (r.category === 'Outflow') acc.outflow += amount;
    if (r.category === 'Reinvestment') acc.reinvestment += amount;
    if (r.category === 'Overhead') acc.overhead += amount;
    if (r.category === 'Loan Payment') acc.loanPayment += amount;
    if (r.category === 'Loan Received') acc.loanReceived += amount;
    return acc;
  }, { inflow: 0, outflow: 0, reinvestment: 0, overhead: 0, loanPayment: 0, loanReceived: 0 });

  const grossProfit = totals.inflow - totals.outflow;
  const grossMarginPercent = totals.inflow > 0 ? (grossProfit / totals.inflow) * 100 : 0;
  const operatingProfit = grossProfit - totals.overhead - totals.reinvestment;
  const netLoanImpact = totals.loanReceived - totals.loanPayment;
  const netProfit = operatingProfit + netLoanImpact;

  // Customer/Project Analysis
  const customerAnalysis = useMemo(() => {
    const customers = {};
    filteredRecords.forEach(r => {
      if (r.customer && r.category === 'Inflow') {
        if (!customers[r.customer]) {
          customers[r.customer] = { revenue: 0, transactions: 0, projects: new Set() };
        }
        customers[r.customer].revenue += parseFloat(r.amount) || 0;
        customers[r.customer].transactions += 1;
        if (r.project) customers[r.customer].projects.add(r.project);
      }
    });
    
    return Object.entries(customers)
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        transactions: data.transactions,
        projectCount: data.projects.size,
        avgTransaction: data.revenue / data.transactions
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredRecords]);

  const projectAnalysis = useMemo(() => {
    const projects = {};
    filteredRecords.forEach(r => {
      if (r.project) {
        if (!projects[r.project]) {
          projects[r.project] = { revenue: 0, costs: 0, transactions: 0 };
        }
        const amount = parseFloat(r.amount) || 0;
        if (r.category === 'Inflow') {
          projects[r.project].revenue += amount;
        } else if (['Outflow', 'Overhead', 'Reinvestment'].includes(r.category)) {
          projects[r.project].costs += amount;
        }
        projects[r.project].transactions += 1;
      }
    });
    
    return Object.entries(projects)
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        costs: data.costs,
        profit: data.revenue - data.costs,
        margin: data.revenue > 0 ? ((data.revenue - data.costs) / data.revenue * 100) : 0,
        transactions: data.transactions
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [filteredRecords]);

  // Cash Flow Forecast (Simple Linear Regression)
  const cashFlowForecast = useMemo(() => {
    if (filteredRecords.length < 30) return null;
    
    const monthlyData = {};
    filteredRecords.forEach(r => {
      const month = r.date.substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { inflow: 0, outflow: 0 };
      }
      const amount = parseFloat(r.amount) || 0;
      if (r.category === 'Inflow') monthlyData[month].inflow += amount;
      if (['Outflow', 'Overhead', 'Reinvestment'].includes(r.category)) monthlyData[month].outflow += amount;
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const recentMonths = sortedMonths.slice(-6);
    
    const avgInflowGrowth = recentMonths.slice(1).reduce((acc, month, i) => {
      const prevMonth = recentMonths[i];
      return acc + ((monthlyData[month].inflow - monthlyData[prevMonth].inflow) / monthlyData[prevMonth].inflow);
    }, 0) / (recentMonths.length - 1);
    
    const lastMonthInflow = monthlyData[recentMonths[recentMonths.length - 1]].inflow;
    const lastMonthOutflow = monthlyData[recentMonths[recentMonths.length - 1]].outflow;
    
    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      const projectedInflow = lastMonthInflow * Math.pow(1 + avgInflowGrowth, i);
      const projectedOutflow = lastMonthOutflow * 1.02; // Assuming 2% monthly cost increase
      forecast.push({
        month: i,
        inflow: projectedInflow,
        outflow: projectedOutflow,
        netCashFlow: projectedInflow - projectedOutflow
      });
    }
    
    return forecast;
  }, [filteredRecords]);

  // Budget Alerts
  const budgetAlerts = useMemo(() => {
    const alerts = [];
    Object.entries(budgets).forEach(([category, budgetAmount]) => {
      const spent = filteredRecords
        .filter(r => r.category === category)
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      
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

  // Tax Liability Estimator (Sri Lanka corporate tax ~30%)
  const taxEstimate = useMemo(() => {
    const taxableIncome = Math.max(0, operatingProfit);
    const estimatedTax = taxableIncome * 0.30; // 30% corporate tax rate
    const quarterlyTax = estimatedTax / 4;
    
    return {
      taxableIncome,
      annualTax: estimatedTax,
      quarterlyTax,
      effectiveRate: grossProfit > 0 ? (estimatedTax / grossProfit) * 100 : 0
    };
  }, [operatingProfit, grossProfit]);

  // Benchmark Comparison (Industry averages for Sri Lankan SMEs)
  const benchmarks = {
    grossMargin: 45,
    overheadRatio: 25,
    reinvestmentRate: 15,
    profitMargin: 12
  };

  const actualMetrics = {
    grossMargin: grossMarginPercent,
    overheadRatio: totals.inflow > 0 ? (totals.overhead / totals.inflow) * 100 : 0,
    reinvestmentRate: totals.inflow > 0 ? (totals.reinvestment / totals.inflow) * 100 : 0,
    profitMargin: totals.inflow > 0 ? (netProfit / totals.inflow) * 100 : 0
  };

  const formatLKR = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const clearDateFilter = () => {
    setDateFilter({ start: '', end: '' });
  };

  const setQuickFilter = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateFilter({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 mb-6 text-white" style={{color:"white"}}>
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Brain className="w-8 h-8" />
                SME Financial Intelligence Platform
              </h1>
              <p className="text-blue-100">AI-powered insights • Predictive analytics • Strategic decision support</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 text-sm">
                  <Database className="w-4 h-4" />
                  <span>Cloud Synced</span>
                </div>
                <button
                  onClick={syncRecords}
                  disabled={syncing}
                  className="flex items-center gap-1 text-sm bg-blue-500 px-2 py-1 rounded hover:bg-blue-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync'}
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

        {/* Budget Alerts */}
        {budgetAlerts.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">Budget Alerts</h3>
                <div className="space-y-2">
                  {budgetAlerts.map((alert, idx) => (
                    <div key={idx} className="text-sm text-yellow-800">
                      <strong>{alert.category}:</strong> {alert.percentUsed.toFixed(0)}% used 
                      (LKR {formatLKR(alert.spent)} / {formatLKR(alert.budget)})
                      {alert.severity === 'critical' && ' - OVER BUDGET!'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
          <div className="flex overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'forecast', label: 'Forecast', icon: TrendingUp },
              { id: 'benchmark', label: 'Benchmarks', icon: Target },
              { id: 'tax', label: 'Tax Planning', icon: Calculator },
              { id: 'records', label: 'All Records', icon: FileText },
              { id: 'strategy', label: 'Strategy Map', icon: Lightbulb },
              { id: 'forecast (diagram)', label: 'Forecast (Diagram)', icon: Lightbulb },
              //

            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
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
              onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-600">to</span>
            <input
              type="date"
              value={dateFilter.end}
              onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={clearDateFilter}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setQuickFilter(30)} className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">30D</button>
              <button onClick={() => setQuickFilter(90)} className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">90D</button>
              <button onClick={() => setQuickFilter(180)} className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">6M</button>
              <button onClick={() => setQuickFilter(365)} className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">1Y</button>
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <TrendingUp className="w-8 h-8 opacity-80" />
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded" style={{color:"black"}}>Inflow</span>
                </div>
                <h3 className="text-2xl font-bold mb-1" >LKR {formatLKR(totals.inflow)}</h3>
                <p className="text-sm opacity-90">Total Revenue</p>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <TrendingDown className="w-8 h-8 opacity-80" />
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded" style={{color:"black"}}>Outflow</span>
                </div>
                <h3 className="text-2xl font-bold mb-1">LKR {formatLKR(totals.outflow)}</h3>
                <p className="text-sm opacity-90">Direct Costs</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <Award className="w-8 h-8 opacity-80" />
                  <span className={`text-xs px-2 py-1 rounded ${grossProfit >= 0 ? 'bg-white bg-opacity-20' : 'bg-red-500'}`} style={{color:"black"}}>
                    {grossMarginPercent.toFixed(1)}%
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-1">LKR {formatLKR(grossProfit)}</h3>
                <p className="text-sm opacity-90">Gross Profit</p>
              </div>

              <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-purple-500 to-purple-600' : 'from-orange-500 to-orange-600'} text-white rounded-lg shadow-lg p-5`} >
                <div className="flex justify-between items-start mb-2">
                  <DollarSign className="w-8 h-8 opacity-80" />
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded" style={{color:"black"}}>Net</span>
                </div>
                <h3 className="text-2xl font-bold mb-1">LKR {formatLKR(netProfit)}</h3>
                <p className="text-sm opacity-90">Net Profit</p>
              </div>
            </div>

            {/* Entry Form */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {isEditing !== null ? 'Edit Record' : 'Add New Record'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description *"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Amount (LKR) *"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Customer (optional)"
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Project (optional)"
                  value={formData.project}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Tags (comma-separated)"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                rows="2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold"
                >
                  {isEditing !== null ? 'Update' : 'Add Record'}
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
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Description</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Customer</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Amount</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRecords.slice(0, 10).map((record, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{record.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{record.description}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            record.category === 'Inflow' ? 'bg-green-100 text-green-800' :
                            record.category === 'Outflow' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {record.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.customer || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">LKR {formatLKR(record.amount)}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}




        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="w-6 h-6" />
                Customer Profitability Analysis
              </h2>
              {customerAnalysis.length === 0 ? (
                <p className="text-gray-500">No customer data available. Add customer names to your inflow records to see analysis.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Customer</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Total Revenue</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Transactions</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Avg Transaction</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Projects</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">% of Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {customerAnalysis.map((customer, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.name}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">LKR {formatLKR(customer.revenue)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{customer.transactions}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">LKR {formatLKR(customer.avgTransaction)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{customer.projectCount}</td>
                          <td className="px-4 py-3 text-sm text-right text-blue-600 font-medium">
                            {((customer.revenue / totals.inflow) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Layers className="w-6 h-6" />
                Project Profitability Analysis
              </h2>
              {projectAnalysis.length === 0 ? (
                <p className="text-gray-500">No project data available. Add project names to your records to see analysis.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Project</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Revenue</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Costs</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Profit</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Margin</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Transactions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {projectAnalysis.map((project, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{project.name}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600">LKR {formatLKR(project.revenue)}</td>
                          <td className="px-4 py-3 text-sm text-right text-red-600">LKR {formatLKR(project.costs)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            LKR {formatLKR(project.profit)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${project.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {project.margin.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{project.transactions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Forecast Tab */}
        {activeTab === 'forecast' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Brain className="w-7 h-7" />
                AI Cash Flow Forecast
              </h2>
              <p className="text-purple-100">Predictive analytics based on historical trends</p>
            </div>

            {!cashFlowForecast ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <p className="text-yellow-800">Need at least 30 days of data to generate accurate forecasts.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {cashFlowForecast.map((forecast, idx) => (
                    <div key={idx} className="bg-white rounded-lg shadow-md p-6">
                      <div className="text-center mb-4">
                        <h3 className="text-lg font-bold text-gray-700">Month +{forecast.month}</h3>
                        <p className="text-sm text-gray-500">Projected</p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Expected Inflow</p>
                          <p className="text-xl font-bold text-green-600">LKR {formatLKR(forecast.inflow)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Expected Outflow</p>
                          <p className="text-xl font-bold text-red-600">LKR {formatLKR(forecast.outflow)}</p>
                        </div>
                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-sm text-gray-600">Net Cash Flow</p>
                          <p className={`text-2xl font-bold ${forecast.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            LKR {formatLKR(forecast.netCashFlow)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-2">Forecast Insights</h3>
                      <ul className="space-y-1 text-sm text-blue-800">
                        <li>• Based on {filteredRecords.length} historical transactions</li>
                        <li>• Assumes 2% monthly cost inflation</li>
                        <li>• Revenue growth trend: {((cashFlowForecast[0].inflow / totals.inflow - 1) * 100).toFixed(1)}% per month</li>
                        <li>• Use this for strategic planning and cash reserve management</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Benchmark Tab */}
        {activeTab === 'benchmark' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Target className="w-7 h-7" />
                Industry Benchmark Comparison
              </h2>
              <p className="text-indigo-100">Compare your performance against Sri Lankan SME standards</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { name: 'Gross Margin', actual: actualMetrics.grossMargin, benchmark: benchmarks.grossMargin, unit: '%' },
                { name: 'Overhead Ratio', actual: actualMetrics.overheadRatio, benchmark: benchmarks.overheadRatio, unit: '%', inverse: true },
                { name: 'Reinvestment Rate', actual: actualMetrics.reinvestmentRate, benchmark: benchmarks.reinvestmentRate, unit: '%' },
                { name: 'Profit Margin', actual: actualMetrics.profitMargin, benchmark: benchmarks.profitMargin, unit: '%' }
              ].map((metric, idx) => {
                const difference = metric.actual - metric.benchmark;
                const isGood = metric.inverse ? difference < 0 : difference > 0;
                const percentDiff = ((difference / metric.benchmark) * 100);
                
                return (
                  <div key={idx} className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="font-bold text-lg mb-4">{metric.name}</h3>
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Your Business</p>
                        <p className="text-3xl font-bold text-blue-600">{metric.actual.toFixed(1)}{metric.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 mb-1">Industry Avg</p>
                        <p className="text-2xl font-semibold text-gray-700">{metric.benchmark}{metric.unit}</p>
                      </div>
                    </div>
                    <div className="bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                      <div
                        className={`h-full ${isGood ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, (metric.actual / metric.benchmark) * 100)}%` }}
                      />
                    </div>
                    <div className={`flex items-center gap-2 text-sm font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                      {isGood ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>
                        {isGood ? 'Above' : 'Below'} industry standard by {Math.abs(percentDiff).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-lg mb-4">Performance Summary</h3>
              <div className="space-y-3">
                {actualMetrics.grossMargin > benchmarks.grossMargin && (
                  <div className="flex items-start gap-3 bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-800">Your gross margin is strong, indicating good pricing power and cost control.</p>
                  </div>
                )}
                {actualMetrics.overheadRatio < benchmarks.overheadRatio && (
                  <div className="flex items-start gap-3 bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-800">Overhead ratio is below industry average - efficient operations!</p>
                  </div>
                )}
                {actualMetrics.profitMargin < benchmarks.profitMargin && (
                  <div className="flex items-start gap-3 bg-yellow-50 p-3 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">Profit margin is below industry standard. Consider reviewing costs and pricing strategy.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tax Planning Tab */}
        {activeTab === 'tax' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Calculator className="w-7 h-7" />
                Tax Liability Estimator
              </h2>
              <p className="text-emerald-100">Sri Lanka corporate tax planning based on current period</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-bold text-lg mb-4">Tax Calculation</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Taxable Income (Operating Profit)</p>
                    <p className="text-2xl font-bold text-gray-900">LKR {formatLKR(taxEstimate.taxableIncome)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Estimated Annual Tax (30%)</p>
                    <p className="text-2xl font-bold text-red-600">LKR {formatLKR(taxEstimate.annualTax)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Quarterly Tax Payment</p>
                    <p className="text-xl font-bold text-orange-600">LKR {formatLKR(taxEstimate.quarterlyTax)}</p>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Effective Tax Rate</p>
                    <p className="text-xl font-bold text-blue-600">{taxEstimate.effectiveRate.toFixed(2)}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-bold text-lg mb-4">Tax Planning Recommendations</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-blue-900 mb-1">Set Aside Reserves</h4>
                        <p className="text-sm text-blue-800">Reserve LKR {formatLKR(taxEstimate.quarterlyTax)} per quarter for tax payments.</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-green-900 mb-1">Optimize Deductions</h4>
                        <p className="text-sm text-green-800">Track reinvestments (LKR {formatLKR(totals.reinvestment)}) for potential tax deductions.</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-purple-900 mb-1">Timing Strategy</h4>
                        <p className="text-sm text-purple-800">Consider timing major expenses near period end to optimize tax liability.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-2">Important Disclaimer</h3>
                  <p className="text-sm text-yellow-800">This is an estimate only. Actual tax liability may vary based on allowable deductions, tax incentives, and other factors. Consult with a qualified tax professional for accurate tax planning.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Records Tab */}
        {activeTab === 'records' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">All Transaction Records</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Project</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Tags</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.map((record, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{record.date}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{record.description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          record.category === 'Inflow' ? 'bg-green-100 text-green-800' :
                          record.category === 'Outflow' ? 'bg-red-100 text-red-800' :
                          record.category === 'Overhead' ? 'bg-orange-100 text-orange-800' :
                          record.category === 'Reinvestment' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {record.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.customer || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.project || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {record.tags ? (
                          <div className="flex gap-1 flex-wrap">
                            {record.tags.split(',').map((tag, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">LKR {formatLKR(record.amount)}</td>
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
                  ))}
                </tbody>
              </table>
              {filteredRecords.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No records found for the selected period</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'strategy' && (
  <FinancialStrategyMap
    totals={totals}
    grossProfit={grossProfit}
    netProfit={netProfit}
    grossMarginPercent={grossMarginPercent}
  />
)}

        {activeTab === 'forecast (diagram)' && (
<FinancialChartDashboard     totals={totals}
    grossProfit={grossProfit}
    netProfit={netProfit}
    grossMarginPercent={grossMarginPercent}/>
)}
        {/* Modals */}
        {showTargetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Set Revenue Target</h3>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Revenue (LKR)
              </label>
              <input
                type="number"
                value={targetRevenue}
                onChange={(e) => setTargetRevenue(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTargetModal(false)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save Target
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

        {showBudgetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Set Category Budget</h3>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={budgetCategory}
                onChange={(e) => setBudgetCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              >
                {categories.filter(c => c !== 'Inflow').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget Amount (LKR)
              </label>
              <input
                type="number"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder={budgets[budgetCategory] ? `Current: ${formatLKR(budgets[budgetCategory])}` : 'Enter amount'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              
              {Object.keys(budgets).length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Budgets:</h4>
                  <div className="space-y-1">
                    {Object.entries(budgets).map(([cat, amt]) => (
                      <div key={cat} className="text-sm text-gray-600 flex justify-between">
                        <span>{cat}:</span>
                        <span className="font-medium">LKR {formatLKR(amt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
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
                    setBudgetAmount('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}