import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, DollarSign, Download, TrendingUp, TrendingDown, Calendar, PieChart, BarChart3, AlertCircle, Target, Zap, Activity } from 'lucide-react';

export default function BookkeepingApp() {
  const [records, setRecords] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
  const [dateFilter, setDateFilter] = useState({
    start: '',
    end: ''
  });
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Inflow',
    amount: '',
    notes: ''
  });

  const categories = [
    'Inflow',
    'Outflow',
    'Reinvestment',
    'Overhead',
    'Loan Payment',
    'Loan Received'
  ];

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

  const handleSubmit = () => {
    if (!formData.description || !formData.amount) return;

    if (isEditing !== null) {
      setRecords(records.map((r, i) => i === isEditing ? { ...formData, id: r.id } : r));
      setIsEditing(null);
    } else {
      setRecords([...records, { ...formData, id: Date.now() }]);
    }

    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: 'Inflow',
      amount: '',
      notes: ''
    });
  };

  const handleEdit = (index) => {
    setFormData(records[index]);
    setIsEditing(index);
  };

  const handleDelete = (index) => {
    if (confirm('Are you sure you want to delete this record?')) {
      setRecords(records.filter((_, i) => i !== index));
    }
  };

  const handleCancel = () => {
    setIsEditing(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: 'Inflow',
      amount: '',
      notes: ''
    });
  };

  const exportToCSV = () => {
    const dataToExport = filteredRecords.length > 0 ? filteredRecords : records;
    
    if (dataToExport.length === 0) {
      alert('No records to export');
      return;
    }

    const headers = ['Date', 'Description', 'Category', 'Amount (LKR)', 'Notes'];
    const csvData = dataToExport.map(r => [
      r.date,
      `"${r.description}"`,
      r.category,
      r.amount,
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

  // Monthly trend analysis
  const monthlyData = useMemo(() => {
    const months = {};
    filteredRecords.forEach(r => {
      const month = r.date.substring(0, 7);
      if (!months[month]) {
        months[month] = { inflow: 0, outflow: 0, overhead: 0, reinvestment: 0, loanPayment: 0, loanReceived: 0 };
      }
      const amount = parseFloat(r.amount) || 0;
      if (r.category === 'Inflow') months[month].inflow += amount;
      if (r.category === 'Outflow') months[month].outflow += amount;
      if (r.category === 'Overhead') months[month].overhead += amount;
      if (r.category === 'Reinvestment') months[month].reinvestment += amount;
      if (r.category === 'Loan Payment') months[month].loanPayment += amount;
      if (r.category === 'Loan Received') months[month].loanReceived += amount;
    });
    
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month,
        ...data,
        grossProfit: data.inflow - data.outflow,
        netProfit: (data.inflow - data.outflow - data.overhead - data.reinvestment) + (data.loanReceived - data.loanPayment)
      }));
  }, [filteredRecords]);

  // Category breakdown for strategic insights
  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    filteredRecords.forEach(r => {
      if (!breakdown[r.category]) {
        breakdown[r.category] = { total: 0, count: 0, items: [] };
      }
      const amount = parseFloat(r.amount) || 0;
      breakdown[r.category].total += amount;
      breakdown[r.category].count += 1;
      breakdown[r.category].items.push({ description: r.description, amount, date: r.date });
    });
    return breakdown;
  }, [filteredRecords]);

  // Period comparison (comparing filtered period with previous equal period)
  const periodComparison = useMemo(() => {
    if (!dateFilter.start || !dateFilter.end || records.length === 0) return null;
    
    const startDate = new Date(dateFilter.start);
    const endDate = new Date(dateFilter.end);
    const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays - 1);
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    
    const prevPeriodRecords = records.filter(r => {
      const rDate = new Date(r.date);
      return rDate >= prevStartDate && rDate <= prevEndDate;
    });
    
    const prevTotals = prevPeriodRecords.reduce((acc, r) => {
      const amount = parseFloat(r.amount) || 0;
      if (r.category === 'Inflow') acc.inflow += amount;
      if (r.category === 'Outflow') acc.outflow += amount;
      if (r.category === 'Overhead') acc.overhead += amount;
      if (r.category === 'Reinvestment') acc.reinvestment += amount;
      return acc;
    }, { inflow: 0, outflow: 0, overhead: 0, reinvestment: 0 });
    
    const prevGrossProfit = prevTotals.inflow - prevTotals.outflow;
    const prevNetProfit = prevGrossProfit - prevTotals.overhead - prevTotals.reinvestment;
    
    return {
      inflowChange: prevTotals.inflow > 0 ? ((totals.inflow - prevTotals.inflow) / prevTotals.inflow * 100) : 0,
      outflowChange: prevTotals.outflow > 0 ? ((totals.outflow - prevTotals.outflow) / prevTotals.outflow * 100) : 0,
      profitChange: prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit) * 100) : 0,
      prevInflow: prevTotals.inflow,
      prevOutflow: prevTotals.outflow,
      prevNetProfit: prevNetProfit
    };
  }, [filteredRecords, dateFilter, records, totals, netProfit]);

  // Business health metrics
  const burnRate = totals.overhead + totals.outflow;
  const runway = totals.inflow > 0 && burnRate > 0 ? (netProfit / (burnRate / 30)).toFixed(0) : 0;
  const overheadRatio = totals.inflow > 0 ? (totals.overhead / totals.inflow) * 100 : 0;
  const reinvestmentRate = totals.inflow > 0 ? (totals.reinvestment / totals.inflow) * 100 : 0;
  
  // Cash flow velocity
  const daysInPeriod = filteredRecords.length > 0 
    ? Math.max(1, Math.ceil((new Date(Math.max(...filteredRecords.map(r => new Date(r.date)))) - 
        new Date(Math.min(...filteredRecords.map(r => new Date(r.date))))) / (1000 * 60 * 60 * 24)))
    : 1;
  const dailyCashVelocity = netProfit / daysInPeriod;

  // Break-even analysis
  const breakEvenRevenue = totals.overhead + totals.reinvestment;
  const revenueToBreakEven = totals.inflow > 0 ? Math.max(0, breakEvenRevenue - totals.inflow) : breakEvenRevenue;

  // ROI on reinvestment
  const reinvestmentROI = totals.reinvestment > 0 ? ((grossProfit - totals.overhead) / totals.reinvestment * 100) : 0;

  // Quick ratio (liquidity measure)
  const quickRatio = (totals.overhead + totals.loanPayment) > 0 ? 
    (totals.inflow / (totals.overhead + totals.loanPayment)) : 0;

  const formatLKR = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <DollarSign className="w-8 h-8" />
                SME Financial Intelligence Dashboard
              </h1>
              <p className="text-blue-100">Real-time cash flow insights & strategic business analytics</p>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-md hover:bg-blue-50 transition-colors font-semibold shadow-md"
            >
              <Download className="w-4 h-4" />
              Export {filteredRecords.length < records.length ? 'Filtered' : 'All'} Data
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">Date Range Filter</h3>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setQuickFilter(7)} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors">
              Last 7 Days
            </button>
            <button onClick={() => setQuickFilter(30)} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors">
              Last 30 Days
            </button>
            <button onClick={() => setQuickFilter(90)} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors">
              Last 90 Days
            </button>
            <button onClick={() => setQuickFilter(365)} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors">
              Last Year
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={clearDateFilter}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear Filter
            </button>
          </div>
          {(dateFilter.start || dateFilter.end) && (
            <div className="mt-3 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800 font-medium">
                📊 Showing {filteredRecords.length} of {records.length} transactions
                {dateFilter.start && dateFilter.end && (
                  <span className="ml-2">
                    ({Math.ceil((new Date(dateFilter.end) - new Date(dateFilter.start)) / (1000 * 60 * 60 * 24)) + 1} days)
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {periodComparison && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-5 mb-6 shadow-sm">
            <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Period-over-Period Performance
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Revenue Change</p>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${periodComparison.inflowChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {periodComparison.inflowChange >= 0 ? '+' : ''}{periodComparison.inflowChange.toFixed(1)}%
                  </span>
                  {periodComparison.inflowChange >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-1">vs previous period</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Cost Change</p>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${periodComparison.outflowChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {periodComparison.outflowChange >= 0 ? '+' : ''}{periodComparison.outflowChange.toFixed(1)}%
                  </span>
                  {periodComparison.outflowChange <= 0 ? <TrendingDown className="w-5 h-5 text-green-600" /> : <TrendingUp className="w-5 h-5 text-red-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-1">Lower is better</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">Profit Change</p>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${periodComparison.profitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {periodComparison.profitChange >= 0 ? '+' : ''}{periodComparison.profitChange.toFixed(1)}%
                  </span>
                  {periodComparison.profitChange >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-1">Bottom line impact</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border-l-4 border-green-500 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-gray-600 font-medium uppercase mb-1">Total Inflows</p>
            <p className="text-2xl font-bold text-green-700">LKR {formatLKR(totals.inflow)}</p>
            <p className="text-xs text-gray-500 mt-1">Revenue & Income</p>
          </div>
          
          <div className="bg-white border-l-4 border-red-500 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-gray-600 font-medium uppercase mb-1">Total Outflows</p>
            <p className="text-2xl font-bold text-red-700">LKR {formatLKR(totals.outflow)}</p>
            <p className="text-xs text-gray-500 mt-1">Direct Costs (COGS)</p>
          </div>

          <div className="bg-white border-l-4 border-purple-500 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-gray-600 font-medium uppercase mb-1">Gross Profit</p>
            <p className="text-2xl font-bold text-purple-700">LKR {formatLKR(grossProfit)}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                grossMarginPercent >= 50 ? 'bg-green-100 text-green-700' :
                grossMarginPercent >= 30 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {grossMarginPercent.toFixed(1)}% Margin
              </span>
            </div>
          </div>

          <div className={`bg-white border-l-4 ${netProfit >= 0 ? 'border-blue-500' : 'border-orange-500'} rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow`}>
            <p className="text-xs text-gray-600 font-medium uppercase mb-1">Net Profit</p>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              LKR {formatLKR(Math.abs(netProfit))}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {netProfit >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <p className={`text-xs font-semibold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netProfit >= 0 ? 'Profitable' : 'Loss'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <p className="text-sm text-orange-900 font-medium">Overhead Ratio</p>
            </div>
            <p className="text-2xl font-bold text-orange-800">{overheadRatio.toFixed(1)}%</p>
            <p className="text-xs text-orange-700 mt-1">
              {overheadRatio < 20 ? 'Excellent' : overheadRatio < 35 ? 'Good' : 'High - Optimize'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <p className="text-sm text-purple-900 font-medium">Reinvestment Rate</p>
            </div>
            <p className="text-2xl font-bold text-purple-800">{reinvestmentRate.toFixed(1)}%</p>
            <p className="text-xs text-purple-700 mt-1">
              {reinvestmentRate > 15 ? 'High Growth Mode' : reinvestmentRate > 5 ? 'Steady Growth' : 'Conservative'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-cyan-600" />
              <p className="text-sm text-cyan-900 font-medium">Daily Cash Velocity</p>
            </div>
            <p className="text-2xl font-bold text-cyan-800">LKR {formatLKR(Math.abs(dailyCashVelocity))}</p>
            <p className="text-xs text-cyan-700 mt-1">
              {dailyCashVelocity > 0 ? 'Positive Flow' : 'Negative Flow'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <p className="text-sm text-indigo-900 font-medium">Cash Runway</p>
            </div>
            <p className="text-2xl font-bold text-indigo-800">{runway > 0 ? runway : '∞'} days</p>
            <p className="text-xs text-indigo-700 mt-1">
              {runway > 180 ? 'Very Safe' : runway > 90 ? 'Safe' : runway > 30 ? 'Caution' : 'Critical'}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-teal-600" />
              <p className="text-sm text-teal-900 font-medium">Break-Even Gap</p>
            </div>
            <p className="text-2xl font-bold text-teal-800">LKR {formatLKR(revenueToBreakEven)}</p>
            <p className="text-xs text-teal-700 mt-1">
              {revenueToBreakEven === 0 ? 'Break-even achieved!' : 'Revenue needed to break even'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-pink-600" />
              <p className="text-sm text-pink-900 font-medium">Reinvestment ROI</p>
            </div>
            <p className="text-2xl font-bold text-pink-800">{reinvestmentROI.toFixed(0)}%</p>
            <p className="text-xs text-pink-700 mt-1">
              {reinvestmentROI > 100 ? 'Excellent returns' : reinvestmentROI > 50 ? 'Good returns' : reinvestmentROI > 0 ? 'Positive returns' : 'No reinvestment'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg shadow-md p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-900 font-medium">Quick Ratio</p>
            </div>
            <p className="text-2xl font-bold text-amber-800">{quickRatio.toFixed(2)}</p>
            <p className="text-xs text-amber-700 mt-1">
              {quickRatio >= 1.5 ? 'Strong liquidity' : quickRatio >= 1 ? 'Adequate liquidity' : 'Improve liquidity'}
            </p>
          </div>
        </div>

        {Object.keys(categoryBreakdown).length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Category Breakdown & Strategic Insights</h3>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(categoryBreakdown).map(([category, data]) => {
                const avgTransaction = data.total / data.count;
                const color = category === 'Inflow' ? 'green' :
                             category === 'Outflow' ? 'red' :
                             category === 'Overhead' ? 'orange' :
                             category === 'Reinvestment' ? 'purple' :
                             category === 'Loan Received' ? 'blue' : 'gray';
                
                return (
                  <div key={category} className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
                    <p className={`text-sm font-semibold text-${color}-900 mb-2`}>{category}</p>
                    <p className={`text-xl font-bold text-${color}-800`}>LKR {formatLKR(data.total)}</p>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-600">
                        {data.count} transaction{data.count !== 1 ? 's' : ''} • Avg: LKR {formatLKR(avgTransaction)}
                      </p>
                      {totals.inflow > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {((data.total / totals.inflow) * 100).toFixed(1)}% of revenue
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {monthlyData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Monthly Trend Analysis (Last 6 Months)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Month</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Inflow</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Outflow</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Overhead</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Gross Profit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Net Profit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {monthlyData.map((month, idx) => {
                    const prevMonth = idx > 0 ? monthlyData[idx - 1] : null;
                    const trend = prevMonth ? ((month.netProfit - prevMonth.netProfit) / Math.abs(prevMonth.netProfit) * 100) : 0;
                    const grossMargin = month.inflow > 0 ? ((month.grossProfit / month.inflow) * 100) : 0;
                    
                    return (
                      <tr key={month.month} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatMonth(month.month)}</td>
                        <td className="px-4 py-2 text-sm text-right text-green-700 font-semibold">{formatLKR(month.inflow)}</td>
                        <td className="px-4 py-2 text-sm text-right text-red-700 font-semibold">{formatLKR(month.outflow)}</td>
                        <td className="px-4 py-2 text-sm text-right text-orange-700 font-semibold">{formatLKR(month.overhead)}</td>
                        <td className="px-4 py-2 text-sm text-right text-purple-700 font-semibold">
                          {formatLKR(month.grossProfit)}
                          <span className="text-xs text-gray-500 ml-1">({grossMargin.toFixed(0)}%)</span>
                        </td>
                        <td className={`px-4 py-2 text-sm text-right font-bold ${month.netProfit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                          {formatLKR(month.netProfit)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {prevMonth && (
                            <div className="flex items-center justify-end gap-1">
                              {trend > 0 ? <TrendingUp className="w-3 h-3 text-green-600" /> : trend < 0 ? <TrendingDown className="w-3 h-3 text-red-600" /> : null}
                              <span className={`text-xs font-semibold ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600 font-medium mb-2">Overhead Expenses</p>
            <p className="text-xl font-bold text-gray-800">LKR {formatLKR(totals.overhead)}</p>
            <p className="text-xs text-gray-500 mt-1">Fixed costs (rent, salaries, utilities)</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600 font-medium mb-2">Reinvestment</p>
            <p className="text-xl font-bold text-gray-800">LKR {formatLKR(totals.reinvestment)}</p>
            <p className="text-xs text-gray-500 mt-1">Growth capital (equipment, expansion)</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600 font-medium mb-2">Net Loan Impact</p>
            <p className={`text-xl font-bold ${netLoanImpact >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              LKR {formatLKR(Math.abs(netLoanImpact))}
            </p>
            <p className="text-xs text-gray-500 mt-1">Received: {formatLKR(totals.loanReceived)} | Paid: {formatLKR(totals.loanPayment)}</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 mb-6 shadow-sm">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Financial Formula & Business Intelligence
          </h3>
          <div className="space-y-2">
            <div className="text-sm text-blue-800 font-mono bg-white px-3 py-2 rounded">
              Net Profit = (Inflows - Outflows) - Overhead - Reinvestment + (Loans Received - Loan Payments)
            </div>
            <div className="grid md:grid-cols-2 gap-2 text-sm text-blue-700">
              <div className="bg-white px-3 py-2 rounded">
                <strong>Gross Margin:</strong> {grossMarginPercent.toFixed(1)}%
              </div>
              <div className="bg-white px-3 py-2 rounded">
                <strong>Operating Profit:</strong> LKR {formatLKR(operatingProfit)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {isEditing !== null ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Customer payment, Raw materials, Office rent"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (LKR) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details, invoice number, vendor name, etc."
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!formData.description || !formData.amount}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                {isEditing !== null ? 'Update Transaction' : 'Add Transaction'}
              </button>
              {isEditing !== null && (
                <button
                  onClick={handleCancel}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Transaction History ({filteredRecords.length}{filteredRecords.length !== records.length ? ` of ${records.length}` : ''})
            </h2>
          </div>
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg mb-2">No transactions found</p>
              <p className="text-sm">
                {records.length === 0 
                  ? 'Start tracking your business finances by adding your first transaction above'
                  : 'Try adjusting your date filter to see more transactions'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Amount (LKR)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRecords.map((record, index) => {
                    const originalIndex = records.findIndex(r => r.id === record.id);
                    return (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{record.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{record.description}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            record.category === 'Inflow' ? 'bg-green-100 text-green-700' :
                            record.category === 'Outflow' ? 'bg-red-100 text-red-700' :
                            record.category === 'Overhead' ? 'bg-orange-100 text-orange-700' :
                            record.category === 'Reinvestment' ? 'bg-purple-100 text-purple-700' :
                            record.category === 'Loan Received' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {record.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {formatLKR(parseFloat(record.amount))}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.notes || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(originalIndex)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(originalIndex)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}