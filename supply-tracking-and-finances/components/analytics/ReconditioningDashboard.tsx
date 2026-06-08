import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Wrench, Shield, AlertTriangle, Clock, DollarSign, Plus, FileText } from 'lucide-react';
import { reconditioningService } from '@/lib/services/reconditioning';

export const ReconditioningDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'projects' | 'warranty' | 'returns'>('projects');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reconditioning & Warranty</h2>
          <p className="text-gray-600 mt-1">Manage repairs, warranty claims, and returns</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
          New Project
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">5</p>
              </div>
              <Wrench className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Warranty Claims</p>
                <p className="text-2xl font-bold text-yellow-600">3</p>
              </div>
              <Shield className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Return Requests</p>
                <p className="text-2xl font-bold text-red-600">2</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Repair Cost</p>
                <p className="text-2xl font-bold text-gray-900">$1,250</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'projects'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Reconditioning Projects
          </button>
          <button
            onClick={() => setActiveTab('warranty')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'warranty'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Warranty Claims
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'returns'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Returns
          </button>
        </nav>
      </div>

      {/* Reconditioning Projects Tab */}
      {activeTab === 'projects' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Active Reconditioning Projects</h3>
              <Button variant="secondary" icon={<FileText className="w-4 h-4" />}>
                Generate Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Mock Project */}
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Engine Rebuild - 2018 Toyota Camry</h4>
                    <p className="text-sm text-gray-600">Order #12345</p>
                  </div>
                  <Badge variant="warning">In Progress</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Estimated Cost</p>
                    <p className="font-medium">$2,500</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Progress</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-600">Target Date</p>
                    <p className="font-medium">Jun 15, 2026</p>
                  </div>
                </div>
              </div>

              {/* Another Mock Project */}
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Cosmetic Repair - 2020 Honda Civic</h4>
                    <p className="text-sm text-gray-600">Order #12346</p>
                  </div>
                  <Badge variant="danger">On Hold</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Estimated Cost</p>
                    <p className="font-medium">$800</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Progress</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div className="bg-red-500 h-2 rounded-full" style={{ width: '30%' }}></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-600">Target Date</p>
                    <p className="font-medium">Jun 20, 2026</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warranty Claims Tab */}
      {activeTab === 'warranty' && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Warranty Claims</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Mock Warranty Claim */}
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Transmission Failure</h4>
                    <p className="text-sm text-gray-600">Order #12340 • Claim #W-001</p>
                  </div>
                  <Badge variant="warning">Investigating</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Reported</p>
                    <p className="font-medium">Jun 5, 2026</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Severity</p>
                    <Badge variant="danger" size="sm">Critical</Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Estimated Cost</p>
                    <p className="font-medium">$3,200</p>
                  </div>
                </div>
              </div>

              {/* Another Mock Claim */}
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Electrical System Issue</h4>
                    <p className="text-sm text-gray-600">Order #12338 • Claim #W-002</p>
                  </div>
                  <Badge variant="success">Approved</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Reported</p>
                    <p className="font-medium">Jun 3, 2026</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Severity</p>
                    <Badge variant="warning" size="sm">Medium</Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Deductible</p>
                    <p className="font-medium">$100</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Returns Tab */}
      {activeTab === 'returns' && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Return Requests</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Mock Return Request */}
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Defective Part Return</h4>
                    <p className="text-sm text-gray-600">Order #12335 • Return #R-001</p>
                  </div>
                  <Badge variant="warning">In Transit</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Reason</p>
                    <p className="font-medium">Defective on arrival</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Condition</p>
                    <Badge variant="danger" size="sm">Defective</Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Refund Amount</p>
                    <p className="font-medium">$450</p>
                  </div>
                </div>
              </div>

              {/* Another Mock Return */}
              <div className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Wrong Item Shipped</h4>
                    <p className="text-sm text-gray-600">Order #12332 • Return #R-002</p>
                  </div>
                  <Badge variant="success">Refunded</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Reason</p>
                    <p className="font-medium">Wrong item received</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Condition</p>
                    <Badge variant="success" size="sm">New</Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Refund Amount</p>
                    <p className="font-medium">$1,200</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
