// app/components/business-kpi-dashboard.js
'use client';
import { useState, useEffect } from 'react';

export default function BusinessKPIDashboard({ userId }) {
  const [kpis, setKpis] = useState(null);
  const [trends, setTrends] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    if (userId) {
      fetchKPIs();
    }
  }, [userId, period]);

  const fetchKPIs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/kpi-dashboard?userId=${userId}&period=${period}`);
      const data = await response.json();
      
      if (data.success) {
        setKpis(data.kpis);
        setTrends(data.trends);
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Failed to fetch KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMetricColor = (metric, value) => {
    const thresholds = {
      replyRate: { good: 15, warning: 8 },
      meetingRate: { good: 5, warning: 2 },
      bounceRate: { good: 2, warning: 5 },
      unsubscribeRate: { good: 0.5, warning: 1 }
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'text-gray-600';

    if (metric === 'bounceRate' || metric === 'unsubscribeRate') {
      return value <= threshold.good ? 'text-green-600' : 
             value <= threshold.warning ? 'text-yellow-600' : 'text-red-600';
    } else {
      return value >= threshold.good ? 'text-green-600' : 
             value >= threshold.warning ? 'text-yellow-600' : 'text-red-600';
    }
  };

  const getAlertIcon = (level) => {
    switch (level) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📊';
    }
  };

  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <p>No KPI data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Business KPI Dashboard</h3>
        <div className="flex items-center space-x-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border rounded px-3 py-1"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
          <button
            onClick={fetchKPIs}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${
                alert.level === 'critical' ? 'bg-red-50 border-red-200' :
                alert.level === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                <span className="text-lg">{getAlertIcon(alert.level)}</span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    alert.level === 'critical' ? 'text-red-800' :
                    alert.level === 'warning' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {alert.message}
                  </p>
                  <p className={`text-xs mt-1 ${
                    alert.level === 'critical' ? 'text-red-600' :
                    alert.level === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {alert.recommendation}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Core Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Reply Rate</p>
              <p className={`text-2xl font-bold ${getMetricColor('replyRate', kpis.rates.replyRate)}`}>
                {kpis.rates.replyRate.toFixed(1)}%
              </p>
            </div>
            {trends?.replyRate && (
              <div className="text-right">
                <span className="text-lg">{getTrendIcon(trends.replyRate.direction)}</span>
                <p className={`text-xs ${getMetricColor('replyRate', trends.replyRate.current)}`}>
                  {trends.replyRate.change > 0 ? '+' : ''}{trends.replyRate.change.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Meeting Rate</p>
              <p className={`text-2xl font-bold ${getMetricColor('meetingRate', kpis.rates.meetingRate)}`}>
                {kpis.rates.meetingRate.toFixed(1)}%
              </p>
            </div>
            {trends?.meetingRate && (
              <div className="text-right">
                <span className="text-lg">{getTrendIcon(trends.meetingRate.direction)}</span>
                <p className={`text-xs ${getMetricColor('meetingRate', trends.meetingRate.current)}`}>
                  {trends.meetingRate.change > 0 ? '+' : ''}{trends.meetingRate.change.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Bounce Rate</p>
              <p className={`text-2xl font-bold ${getMetricColor('bounceRate', kpis.rates.bounceRate)}`}>
                {kpis.rates.bounceRate.toFixed(1)}%
              </p>
            </div>
            {trends?.bounceRate && (
              <div className="text-right">
                <span className="text-lg">{getTrendIcon(trends.bounceRate.direction)}</span>
                <p className={`text-xs ${getMetricColor('bounceRate', trends.bounceRate.current)}`}>
                  {trends.bounceRate.change > 0 ? '+' : ''}{trends.bounceRate.change.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600">Unsubscribe Rate</p>
              <p className={`text-2xl font-bold ${getMetricColor('unsubscribeRate', kpis.rates.unsubscribeRate)}`}>
                {kpis.rates.unsubscribeRate.toFixed(1)}%
              </p>
            </div>
            {trends?.unsubscribeRate && (
              <div className="text-right">
                <span className="text-lg">{getTrendIcon(trends.unsubscribeRate.direction)}</span>
                <p className={`text-xs ${getMetricColor('unsubscribeRate', trends.unsubscribeRate.current)}`}>
                  {trends.unsubscribeRate.change > 0 ? '+' : ''}{trends.unsubscribeRate.change.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Business Impact Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Total Emails Sent</p>
          <p className="text-xl font-bold text-gray-900">{kpis.overview.totalEmailsSent}</p>
          <p className="text-xs text-gray-500 mt-1">
            to {kpis.overview.totalSequences} companies
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Meetings Booked</p>
          <p className="text-xl font-bold text-green-600">{kpis.overview.totalMeetings}</p>
          <p className="text-xs text-gray-500 mt-1">
            {kpis.overview.totalReplies} replies received
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-2">Avg Interest Score</p>
          <p className="text-xl font-bold text-blue-600">{kpis.engagement.avgInterestScore}</p>
          <p className="text-xs text-gray-500 mt-1">
            Based on opens/clicks/replies
          </p>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Performance Insights</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">
              <strong>Open Rate:</strong> {kpis.rates.openRate.toFixed(1)}%
            </p>
            <p className="text-gray-600">
              <strong>Click Rate:</strong> {kpis.rates.clickRate.toFixed(1)}%
            </p>
            <p className="text-gray-600">
              <strong>Avg Steps/Sequence:</strong> {kpis.sequencePerformance.avgStepsPerSequence.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-gray-600">
              <strong>Deliverability:</strong> {kpis.deliverability.delivered}/{kpis.overview.totalEmailsSent} delivered
            </p>
            <p className="text-gray-600">
              <strong>Active Sequences:</strong> {kpis.overview.totalSequences}
            </p>
            <p className="text-gray-600">
              <strong>Period:</strong> {period.charAt(0).toUpperCase() + period.slice(1)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
