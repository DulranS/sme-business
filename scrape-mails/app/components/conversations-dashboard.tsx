// app/components/conversations-dashboard.tsx - Conversations tab for dashboard
'use client';
import { useState, useEffect } from 'react';

interface Conversation {
  id: string;
  lead_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  status: string;
  last_reply_intent?: string;
  total_replies: number;
  follow_up_count: number;
  last_contacted_at: string;
  conversations: Array<{
    message_type: string;
    subject: string;
    body: string;
    intent_classification?: string;
    ai_response_sent: boolean;
    created_at: string;
  }>;
}

interface FollowUpItem {
  id: string;
  lead_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  scheduled_for: string;
  follow_up_number: number;
  status: string;
}

export default function ConversationsDashboard({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<'replies' | 'hot' | 'queue' | 'stats'>('replies');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hotLeads, setHotLeads] = useState<Conversation[]>([]);
  const [followUpQueue, setFollowUpQueue] = useState<FollowUpItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

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

  const getIntentColor = (intent?: string) => {
    switch (intent) {
      case 'interested': return 'text-green-600 bg-green-50';
      case 'needs_more_info': return 'text-blue-600 bg-blue-50';
      case 'not_interested': return 'text-red-600 bg-red-50';
      case 'out_of_office': return 'text-yellow-600 bg-yellow-50';
      case 'unsubscribe': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'text-green-600 bg-green-50';
      case 'warm': return 'text-yellow-600 bg-yellow-50';
      case 'cold': return 'text-blue-600 bg-blue-50';
      case 'closed': return 'text-red-600 bg-red-50';
      case 'unsubscribed': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateString: string) => {
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
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('replies')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'replies'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Replies ({conversations.length})
          </button>
          <button
            onClick={() => setActiveTab('hot')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'hot'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Hot Leads ({hotLeads.length})
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'queue'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Follow-up Queue ({followUpQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
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
            <h3 className="text-lg font-medium text-gray-900">Leads with Replies</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Intent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Replies
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {conversations.map((conv) => (
                    <tr key={conv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {conv.company_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conv.contact_name}
                        <div className="text-xs text-gray-400">{conv.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(conv.status)}`}>
                          {conv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {conv.last_reply_intent && (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getIntentColor(conv.last_reply_intent)}`}>
                            {conv.last_reply_intent.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conv.total_replies}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conv.last_contacted_at ? formatDate(conv.last_contacted_at) : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedConversation(conv)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Thread
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {conversations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No conversations with replies yet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'hot' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Hot Leads (Interested Replies)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hotLeads.map((lead) => (
                <div key={lead.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{lead.company_name}</h4>
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
              <div className="text-center py-8 text-gray-500">
                No hot leads yet. Keep monitoring for interested replies!
              </div>
            )}
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Today's Follow-up Queue</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Follow-up #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scheduled For
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {followUpQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.company_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.contact_name}
                        <div className="text-xs text-gray-400">{item.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.follow_up_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(item.scheduled_for)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
              {followUpQueue.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No follow-ups scheduled for today.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Conversation Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-2xl font-bold text-gray-900">{stats.totalLeads || 0}</div>
                <div className="text-sm text-gray-500">Total Active Leads</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-2xl font-bold text-green-600">{stats.interestedReplies || 0}</div>
                <div className="text-sm text-gray-500">Interested Replies</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-2xl font-bold text-blue-600">{stats.totalReplies || 0}</div>
                <div className="text-sm text-gray-500">Total Replies</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="text-2xl font-bold text-purple-600">{stats.averageFollowUps || 0}</div>
                <div className="text-sm text-gray-500">Avg Follow-ups per Lead</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{selectedConversation.company_name}</h3>
                  <p className="text-sm text-gray-600">{selectedConversation.contact_name} ({selectedConversation.email})</p>
                </div>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {selectedConversation.conversations.map((conv, index) => (
                  <div key={index} className={`border-l-4 ${
                    conv.message_type === 'outbound' ? 'border-blue-500 bg-blue-50' :
                    conv.message_type === 'inbound' ? 'border-green-500 bg-green-50' :
                    'border-purple-500 bg-purple-50'
                  } pl-4 py-2`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {conv.message_type === 'outbound' ? 'Sent' :
                         conv.message_type === 'inbound' ? 'Received' : 'AI Response'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(conv.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mb-1">
                      <strong>Subject:</strong> {conv.subject}
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
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
