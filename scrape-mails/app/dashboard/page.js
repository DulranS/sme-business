'use client';

import { useEffect, useState } from 'react';

const TAB_OUTREACH = 'outreach';
const TAB_AI_CONVERSATIONS = 'ai';

function StatCard({ label, value }) {
  return (
    <div className="card">
      <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Badge({ children, tone = 'default' }) {
  const colors =
    tone === 'hot'
      ? { bg: 'rgba(34,197,94,0.1)', color: '#16a34a' }
      : tone === 'intent'
      ? { bg: 'rgba(59,130,246,0.1)', color: '#2563eb' }
      : { bg: 'rgba(148,163,184,0.15)', color: '#6b7280' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.color,
      }}
    >
      {children}
    </span>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(TAB_AI_CONVERSATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    leadsWithReplies: [],
    hotLeads: [],
    followupToday: [],
    stats: {
      totalReplies: 0,
      interestedCount: 0,
      aiResolutionRate: 0,
      followupsSent: 0,
    },
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/api/ai-conversations');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load AI conversations');
        }
        const json = await res.json();
        if (mounted) {
          setData({
            leadsWithReplies: json.leadsWithReplies || [],
            hotLeads: json.hotLeads || [],
            followupToday: json.followupToday || [],
            stats: json.stats || data.stats,
          });
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          console.error('[dashboard] Failed to load AI conversations', e);
          setError(e.message || 'Failed to load AI conversations');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { stats, leadsWithReplies, hotLeads, followupToday } = data;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '32px',
        backgroundColor: '#f1f5f9',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <header style={{ marginBottom: '24px' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              marginBottom: 4,
              color: '#0f172a',
            }}
          >
            Mails2Leads Dashboard
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            Track outreach, AI-powered conversations, and follow-up queue.
          </p>
        </header>

        {/* Tabs */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: '#e5e7eb',
            borderRadius: 999,
            padding: 4,
            marginBottom: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab(TAB_OUTREACH)}
            style={{
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor:
                activeTab === TAB_OUTREACH ? '#ffffff' : 'transparent',
              color: activeTab === TAB_OUTREACH ? '#111827' : '#4b5563',
              boxShadow:
                activeTab === TAB_OUTREACH
                  ? '0 1px 3px rgba(0,0,0,0.1)'
                  : 'none',
            }}
          >
            Outreach & Sending
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(TAB_AI_CONVERSATIONS)}
            style={{
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor:
                activeTab === TAB_AI_CONVERSATIONS ? '#ffffff' : 'transparent',
              color:
                activeTab === TAB_AI_CONVERSATIONS ? '#111827' : '#4b5563',
              boxShadow:
                activeTab === TAB_AI_CONVERSATIONS
                  ? '0 1px 3px rgba(0,0,0,0.1)'
                  : 'none',
            }}
          >
            AI Conversations
          </button>
        </div>

        {activeTab === TAB_OUTREACH && (
          <div className="card">
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Outreach & Sending
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              Use the main interface to upload CSVs, configure templates, and
              launch email campaigns. This tab is a placeholder to keep the
              original UX separate from the new AI Conversations view.
            </p>
          </div>
        )}

        {activeTab === TAB_AI_CONVERSATIONS && (
          <>
            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16,
                marginBottom: 24,
              }}
            >
              <StatCard label="Total Replies" value={stats.totalReplies || 0} />
              <StatCard
                label="Interested Leads"
                value={stats.interestedCount || 0}
              />
              <StatCard
                label="AI Resolution Rate"
                value={`${stats.aiResolutionRate || 0}%`}
              />
              <StatCard
                label="Follow-ups Sent"
                value={stats.followupsSent || 0}
              />
            </div>

            {/* Error / loading */}
            {loading && (
              <div className="card">
                <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                  Loading AI conversations...
                </p>
              </div>
            )}
            {error && !loading && (
              <div className="card">
                <p style={{ fontSize: '0.9rem', color: '#b91c1c' }}>{error}</p>
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Hot leads */}
                <div className="card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 600,
                      }}
                    >
                      Hot Leads
                    </h2>
                    <Badge tone="hot">
                      {hotLeads.length} hot{' '}
                      {hotLeads.length === 1 ? 'lead' : 'leads'}
                    </Badge>
                  </div>
                  {hotLeads.length === 0 ? (
                    <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                      No hot leads yet. Once AI classifies replies as
                      "interested", they will appear here.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '0.85rem',
                        }}
                      >
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                            <th style={{ padding: '8px 4px' }}>Business</th>
                            <th style={{ padding: '8px 4px' }}>Email</th>
                            <th style={{ padding: '8px 4px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hotLeads.map((lead) => (
                            <tr key={lead.id}>
                              <td style={{ padding: '6px 4px' }}>
                                {lead.business_name || 'Unnamed'}
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                {lead.email || '—'}
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                <Badge tone="hot">hot</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Follow-up queue */}
                <div className="card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 600,
                      }}
                    >
                      Follow-up Queue (Today)
                    </h2>
                    <Badge>
                      {followupToday.length}{' '}
                      {followupToday.length === 1 ? 'lead' : 'leads'} due today
                    </Badge>
                  </div>
                  {followupToday.length === 0 ? (
                    <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                      No follow-ups scheduled for today.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '0.85rem',
                        }}
                      >
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                            <th style={{ padding: '8px 4px' }}>Business</th>
                            <th style={{ padding: '8px 4px' }}>Email</th>
                            <th style={{ padding: '8px 4px' }}>Follow-up #</th>
                            <th style={{ padding: '8px 4px' }}>Lead status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {followupToday.map((item) => (
                            <tr key={item.id}>
                              <td style={{ padding: '6px 4px' }}>
                                {item.leads?.business_name || 'Unnamed'}
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                {item.leads?.email || '—'}
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                #{item.follow_up_number}
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                <Badge>
                                  {item.leads?.status || 'cold'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* All AI conversations table */}
                <div className="card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <h2
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 600,
                      }}
                    >
                      AI Conversations
                    </h2>
                    <Badge>
                      {leadsWithReplies.length}{' '}
                      {leadsWithReplies.length === 1 ? 'reply' : 'replies'}
                    </Badge>
                  </div>
                  {leadsWithReplies.length === 0 ? (
                    <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                      Once replies come in, AI will classify intent and list
                      them here.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '0.85rem',
                        }}
                      >
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                            <th style={{ padding: '8px 4px' }}>Business</th>
                            <th style={{ padding: '8px 4px' }}>Email</th>
                            <th style={{ padding: '8px 4px' }}>Intent</th>
                            <th style={{ padding: '8px 4px' }}>AI Response</th>
                            <th style={{ padding: '8px 4px' }}>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadsWithReplies.map((row) => {
                            const lead = row.leads || {};
                            const preview =
                              (row.ai_reply || '').slice(0, 120) +
                              (row.ai_reply && row.ai_reply.length > 120
                                ? '…'
                                : '');
                            const date = row.sent_at
                              ? new Date(row.sent_at).toLocaleString()
                              : '—';
                            return (
                              <tr key={row.id}>
                                <td style={{ padding: '6px 4px' }}>
                                  {lead.business_name || 'Unnamed'}
                                </td>
                                <td style={{ padding: '6px 4px' }}>
                                  {lead.email || '—'}
                                </td>
                                <td style={{ padding: '6px 4px' }}>
                                  <Badge tone="intent">{row.intent}</Badge>
                                </td>
                                <td
                                  style={{
                                    padding: '6px 4px',
                                    maxWidth: 320,
                                  }}
                                >
                                  <span
                                    style={{
                                      color: '#4b5563',
                                      whiteSpace: 'nowrap',
                                      textOverflow: 'ellipsis',
                                      overflow: 'hidden',
                                      display: 'block',
                                    }}
                                  >
                                    {preview || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 4px' }}>{date}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

