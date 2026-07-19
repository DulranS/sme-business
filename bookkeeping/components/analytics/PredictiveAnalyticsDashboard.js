"use client";
import { useMemo } from 'react';
import { useRecords } from '../../lib/hooks/useBookkeeping';
import { 
  TrendingUp, Calendar, DollarSign, Activity, AlertTriangle,
  LineChart, BarChart, Zap, Info
} from 'lucide-react';

export default function PredictiveAnalyticsDashboard({ startDate, endDate }) {
  const { data: records = [] } = useRecords(startDate, endDate);

  // Predictive analytics calculations
  const predictions = useMemo(() => {
    if (records.length < 3) {
      return {
        hasEnoughData: false,
        message: 'Need at least 3 months of data for predictions'
      };
    }

    // Group records by month
    const monthlyData = {};
    records.forEach(record => {
      const month = record.date.substring(0, 7); // YYYY-MM
      const amount = (parseFloat(record.amount) || 0) * (parseFloat(record.quantity) || 1);
      
      if (!monthlyData[month]) {
        monthlyData[month] = { inflow: 0, outflow: 0, overhead: 0, logistics: 0 };
      }
      
      if (record.category === 'Inflow') {
        monthlyData[month].inflow += amount;
      } else if (['Outflow', 'Overhead', 'Logistics'].includes(record.category)) {
        monthlyData[month].outflow += amount;
        if (record.category === 'Overhead') monthlyData[month].overhead += amount;
        if (record.category === 'Logistics') monthlyData[month].logistics += amount;
      }
    });

    const months = Object.keys(monthlyData).sort();
    if (months.length < 3) {
      return {
        hasEnoughData: false,
        message: 'Need at least 3 months of data for predictions'
      };
    }

    // Calculate trends using linear regression
    const calculateTrend = (data) => {
      const values = data.map((m, i) => ({ x: i, y: data[m] }));
      const n = values.length;
      
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      values.forEach(v => {
        sumX += v.x;
        sumY += v.y;
        sumXY += v.x * v.y;
        sumX2 += v.x * v.x;
      });
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      return { slope, intercept };
    };

    const inflowTrend = calculateTrend(months.map(m => monthlyData[m].inflow));
    const outflowTrend = calculateTrend(months.map(m => monthlyData[m].outflow));
    const overheadTrend = calculateTrend(months.map(m => monthlyData[m].overhead));

    // Predict next 3 months
    const predictions = [];
    for (let i = 1; i <= 3; i++) {
      const nextIndex = months.length + i - 1;
      const predictedInflow = Math.max(0, inflowTrend.slope * nextIndex + inflowTrend.intercept);
      const predictedOutflow = Math.max(0, outflowTrend.slope * nextIndex + outflowTrend.intercept);
      const predictedOverhead = Math.max(0, overheadTrend.slope * nextIndex + overheadTrend.intercept);
      const predictedNetCashFlow = predictedInflow - predictedOutflow;
      
      predictions.push({
        month: `Month +${i}`,
        inflow: predictedInflow,
        outflow: predictedOutflow,
        overhead: predictedOverhead,
        netCashFlow: predictedNetCashFlow,
        profitMargin: predictedInflow > 0 ? (predictedNetCashFlow / predictedInflow) * 100 : 0,
      });
    }

    // Calculate growth rates
    const recentInflow = monthlyData[months[months.length - 1]].inflow;
    const previousInflow = monthlyData[months[months.length - 2]].inflow;
    const inflowGrowthRate = previousInflow > 0 ? ((recentInflow - previousInflow) / previousInflow) * 100 : 0;

    const recentOutflow = monthlyData[months[months.length - 1]].outflow;
    const previousOutflow = monthlyData[months[months.length - 2]].outflow;
    const outflowGrowthRate = previousOutflow > 0 ? ((recentOutflow - previousOutflow) / previousOutflow) * 100 : 0;

    // Risk assessment
    let riskLevel = 'low';
    let riskFactors = [];

    if (inflowTrend.slope < 0) {
      riskLevel = 'high';
      riskFactors.push('Declining revenue trend');
    }

    if (outflowTrend.slope > inflowTrend.slope) {
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      riskFactors.push('Expenses growing faster than revenue');
    }

    if (predictions[0].profitMargin < 10) {
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      riskFactors.push('Low profit margins forecasted');
    }

    const overheadRatio = recentInflow > 0 ? (monthlyData[months[months.length - 1]].overhead / recentInflow) * 100 : 0;
    if (overheadRatio > 30) {
      riskFactors.push('High overhead ratio');
    }

    // Recommendations
    const recommendations = [];
    if (inflowTrend.slope < 0) {
      recommendations.push({
        priority: 'urgent',
        action: 'Implement revenue growth strategies immediately',
        icon: Zap,
      });
    }
    if (outflowTrend.slope > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Review and optimize expense structure',
        icon: TrendingUp,
      });
    }
    if (overheadRatio > 25) {
      recommendations.push({
        priority: 'medium',
        action: 'Reduce overhead costs to improve margins',
        icon: DollarSign,
      });
    }
    if (inflowGrowthRate > 10) {
      recommendations.push({
        priority: 'low',
        action: 'Consider scaling operations to capitalize on growth',
        icon: Activity,
      });
    }

    return {
      hasEnoughData: true,
      predictions,
      inflowGrowthRate,
      outflowGrowthRate,
      riskLevel,
      riskFactors,
      recommendations,
      currentMonthlyInflow: recentInflow,
      currentMonthlyOutflow: recentOutflow,
      currentProfitMargin: recentInflow > 0 ? ((recentInflow - recentOutflow) / recentInflow) * 100 : 0,
    };
  }, [records]);

  const riskColors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
  };

  const riskText = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
  };

  if (!predictions.hasEnoughData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Predictive Analytics & Forecasting</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <LineChart className="w-4 h-4" />
            <span>AI-powered predictions</span>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-8 text-center">
          <Info className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">{predictions.message}</p>
          <p className="text-sm text-gray-500 mt-2">Add more historical data to enable predictions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Predictive Analytics & Forecasting</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <LineChart className="w-4 h-4" />
          <span>AI-powered predictions</span>
        </div>
      </div>

      {/* Current Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Current Monthly Revenue</p>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">LKR {predictions.currentMonthlyInflow.toLocaleString()}</p>
          <p className={`text-xs mt-1 ${predictions.inflowGrowthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {predictions.inflowGrowthRate >= 0 ? '+' : ''}{predictions.inflowGrowthRate.toFixed(1)}% growth
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Current Monthly Expenses</p>
            <BarChart className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">LKR {predictions.currentMonthlyOutflow.toLocaleString()}</p>
          <p className={`text-xs mt-1 ${predictions.outflowGrowthRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {predictions.outflowGrowthRate >= 0 ? '+' : ''}{predictions.outflowGrowthRate.toFixed(1)}% growth
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Current Profit Margin</p>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{predictions.currentProfitMargin.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Based on recent data</p>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Risk Assessment
        </h3>
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-4 h-4 rounded-full ${riskColors[predictions.riskLevel]}`} />
          <p className="text-xl font-bold text-gray-900">{riskText[predictions.riskLevel]}</p>
        </div>
        {predictions.riskFactors.length > 0 && (
          <div className="space-y-2">
            {predictions.riskFactors.map((factor, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                {factor}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-Month Forecast */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          3-Month Forecast
        </h3>
        <div className="space-y-4">
          {predictions.predictions.map((prediction, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-900">{prediction.month}</h4>
                <span className={`text-sm font-medium ${prediction.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {prediction.netCashFlow >= 0 ? '+' : ''}LKR {prediction.netCashFlow.toLocaleString()} net
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Predicted Revenue</p>
                  <p className="font-semibold text-gray-900">LKR {prediction.inflow.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Predicted Expenses</p>
                  <p className="font-semibold text-gray-900">LKR {prediction.outflow.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Profit Margin</p>
                  <p className={`font-semibold ${prediction.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {prediction.profitMargin.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {predictions.recommendations.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            AI Recommendations
          </h3>
          <div className="space-y-3">
            {predictions.recommendations.map((rec, index) => {
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
            })}
          </div>
        </div>
      )}

      {/* Methodology Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Forecast Methodology</p>
            <p>Predictions are calculated using linear regression on your historical monthly data. These are estimates and should be used for planning purposes only. Actual results may vary based on market conditions and business decisions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
