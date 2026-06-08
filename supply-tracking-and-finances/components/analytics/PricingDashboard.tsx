import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle, Search, RefreshCw } from 'lucide-react';
import { pricingService } from '@/lib/services/pricing';
import { ValuationRequest, ValuationResult } from '@/types';

export const PricingDashboard: React.FC = () => {
  const [valuationRequest, setValuationRequest] = useState<Partial<ValuationRequest>>({
    category: '',
    description: '',
    condition: 'good',
  });
  const [valuationResult, setValuationResult] = useState<ValuationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValuation = async () => {
    if (!valuationRequest.category || !valuationRequest.description) {
      alert('Please fill in at least category and description');
      return;
    }

    setLoading(true);
    try {
      const request: ValuationRequest = {
        itemId: `item-${Date.now()}`,
        category: valuationRequest.category!,
        description: valuationRequest.description!,
        year: valuationRequest.year,
        make: valuationRequest.make,
        model: valuationRequest.model,
        mileage: valuationRequest.mileage,
        condition: valuationRequest.condition || 'good',
        currentPrice: valuationRequest.currentPrice,
      };

      const result = await pricingService.getValuation(request);
      setValuationResult(result);
    } catch (error) {
      console.error('Error getting valuation:', error);
      alert('Error getting valuation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pricing & Valuation</h2>
          <p className="text-gray-600 mt-1">Automated market comparison and pricing intelligence</p>
        </div>
        <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />}>
          Refresh Data
        </Button>
      </div>

      {/* Valuation Form */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Get Item Valuation</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
              <input
                type="text"
                value={valuationRequest.category || ''}
                onChange={(e) => setValuationRequest({ ...valuationRequest, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Vehicle, Electronics, Equipment"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
              <select
                value={valuationRequest.condition || 'good'}
                onChange={(e) => setValuationRequest({ ...valuationRequest, condition: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year (if applicable)</label>
              <input
                type="number"
                value={valuationRequest.year || ''}
                onChange={(e) => setValuationRequest({ ...valuationRequest, year: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2020"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mileage (if applicable)</label>
              <input
                type="number"
                value={valuationRequest.mileage || ''}
                onChange={(e) => setValuationRequest({ ...valuationRequest, mileage: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 50000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Make (if applicable)</label>
              <input
                type="text"
                value={valuationRequest.make || ''}
                onChange={(e) => setValuationRequest({ ...valuationRequest, make: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Toyota"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model (if applicable)</label>
              <input
                type="text"
                value={valuationRequest.model || ''}
                onChange={(e) => setValuationRequest({ ...valuationRequest, model: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Camry"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
              <textarea
                value={valuationRequest.description || ''}
                onChange={(e) => setValuationRequest({ ...valuationRequest, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Detailed description of the item..."
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={handleValuation}
              disabled={loading}
              icon={<Search className="w-4 h-4" />}
            >
              {loading ? 'Analyzing Market...' : 'Get Valuation'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Valuation Results */}
      {valuationResult && (
        <div className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Market Value</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${valuationResult.marketValue.toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Suggested Buy Price</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${valuationResult.suggestedBuyPrice.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Suggested Sell Price</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${valuationResult.suggestedSellPrice.toLocaleString()}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit Margin */}
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expected Profit Margin</p>
                  <p className={`text-3xl font-bold ${valuationResult.profitMargin >= 20 ? 'text-green-600' : valuationResult.profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {valuationResult.profitMargin.toFixed(1)}%
                  </p>
                </div>
                <Badge variant={valuationResult.riskAssessment === 'low' ? 'success' : valuationResult.riskAssessment === 'medium' ? 'warning' : 'danger'}>
                  Risk: {valuationResult.riskAssessment}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {valuationResult.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {valuationResult.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                      <span className="text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Market Comparables */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Market Comparables</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {valuationResult.marketComps.comparableItems.map((item) => (
                  <div key={item.id} className="p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.title}</h4>
                        <p className="text-sm text-gray-600">{item.location}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.source} • {new Date(item.listingDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">${item.price.toLocaleString()}</p>
                        <Badge variant="default" size="sm">{item.condition}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
