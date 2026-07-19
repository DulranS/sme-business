"use client";
import { useState, useMemo, lazy, Suspense } from "react";
import { useAuth } from "../lib/auth-context";
import LoginModal from "../components/auth/LoginModal";
import UserMenu from "../components/auth/UserMenu";
import AttributionFields from "../components/forms/AttributionFields";
import { useRecords, useCreateRecord, useDeleteRecord } from "../lib/hooks/useBookkeeping";
import { exportToCSV, exportAttributionReport, exportFinancialSummary, exportToJSON } from "../lib/utils/export";
import { 
  Plus, Pencil, Trash2, DollarSign, Download, RefreshCw,
  Calendar, BarChart3, Target, TrendingUp, LogIn, Brain, FileText, LineChart
} from "lucide-react";

// Lazy load dashboard components for better performance
const AttributionDashboard = lazy(() => import("../components/analytics/AttributionDashboard").then(mod => ({ default: mod.default })));
const BusinessIntelligenceDashboard = lazy(() => import("../components/analytics/BusinessIntelligenceDashboard").then(mod => ({ default: mod.default })));
const PredictiveAnalyticsDashboard = lazy(() => import("../components/analytics/PredictiveAnalyticsDashboard").then(mod => ({ default: mod.default })));

const categories = [
  "Inflow", "Outflow", "Reinvestment", "Overhead", "Loan Payment",
  "Loan Received", "Inventory Purchase", "Logistics", "Refund", "On Hold Cash"
];

const formatLKR = (amount) => {
  return new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

export default function BookkeepingApp() {
  const { user, loading: authLoading, firebaseAvailable } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" });
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    category: "Inflow",
    amount: "",
    cost_per_unit: "",
    quantity: "1",
    notes: "",
    customer: "",
    project: "",
    tags: "",
    attribution_source: "direct",
    conversion_stage: "closed_won",
    campaign_details: "",
  });

  // React Query hooks
  const { data: records = [], isLoading: recordsLoading, refetch } = useRecords(
    dateFilter.start,
    dateFilter.end
  );
  const createRecord = useCreateRecord();
  const deleteRecordMutation = useDeleteRecord();

  // Calculate totals
  const totals = useMemo(() => {
    let inflow = 0, outflow = 0, reinvestment = 0, overhead = 0;
    let loanPayment = 0, loanReceived = 0, logistics = 0, refund = 0, onHoldCash = 0;

    for (const r of records) {
      const amount = parseFloat(r.amount) || 0;
      const quantity = parseFloat(r.quantity) || 1;
      const totalAmount = amount * quantity;

      switch (r.category) {
        case "Inflow": inflow += totalAmount; break;
        case "Outflow": outflow += totalAmount; break;
        case "Reinvestment": reinvestment += totalAmount; break;
        case "Overhead": overhead += totalAmount; break;
        case "Loan Payment": loanPayment += totalAmount; break;
        case "Loan Received": loanReceived += totalAmount; break;
        case "Logistics": logistics += totalAmount; break;
        case "Refund": refund += totalAmount; break;
        case "On Hold Cash": onHoldCash += totalAmount; break;
      }
    }

    return { inflow, outflow, reinvestment, overhead, loanPayment, loanReceived, logistics, refund, onHoldCash };
  }, [records]);

  const netCashFlow = totals.inflow - totals.outflow - totals.overhead - totals.logistics - totals.loanPayment + totals.loanReceived + totals.refund;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        // Update logic would go here
        setIsEditing(null);
      } else {
        await createRecord.mutateAsync(formData);
      }
      setShowForm(false);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        description: "",
        category: "Inflow",
        amount: "",
        cost_per_unit: "",
        quantity: "1",
        notes: "",
        customer: "",
        project: "",
        tags: "",
        attribution_source: "direct",
        conversion_stage: "closed_won",
        campaign_details: "",
      });
    } catch (error) {
      console.error("Error saving record:", error);
      alert("Failed to save record");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this record?")) {
      try {
        await deleteRecordMutation.mutateAsync(id);
      } catch (error) {
        console.error("Error deleting record:", error);
        alert("Failed to delete record");
      }
    }
  };

  // Show login modal if not authenticated and Firebase is configured
  if (!authLoading && !user && firebaseAvailable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Bookkeeping App</h1>
            <p className="text-gray-600 mt-2">Advanced bookkeeping with attribution tracking</p>
          </div>
          <button
            onClick={() => setShowLoginModal(true)}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            Sign In to Continue
          </button>
          {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
        </div>
      </div>
    );
  }

  // If Firebase is not configured, show the app without authentication (development mode)
  if (!authLoading && !firebaseAvailable) {
    console.warn('Firebase is not configured. Running in development mode without authentication.');
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Bookkeeping App</h1>
                <p className="text-sm text-gray-600">Attribution-Enabled Financial Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto">
            {[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "records", label: "Records", icon: Calendar },
              { id: "attribution", label: "Attribution", icon: Target },
              { id: "intelligence", label: "Intelligence", icon: Brain },
              { id: "forecasting", label: "Forecasting", icon: LineChart },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Total Inflow</p>
                    <p className="text-2xl font-bold">LKR {formatLKR(totals.inflow)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 opacity-80" />
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Outflow</p>
                    <p className="text-2xl font-bold text-gray-900">LKR {formatLKR(totals.outflow)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-red-500" />
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Net Cash Flow</p>
                    <p className={`text-2xl font-bold ${netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                      LKR {formatLKR(netCashFlow)}
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Records</p>
                    <p className="text-2xl font-bold text-gray-900">{records.length}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-purple-500" />
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(totals).map(([key, value]) => (
                  <div key={key} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                    <p className="text-lg font-bold text-gray-900">LKR {formatLKR(value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "records" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Records</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => exportToCSV(records)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Record
                </button>
              </div>
            </div>

            {/* Date Filter */}
            <div className="bg-white border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={dateFilter.start}
                    onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={dateFilter.end}
                    onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Records List */}
            {recordsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {records.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{record.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{record.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{record.category}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            LKR {formatLKR(record.amount * (record.quantity || 1))}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                            {record.attribution_source?.replace('_', ' ') || 'direct'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setIsEditing(record.id);
                                  setFormData(record);
                                  setShowForm(true);
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(record.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "attribution" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Attribution & Conversion Analytics</h2>
              <button
                onClick={() => exportAttributionReport(records)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Export Report
              </button>
            </div>
            <Suspense fallback={<div className="p-4">Loading attribution data...</div>}>
              <AttributionDashboard startDate={dateFilter.start} endDate={dateFilter.end} />
            </Suspense>
          </div>
        )}

        {activeTab === "intelligence" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Business Intelligence</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => exportFinancialSummary(totals)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export Summary
                </button>
                <button
                  onClick={() => exportToJSON({ records, totals, metrics: { profitMargin: totals.inflow > 0 ? ((totals.inflow - totals.outflow) / totals.inflow) * 100 : 0 } })}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  Export JSON
                </button>
              </div>
            </div>
            <Suspense fallback={<div className="p-4">Loading intelligence data...</div>}>
              <BusinessIntelligenceDashboard startDate={dateFilter.start} endDate={dateFilter.end} />
            </Suspense>
          </div>
        )}

        {activeTab === "forecasting" && (
          <Suspense fallback={<div className="p-4">Loading forecasting data...</div>}>
            <PredictiveAnalyticsDashboard startDate={dateFilter.start} endDate={dateFilter.end} />
          </Suspense>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{isEditing ? "Edit" : "Add"} Record</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer (Optional)</label>
                  <input
                    type="text"
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project (Optional)</label>
                  <input
                    type="text"
                    value={formData.project}
                    onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <AttributionFields formData={formData} setFormData={setFormData} />

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {isEditing ? "Update" : "Add"} Record
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setIsEditing(null);
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
