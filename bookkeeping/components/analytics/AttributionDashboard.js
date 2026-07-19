"use client";
import { useAttributionData, useRevenueBySource } from '../../lib/hooks/useBookkeeping';
import { TrendingUp, Target, Funnel, DollarSign, ArrowRight } from 'lucide-react';

export default function AttributionDashboard({ startDate, endDate }) {
  const { data: attributionData, isLoading: attributionLoading } = useAttributionData(startDate, endDate);
  const { data: revenueData, isLoading: revenueLoading } = useRevenueBySource(startDate, endDate);

  if (attributionLoading || revenueLoading) {
    return <div className="p-4">Loading attribution data...</div>;
  }

  // Calculate conversion funnel
  const conversionFunnel = attributionData?.reduce((acc, record) => {
    const source = record.attribution_source || 'direct';
    const stage = record.conversion_stage || 'closed_won';
    
    if (!acc[source]) {
      acc[source] = {
        source,
        leads: 0,
        qualified: 0,
        proposals: 0,
        closedWon: 0,
        closedLost: 0,
        totalRevenue: 0,
      };
    }
    
    acc[source][stage === 'lead' ? 'leads' : 
                stage === 'qualified' ? 'qualified' :
                stage === 'proposal' ? 'proposals' :
                stage === 'closed_won' ? 'closedWon' : 'closedLost']++;
    
    if (stage === 'closed_won' && record.category === 'Inflow') {
      acc[source].totalRevenue += (parseFloat(record.amount) || 0) * (parseFloat(record.quantity) || 1);
    }
    
    return acc;
  }, {}) || {};

  // Calculate revenue by source
  const revenueBySource = revenueData?.reduce((acc, record) => {
    const source = record.attribution_source || 'direct';
    const revenue = (parseFloat(record.amount) || 0) * (parseFloat(record.quantity) || 1);
    
    if (!acc[source]) {
      acc[source] = { source, revenue, count: 0 };
    }
    acc[source].revenue += revenue;
    acc[source].count++;
    
    return acc;
  }, {}) || {};

  const funnelArray = Object.values(conversionFunnel).sort((a, b) => b.totalRevenue - a.totalRevenue);
  const revenueArray = Object.values(revenueBySource).sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = revenueArray.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Attribution & Conversion Analytics</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Target className="w-4 h-4" />
          <span>Track what converts</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Revenue</p>
              <p className="text-2xl font-bold">LKR {totalRevenue.toLocaleString()}</p>
            </div>
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">
                {funnelArray.reduce((sum, f) => sum + f.leads, 0)}
              </p>
            </div>
            <Funnel className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {funnelArray.length > 0 
                  ? ((funnelArray.reduce((sum, f) => sum + f.closedWon, 0) / 
                     Math.max(funnelArray.reduce((sum, f) => sum + f.leads, 0), 1)) * 100).toFixed(1)
                  : 0}%
            </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Deal Size</p>
              <p className="text-2xl font-bold text-gray-900">
                LKR {revenueArray.length > 0 
                  ? (totalRevenue / revenueArray.reduce((sum, r) => sum + r.count, 0)).toLocaleString()
                  : 0}
              </p>
            </div>
            <ArrowRight className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Conversion Funnel by Source */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel by Source</h3>
        <div className="space-y-4">
          {funnelArray.map((funnel) => {
            const conversionRate = funnel.leads > 0 
              ? (funnel.closedWon / funnel.leads) * 100 
              : 0;
            
            return (
              <div key={funnel.source} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 capitalize">{funnel.source.replace('_', ' ')}</h4>
                    <p className="text-sm text-gray-600">LKR {funnel.totalRevenue.toLocaleString()} revenue</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{conversionRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">Conversion rate</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-5 gap-2 text-center text-sm">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="font-medium text-gray-900">{funnel.leads}</p>
                    <p className="text-xs text-gray-600">Leads</p>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <p className="font-medium text-blue-900">{funnel.qualified}</p>
                    <p className="text-xs text-blue-600">Qualified</p>
                  </div>
                  <div className="bg-purple-50 rounded p-2">
                    <p className="font-medium text-purple-900">{funnel.proposals}</p>
                    <p className="text-xs text-purple-600">Proposals</p>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <p className="font-medium text-green-900">{funnel.closedWon}</p>
                    <p className="text-xs text-green-600">Won</p>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <p className="font-medium text-red-900">{funnel.closedLost}</p>
                    <p className="text-xs text-red-600">Lost</p>
                  </div>
                </div>

                {/* Funnel visualization */}
                <div className="mt-3 flex gap-1">
                  {funnel.leads > 0 && (
                    <div 
                      className="h-2 bg-gray-400 rounded" 
                      style={{ width: `${(funnel.leads / funnel.leads) * 100}%` }}
                      title={`Leads: ${funnel.leads}`}
                    />
                  )}
                  {funnel.qualified > 0 && (
                    <div 
                      className="h-2 bg-blue-400 rounded" 
                      style={{ width: `${(funnel.qualified / funnel.leads) * 100}%` }}
                      title={`Qualified: ${funnel.qualified}`}
                    />
                  )}
                  {funnel.proposals > 0 && (
                    <div 
                      className="h-2 bg-purple-400 rounded" 
                      style={{ width: `${(funnel.proposals / funnel.leads) * 100}%` }}
                      title={`Proposals: ${funnel.proposals}`}
                    />
                  )}
                  {funnel.closedWon > 0 && (
                    <div 
                      className="h-2 bg-green-400 rounded" 
                      style={{ width: `${(funnel.closedWon / funnel.leads) * 100}%` }}
                      title={`Won: ${funnel.closedWon}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue by Attribution Source */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Attribution Source</h3>
        <div className="space-y-3">
          {revenueArray.map((item) => {
            const percentage = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;
            
            return (
              <div key={item.source} className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-600 capitalize">
                  {item.source.replace('_', ' ')}
                </div>
                <div className="flex-1">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-32 text-right">
                  <p className="font-semibold text-gray-900">LKR {item.revenue.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{percentage.toFixed(1)}% ({item.count} deals)</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
