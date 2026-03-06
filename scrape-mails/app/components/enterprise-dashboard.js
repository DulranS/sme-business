// app/components/enterprise-dashboard.js - Enterprise monitoring dashboard
'use client';
import { useState, useEffect } from 'react';

export default function EnterpriseDashboard({ userId }) {
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [errorStats, setErrorStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('day');

  useEffect(() => {
    if (userId) {
      fetchEnterpriseData();
      const interval = setInterval(fetchEnterpriseData, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [userId, selectedTimeframe]);

  const fetchEnterpriseData = async () => {
    setLoading(true);
    try {
      const [healthRes, metricsRes, errorRes] = await Promise.all([
        fetch('/api/enterprise/health'),
        fetch(`/api/enterprise/metrics?timeframe=${selectedTimeframe}`),
        fetch('/api/enterprise/errors/stats')
      ]);

      const [healthData, metricsData, errorData] = await Promise.all([
        healthRes.json(),
        metricsRes.json(),
        errorRes.json()
      ]);

      setHealth(healthData.health);
      setMetrics(metricsData.metrics);
      setErrorStats(errorData.stats);
    } catch (error) {
      console.error('Error fetching enterprise data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      case 'unhealthy': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'low': return 'text-blue-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* System Health Overview - Responsive */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
          <h3 className="text-lg font-medium text-gray-900">System Health</h3>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getHealthColor(health?.overall)}`}>
            {health?.overall?.toUpperCase() || 'UNKNOWN'}
          </span>
        </div>
        
        {/* Responsive Service Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {health?.services?.map((service) => (
            <div key={service.service_name} className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900 text-sm truncate">{service.service_name}</h4>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getHealthColor(service.status)}`}>
                  {service.status}
                </span>
              </div>
              {service.response_time_ms && (
                <div className="text-sm text-gray-500">
                  Response: {service.response_time_ms}ms
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {new Date(service.last_check).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Statistics - Responsive */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
          <h3 className="text-lg font-medium text-gray-900">Error Statistics</h3>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 w-full sm:w-auto"
          >
            <option value="hour">Last Hour</option>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
          </select>
        </div>

        {/* Responsive Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-gray-900">{errorStats?.total || 0}</div>
            <div className="text-xs sm:text-sm text-gray-500">Total Errors</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-red-600">{errorStats?.unresolved || 0}</div>
            <div className="text-xs sm:text-sm text-gray-500">Unresolved</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{errorStats?.resolved || 0}</div>
            <div className="text-xs sm:text-sm text-gray-500">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {errorStats?.total > 0 ? Math.round((errorStats.resolved / errorStats.total) * 100) : 0}%
            </div>
            <div className="text-xs sm:text-sm text-gray-500">Resolution Rate</div>
          </div>
        </div>

        {/* Error Breakdown - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">By Severity</h4>
            <div className="space-y-2">
              {Object.entries(errorStats?.bySeverity || {}).map(([severity, count]) => (
                <div key={severity} className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${getSeverityColor(severity)}`}>
                    {severity.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-3">By Category</h4>
            <div className="space-y-2">
              {Object.entries(errorStats?.byCategory || {}).map(([category, count]) => (
                <div key={category} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{category}</span>
                  <span className="text-sm text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics - Responsive */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
        
        {/* Responsive Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {metrics?.slice(0, 9).map((metric, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="text-sm font-medium text-gray-900 mb-1 truncate">{metric.metric_name}</div>
              <div className="text-lg sm:text-xl font-bold text-blue-600">
                {metric.metric_value}
                {metric.unit && <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(metric.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions - Responsive */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <button
            onClick={() => window.open('/api/enterprise/health', '_blank')}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm"
          >
            View Health API
          </button>
          <button
            onClick={() => window.open('/api/enterprise/metrics', '_blank')}
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 text-sm"
          >
            View Metrics API
          </button>
          <button
            onClick={fetchEnterpriseData}
            className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 text-sm"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
}
