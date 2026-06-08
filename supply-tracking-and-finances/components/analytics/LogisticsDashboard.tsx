import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Truck, MapPin, Clock, DollarSign, Package, Warehouse, Plus, Search } from 'lucide-react';
import { logisticsService } from '@/lib/services/logistics';
import { Location } from '@/types';

export const LogisticsDashboard: React.FC = () => {
  const [origin, setOrigin] = useState<Partial<Location>>({});
  const [destination, setDestination] = useState<Partial<Location>>({});
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getQuotes = async () => {
    if (!origin.city || !destination.city) {
      alert('Please enter origin and destination cities');
      return;
    }

    setLoading(true);
    try {
      const originLocation: Location = {
        address: origin.address || '',
        city: origin.city || '',
        state: origin.state || '',
        zip: origin.zip || '',
        country: origin.country || 'USA',
      };

      const destinationLocation: Location = {
        address: destination.address || '',
        city: destination.city || '',
        state: destination.state || '',
        zip: destination.zip || '',
        country: destination.country || 'USA',
      };

      const shipmentQuotes = await logisticsService.getShipmentQuote(
        originLocation,
        destinationLocation,
        'shipping'
      );
      setQuotes(shipmentQuotes);
    } catch (error) {
      console.error('Error getting quotes:', error);
      alert('Error getting shipping quotes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Logistics & Fulfillment</h2>
          <p className="text-gray-600 mt-1">Manage shipping, carriers, and fulfillment workflows</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
          New Shipment
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Shipments</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
              <Truck className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Transit</p>
                <p className="text-2xl font-bold text-blue-600">8</p>
              </div>
              <Package className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Transit Time</p>
                <p className="text-2xl font-bold text-gray-900">3.2d</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">On-Time Rate</p>
                <p className="text-2xl font-bold text-green-600">94%</p>
              </div>
              <MapPin className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Shipping Quote Calculator */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Get Shipping Quotes</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Origin
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={origin.city || ''}
                  onChange={(e) => setOrigin({ ...origin, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={origin.state || ''}
                  onChange={(e) => setOrigin({ ...origin, state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="State"
                />
                <input
                  type="text"
                  value={origin.zip || ''}
                  onChange={(e) => setOrigin({ ...origin, zip: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="ZIP Code"
                />
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Destination
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={destination.city || ''}
                  onChange={(e) => setDestination({ ...destination, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={destination.state || ''}
                  onChange={(e) => setDestination({ ...destination, state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="State"
                />
                <input
                  type="text"
                  value={destination.zip || ''}
                  onChange={(e) => setDestination({ ...destination, zip: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="ZIP Code"
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={getQuotes}
              disabled={loading}
              icon={<Search className="w-4 h-4" />}
            >
              {loading ? 'Getting Quotes...' : 'Get Quotes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quote Results */}
      {quotes.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Available Carriers</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quotes.map((quote, index) => (
                <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{quote.carrier.name}</h4>
                      <p className="text-sm text-gray-600">{quote.carrier.type}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>Rating: {quote.carrier.rating}⭐</span>
                        <span>On-Time: {quote.carrier.onTimeRate}%</span>
                        <span>Shipments: {quote.carrier.totalShipments}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">${quote.estimatedCost.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">{quote.estimatedDays} days</p>
                      <Button variant="primary" size="sm" className="mt-2">
                        Select
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warehouse Capacity */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Warehouse Capacity</h3>
            <Button variant="secondary" icon={<Warehouse className="w-4 h-4" />}>
              View All Warehouses
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">LA Central Storage</h4>
                  <p className="text-sm text-gray-600">Los Angeles, CA</p>
                </div>
                <Badge variant="success">64% Full</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '64%' }}></div>
              </div>
              <p className="text-sm text-gray-600">320 / 500 units</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900">SF Fulfillment Center</h4>
                  <p className="text-sm text-gray-600">San Francisco, CA</p>
                </div>
                <Badge variant="warning">60% Full</Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
              <p className="text-sm text-gray-600">180 / 300 units</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
