"use client";
import { useMemo } from 'react';
import { useRecords } from '../../lib/hooks/useBookkeeping';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, 
  DollarSign, Target, Zap, ArrowUpRight, ArrowDownRight,
  BarChart3, PieChart, Activity, Calendar
} from 'lucide-react';

export default function BusinessIntelligenceDashboard({ startDate, endDate }) {
  const { data: records = [] } = useRecords(startDate, endDate);

  // Calculate business intelligence metrics
  const metrics = useMemo(() => {
    if (!records.length) {
      return {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
        avgTransactionValue: 0,
        revenueGrowth: 0,
        topPerformingCategory: null,
        cashFlowHealth: 'neutral',
        monthlyBurnRate: 0,
        runway: 0,
        insights: [],
        recommendations: [],
      };
    }

    const inflowRecords = records.filter(r => r.category === 'Inflow');
    const outflowRecords = records.filter(r => ['Outflow', 'Overhead', 'Logistics'].includes(r.category));
    
    const totalRevenue = inflowRecords.reduce((sum, r) => sum + (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1), 0);
    const totalExpenses = outflowRecords.reduce((sum, r) => sum + (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const avgTransactionValue = inflowRecords.length > 0 ? totalRevenue / inflowRecords.length : 0;

    // Calculate category performance
    const categoryPerformance = {};
    records.forEach(r => {
      const amount = (parseFloat(r.amount) || 0) * (parseFloat(r.quantity) || 1);
      if (!categoryPerformance[r.category]) {
        categoryPerformance[r.category] = { total: 0, count: 0 };
      }
      categoryPerformance[r.category].total += amount;
      categoryPerformance[r.category].count += 1;
    });

    const topPerformingCategory = Object.entries(categoryPerformance)
      .sort((a, b) => b[1].total - a[1].total)[0];

    // Cash flow health assessment
    let cashFlowHealth = 'neutral';
    if (profitMargin > 20) cashFlowHealth = 'excellent';
    else if (profitMargin > 10) cashFlowHealth = 'good';
    else if (profitMargin > 0) cashFlowHealth = 'fair';
    else cashFlowHealth = 'poor';

    // Monthly burn rate (average monthly expenses)
    const monthlyBurnRate = totalExpenses / (records.length > 0 ? 1 : 1);
    const runway = netProfit > 0 ? Infinity : (totalRevenue / Math.abs(monthlyBurnRate));

    // Generate insights
    const insights = [];
    const recommendations = [];

    if (profitMargin > 25) {
      insights.push({
        type: 'success',
        icon: CheckCircle,
        message: 'Excellent profit margins - consider reinvestment opportunities',
      });
    } else if (profitMargin < 10 && profitMargin > 0) {
      insights.push({
        type: 'warning',
        icon: AlertTriangle,
        message: 'Profit margins are tight - review cost structure',
      });
    } else if (profitMargin < 0) {
      insights.push({
        type: 'danger',
        icon: AlertTriangle,
        message: 'Operating at a loss - immediate action required',
      });
    }

    if (avgTransactionValue > 50000) {
      insights.push({
        type: 'success',
        icon: TrendingUp,
        message: 'High average transaction value indicates strong customer value',
      });
    }

    // Generate recommendations
    if (cashFlowHealth === 'poor') {
      recommendations.push({
        priority: 'urgent',
        action: 'Reduce overhead expenses immediately',
        icon: Zap,
      });
      recommendations.push({
        priority: 'high',
        action: 'Review pricing strategy',
        icon: DollarSign,
      });
    }

    if (profitMargin > 20) {
      recommendations.push({
        priority: 'medium',
        action: 'Consider scaling operations',
        icon: TrendingUp,
      });
    }

    const overheadRatio = totalExpenses > 0 
      ? (records.filter(r => r.category === 'Overhead').reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0) / totalExpenses) * 100 
      : 0;

    if (overheadRatio > 30) {
      recommendations.push({
        priority: 'high',
        action: 'Overhead costs are high - optimize operations',
        icon: Target,
      });
    }

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      avgTransactionValue,
      revenueGrowth: 0, // Would need historical data
      topPerformingCategory: topPerformingCategory ? topPerformingCategory[0] : null,
      cashFlowHealth,
      monthlyBurnRate,
      runway,
      insights,
      recommendations,
    };
  }, [records]);

  const healthColors = {
    excellent: 'bg-green-500',
    good: 'bg-blue-500',
    fair: 'bg-yellow-500',
    poor: 'bg-red-500',
  };

  const healthText = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Business Intelligence Dashboard</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Activity className="w-4 h-4" />
          <span>Real-time insights</span>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">LKR {metrics.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">All time</p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Net Profit</p>
            {metrics.netProfit >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className={`text-2xl font-bold ${metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            LKR {metrics.netProfit.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">{metrics.profitMargin.toFixed(1)}% margin</p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Avg Transaction</p>
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">LKR {metrics.avgTransactionValue.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Per customer</p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Cash Flow Health</p>
            <Activity className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${healthColors[metrics.cashFlowHealth]}`} />
            <p className="text-2xl font-bold text-gray-900">{healthText[metrics.cashFlowHealth]}</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">Based on margins</p>
        </div>
      </div>

      {/* Insights Section */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Key Insights
        </h3>
        <div className="space-y-3">
          {metrics.insights.length === 0 ? (
            <p className="text-gray-500 text-sm">Add more data to generate insights</p>
          ) : (
            metrics.insights.map((insight, index) => {
              const Icon = insight.icon;
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    insight.type === 'success' ? 'bg-green-50' :
                    insight.type === 'warning' ? 'bg-yellow-50' :
                    'bg-red-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mt-0.5 ${
                    insight.type === 'success' ? 'text-green-600' :
                    insight.type === 'warning' ? 'text-yellow-600' :
                    'text-red-600'
                  }`} />
                  <p className="text-sm text-gray-700">{insight.message}</p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Actionable Recommendations
        </h3>
        <div className="space-y-3">
          {metrics.recommendations.length === 0 ? (
            <p className="text-gray-500 text-sm">No recommendations at this time</p>
          ) : (
            metrics.recommendations.map((rec, index) => {
              const Icon = rec.icon;
              const priorityColors = {
                urgent: 'bg-red-100 text-red-700',
                high: 'bg-orange-100 text-orange-700',
                medium: 'bg-blue-100 text-blue-700',
                low: 'bg-gray-100 text-gray-700',
              };
              return (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Icon className="w-5 h-5 text-gray-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{rec.action}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[rec.priority]}`}>
                    {rec.priority}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Financial Health Score */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Financial Health Score
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold">{Math.min(100, Math.max(0, metrics.profitMargin + 50)).toFixed(0)}/100</p>
            <p className="text-sm opacity-90 mt-1">Based on profit margin and cash flow</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              {metrics.cashFlowHealth === 'excellent' && <CheckCircle className="w-6 h-6" />}
              {metrics.cashFlowHealth === 'good' && <TrendingUp className="w-6 h-6" />}
              {metrics.cashFlowHealth === 'fair' && <AlertTriangle className="w-6 h-6" />}
              {metrics.cashFlowHealth === 'poor' && <AlertTriangle className="w-6 h-6" />}
            </div>
            <p className="text-sm opacity-90 mt-1 capitalize">{metrics.cashFlowHealth} Health</p>
          </div>
        </div>
      </div>

      {/* Category Performance */}
      {metrics.topPerformingCategory && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Top Performing Category
          </h3>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
            <div>
              <p className="text-2xl font-bold text-gray-900 capitalize">{metrics.topPerformingCategory}</p>
              <p className="text-sm text-gray-600 mt-1">Highest revenue generator</p>
            </div>
            <ArrowUpRight className="w-8 h-8 text-green-500" />
          </div>
        </div>
      )}
    </div>
  );
}
