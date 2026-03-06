// app/components/conversations-dashboard.js - Conversations tab for dashboard
'use client';
import { useState, useEffect } from 'react';

export default function ConversationsDashboard({ userId }) {
  const [activeTab, setActiveTab] = useState('replies');
  const [conversations, setConversations] = useState([]);
  const [hotLeads, setHotLeads] = useState([]);
  const [followUpQueue, setFollowUpQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchConversationsData();
    }
  }, [userId]);

  const fetchConversationsData = async () => {
    setLoading(true);
    try {
      // Fetch conversations with replies
      const [conversationsRes, hotLeadsRes, queueRes, statsRes] = await Promise.all([
        fetch(`/api/conversations?userId=${userId}`),
        fetch(`/api/conversations/hot-leads?userId=${userId}`),
        fetch(`/api/conversations/follow-up-queue?userId=${userId}`),
        fetch(`/api/conversations/stats?userId=${userId}`),
      ]);

      const [conversationsData, hotLeadsData, queueData, statsData] = await Promise.all([
        conversationsRes.json(),
        hotLeadsRes.json(),
        queueRes.json(),
        statsRes.json(),
      ]);

      setConversations(conversationsData.conversations || []);
      setHotLeads(hotLeadsData.hotLeads || []);
      setFollowUpQueue(queueData.queue || []);
      setStats(statsData.stats || {});
    } catch (error) {
      console.error('Error fetching conversations data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIntentColor = (intent) => {
    switch (intent) {
      case 'interested': return 'text-green-600 bg-green-50';
      case 'needs_more_info': return 'text-blue-600 bg-blue-50';
      case 'not_interested': return 'text-red-600 bg-red-50';
      case 'out_of_office': return 'text-yellow-600 bg-yellow-50';
      case 'unsubscribe': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'hot': return 'text-green-600 bg-green-50';
      case 'warm': return 'text-yellow-600 bg-yellow-50';
      case 'cold': return 'text-blue-600 bg-blue-50';
      case 'closed': return 'text-red-600 bg-red-50';
      case 'unsubscribed': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString() + ' ' + 
           new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      {/* Header Tabs - Responsive */}
      <div className="border-b border-gray-200">
        <div className="sm:hidden">
          {/* Mobile Dropdown */}
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="block w-full px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="replies">All Replies ({conversations.length})</option>
            <option value="hot">Hot Leads ({hotLeads.length})</option>
            <option value="queue">Follow-up Queue ({followUpQueue.length})</option>
            <option value="stats">Statistics</option>
          </select>
        </div>
        
        <nav className="hidden sm:flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('replies')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'replies'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="sm:inline">All Replies</span>
            <span className="ml-1 text-xs">({conversations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('hot')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'hot'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="sm:inline">Hot Leads</span>
            <span className="ml-1 text-xs">({hotLeads.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'queue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="sm:inline">Follow-up Queue</span>
            <span className="ml-1 text-xs">({followUpQueue.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Statistics
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === 'replies' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 px-2 sm:px-0">Leads with Replies</h3>
            
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {conversations.map((conv) => (
                <div key={conv.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{conv.company_name}</h4>
                      <p className="text-sm text-gray-600 truncate">{conv.contact_name}</p>
                      <p className="text-xs text-gray-400 truncate">{conv.email}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(conv.status)} ml-2`}>
                      {conv.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex space-x-2">
                      {conv.last_reply_intent && (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getIntentColor(conv.last_reply_intent)}`}>
                          {conv.last_reply_intent.replace('_', ' ')}
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {conv.total_replies} replies
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {conv.last_contacted_at ? formatDate(conv.last_contacted_at) : 'Never'}
                    </span>
                    <button
                      onClick={() => setSelectedConversation(conv)}
                      className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                    >
                      View Thread
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="hidden md:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="hidden lg:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Intent
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Replies
                      </th>
                      <th className="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Contact
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {conversations.map((conv) => (
                      <tr key={conv.id} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="truncate max-w-[120px] sm:max-w-none">{conv.company_name}</div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="truncate max-w-[120px] sm:max-w-none">{conv.contact_name}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[120px] sm:max-w-none">{conv.email}</div>
                        </td>
                        <td className="hidden md:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(conv.status)}`}>
                            {conv.status}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                          {conv.last_reply_intent && (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getIntentColor(conv.last_reply_intent)}`}>
                              {conv.last_reply_intent.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {conv.total_replies}
                        </td>
                        <td className="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {conv.last_contacted_at ? formatDate(conv.last_contacted_at) : 'Never'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedConversation(conv)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {conversations.length === 0 && (
              <div className="text-center py-8 text-gray-500 px-4">
                No conversations with replies yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'hot' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 px-2 sm:px-0">Hot Leads (Interested Replies)</h3>
            
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {hotLeads.map((lead) => (
                <div key={lead.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{lead.company_name}</h4>
                      <p className="text-sm text-gray-600 truncate">{lead.contact_name}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)} ml-2`}>
                      {lead.status}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-3">
                    <p>Replies: {lead.total_replies}</p>
                    <p>Last contact: {lead.last_contacted_at ? formatDate(lead.last_contacted_at) : 'Never'}</p>
                  </div>
                  
                  <button
                    onClick={() => setSelectedConversation(lead)}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded text-sm hover:bg-green-700"
                  >
                    View Conversation
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop Grid View */}
            <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hotLeads.map((lead) => (
                <div key={lead.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900 truncate">{lead.company_name}</h4>
                      <p className="text-sm text-gray-600">{lead.contact_name}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mb-2">
                    <p>Replies: {lead.total_replies}</p>
                    <p>Last contact: {lead.last_contacted_at ? formatDate(lead.last_contacted_at) : 'Never'}</p>
                  </div>
                  <button
                    onClick={() => setSelectedConversation(lead)}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded text-sm hover:bg-green-700"
                  >
                    View Conversation
                  </button>
                </div>
              ))}
            </div>
            
            {hotLeads.length === 0 && (
              <div className="text-center py-8 text-gray-500 px-4">
                No hot leads yet. Keep monitoring for interested replies!
              </div>
            )}
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 px-2 sm:px-0">Today's Follow-up Queue</h3>
            
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {followUpQueue.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{item.company_name}</h4>
                      <p className="text-sm text-gray-600 truncate">{item.contact_name}</p>
                      <p className="text-xs text-gray-400 truncate">{item.email}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'sent' ? 'bg-green-50 text-green-600' :
                      item.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-50 text-gray-600'
                    } ml-2`}>
                      {item.status}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-500 mb-3">
                    <p>Follow-up #{item.follow_up_number}</p>
                    <p>Scheduled: {formatDate(item.scheduled_for)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="hidden md:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Follow-up #
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Scheduled For
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {followUpQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="truncate max-w-[120px] sm:max-w-none">{item.company_name}</div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="truncate max-w-[120px] sm:max-w-none">{item.contact_name}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[120px] sm:max-w-none">{item.email}</div>
                        </td>
                        <td className="hidden md:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.follow_up_number}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="truncate max-w-[120px] sm:max-w-none">{formatDate(item.scheduled_for)}</div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'sent' ? 'bg-green-50 text-green-600' :
                            item.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {followUpQueue.length === 0 && (
              <div className="text-center py-8 text-gray-500 px-4">
                No follow-ups scheduled for today.
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 px-2 sm:px-0">Conversation Statistics</h3>
            
            {/* Responsive Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats?.totalLeads || 0}</div>
                <div className="text-xs sm:text-sm text-gray-500">Total Active Leads</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{stats?.interestedReplies || 0}</div>
                <div className="text-xs sm:text-sm text-gray-500">Interested Replies</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats?.totalReplies || 0}</div>
                <div className="text-xs sm:text-sm text-gray-500">Total Replies</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                <div className="text-xl sm:text-2xl font-bold text-purple-600">{stats?.averageFollowUps || 0}</div>
                <div className="text-xs sm:text-sm text-gray-500">Avg Follow-ups per Lead</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conversation Detail Modal - Responsive */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] sm:max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">{selectedConversation.company_name}</h3>
                  <p className="text-sm text-gray-600 truncate">{selectedConversation.contact_name} ({selectedConversation.email})</p>
                </div>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="ml-2 text-gray-400 hover:text-gray-500 flex-shrink-0"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 overflow-y-auto max-h-[70vh] sm:max-h-[60vh]">
              <div className="space-y-3 sm:space-y-4">
                {selectedConversation.conversations?.map((conv, index) => (
                  <div key={index} className={`border-l-4 ${
                    conv.message_type === 'outbound' ? 'border-blue-500 bg-blue-50' :
                    conv.message_type === 'inbound' ? 'border-green-500 bg-green-50' :
                    'border-purple-500 bg-purple-50'
                  } pl-3 sm:pl-4 py-2 sm:py-3`}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {conv.message_type === 'outbound' ? 'Sent' :
                         conv.message_type === 'inbound' ? 'Received' : 'AI Response'}
                      </span>
                      <span className="text-xs text-gray-500 mt-1 sm:mt-0">
                        {formatDate(conv.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mb-2">
                      <strong>Subject:</strong> <span className="break-words">{conv.subject}</span>
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {conv.body}
                    </div>
                    {conv.intent_classification && (
                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getIntentColor(conv.intent_classification)}`}>
                          {conv.intent_classification.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
