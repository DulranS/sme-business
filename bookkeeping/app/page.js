"use client";
import { useState } from 'react';
import { Plus, Pencil, Trash2, DollarSign, Download, TrendingUp, TrendingDown } from 'lucide-react';

export default function BookkeepingApp() {
  const [records, setRecords] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
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
    if (records.length === 0) {
      alert('No records to export');
      return;
    }

    const headers = ['Date', 'Description', 'Category', 'Amount (LKR)', 'Notes'];
    const csvData = records.map(r => [
      r.date,
      `"${r.description}"`,
      r.category,
      r.amount,
      `"${r.notes || ''}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookkeeping_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const totals = records.reduce((acc, r) => {
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

  const formatLKR = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-md p-6 mb-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <DollarSign className="w-8 h-8" />
                SME Bookkeeping Dashboard
              </h1>
              <p className="text-blue-100">Comprehensive cash flow and profitability tracking</p>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-md hover:bg-blue-50 transition-colors font-semibold"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border-l-4 border-green-500 rounded-lg shadow p-4">
            <p className="text-xs text-gray-600 font-medium uppercase mb-1">Total Inflows</p>
            <p className="text-2xl font-bold text-green-700">LKR {formatLKR(totals.inflow)}</p>
            <p className="text-xs text-gray-500 mt-1">Revenue & Income</p>
          </div>
          
          <div className="bg-white border-l-4 border-red-500 rounded-lg shadow p-4">
            <p className="text-xs text-gray-600 font-medium uppercase mb-1">Total Outflows</p>
            <p className="text-2xl font-bold text-red-700">LKR {formatLKR(totals.outflow)}</p>
            <p className="text-xs text-gray-500 mt-1">Direct Costs (COGS)</p>
          </div>

          <div className="bg-white border-l-4 border-purple-500 rounded-lg shadow p-4">
            <p className="text-xs text-gray-600 font-medium uppercase mb-1">Gross Profit</p>
            <p className="text-2xl font-bold text-purple-700">LKR {formatLKR(grossProfit)}</p>
            <p className="text-xs text-gray-500 mt-1">Margin: {grossMarginPercent.toFixed(1)}%</p>
          </div>

          <div className={`bg-white border-l-4 ${netProfit >= 0 ? 'border-blue-500' : 'border-orange-500'} rounded-lg shadow p-4`}>
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

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 font-medium mb-2">Overhead Expenses</p>
            <p className="text-xl font-bold text-gray-800">LKR {formatLKR(totals.overhead)}</p>
            <p className="text-xs text-gray-500 mt-1">Rent, salaries, utilities, etc.</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 font-medium mb-2">Reinvestment</p>
            <p className="text-xl font-bold text-gray-800">LKR {formatLKR(totals.reinvestment)}</p>
            <p className="text-xs text-gray-500 mt-1">Equipment, growth, expansion</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 font-medium mb-2">Net Loan Impact</p>
            <p className={`text-xl font-bold ${netLoanImpact >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              LKR {formatLKR(Math.abs(netLoanImpact))}
            </p>
            <p className="text-xs text-gray-500 mt-1">Received: {formatLKR(totals.loanReceived)} | Paid: {formatLKR(totals.loanPayment)}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Profitability Formula:</h3>
          <div className="text-sm text-blue-800 font-mono">
            Net Profit = (Inflows - Outflows) - Overhead - Reinvestment + (Loans Received - Loan Payments)
          </div>
          <div className="text-sm text-blue-700 mt-2">
            <strong>Gross Margin:</strong> {grossMarginPercent.toFixed(1)}% | 
            <strong className="ml-2">Operating Profit:</strong> LKR {formatLKR(operatingProfit)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6" style={{ breakInside: 'avoid',color:"black" }}>
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
            <h2 className="text-xl font-semibold text-gray-800">Transaction History ({records.length})</h2>
          </div>
          {records.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg mb-2">No transactions yet</p>
              <p className="text-sm">Start tracking your business finances by adding your first transaction above</p>
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
                  {records.sort((a, b) => new Date(b.date) - new Date(a.date)).map((record, index) => {
                    const actualIndex = records.findIndex(r => r.id === record.id);
                    return (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{record.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{record.description}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                            record.category === 'Inflow' ? 'bg-green-100 text-green-800' :
                            record.category === 'Outflow' ? 'bg-red-100 text-red-800' :
                            record.category === 'Overhead' ? 'bg-orange-100 text-orange-800' :
                            record.category === 'Reinvestment' ? 'bg-purple-100 text-purple-800' :
                            record.category === 'Loan Received' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {record.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                          {formatLKR(parseFloat(record.amount))}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.notes || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(actualIndex)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(actualIndex)}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
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