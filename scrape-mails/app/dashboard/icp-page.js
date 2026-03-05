// app/dashboard/icp-page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import ICPLaunchWizard from '../components/icp-launch-wizard';
import BusinessKPIDashboard from '../components/business-kpi-dashboard';

export default function ICPPage() {
  const { user, loading } = useAuth();
  const [campaignLaunched, setCampaignLaunched] = useState(false);
  const [activeTab, setActiveTab] = useState('setup');

  useEffect(() => {
    // Check if user has active campaign
    if (user) {
      checkCampaignStatus();
    }
  }, [user]);

  const checkCampaignStatus = async () => {
    try {
      const response = await fetch(`/api/icp-config?userId=${user.uid}`);
      const data = await response.json();
      
      if (data.success && data.isConfigured) {
        setCampaignLaunched(true);
        setActiveTab('dashboard');
      }
    } catch (error) {
      console.error('Failed to check campaign status:', error);
    }
  };

  const handleCampaignLaunched = () => {
    setCampaignLaunched(true);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
          <p className="text-gray-600">Please sign in to access the B2B Growth Engine.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">B2B Growth Engine</h1>
              <p className="text-sm text-gray-600">Focused outreach for maximum conversion</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user.displayName || user.email}</span>
              <button
                onClick={() => {/* Add sign out logic */}}
                className="text-sm bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('setup')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'setup'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Campaign Setup
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              disabled={!campaignLaunched}
            >
              KPI Dashboard
            </button>
            <button
              onClick={() => setActiveTab('sequences')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sequences'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              disabled={!campaignLaunched}
            >
              Active Sequences
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              disabled={!campaignLaunched}
            >
              Email Templates
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'setup' && (
          <ICPLaunchWizard userId={user.uid} onLaunched={handleCampaignLaunched} />
        )}
        
        {activeTab === 'dashboard' && (
          <BusinessKPIDashboard userId={user.uid} />
        )}
        
        {activeTab === 'sequences' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Active Sequences</h3>
            <p className="text-gray-600">Sequence management dashboard coming soon...</p>
          </div>
        )}
        
        {activeTab === 'templates' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Email Templates</h3>
            <p className="text-gray-600">Template management interface coming soon...</p>
          </div>
        )}
      </div>

      {/* Quick Stats Bar */}
      {campaignLaunched && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex justify-between items-center text-sm">
              <div className="flex space-x-6">
                <span className="text-gray-600">
                  Campaign Status: <span className="font-medium text-green-600">Active</span>
                </span>
                <span className="text-gray-600">
                  Daily Sends: <span className="font-medium">25/50</span>
                </span>
                <span className="text-gray-600">
                  Reply Rate: <span className="font-medium text-blue-600">12.3%</span>
                </span>
              </div>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
              >
                View Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
