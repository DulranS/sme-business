// app/dashboard/components/AiLeadEngine.jsx
'use client';

import { useState, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ✅ Your API keys (set these in Vercel environment variables)
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

export default function AiLeadEngine({ onLeadsGenerated, currentUser }) {
  const [isResearching, setIsResearching] = useState(false);
  const [status, setStatus] = useState('');
  const [industryFocus, setIndustryFocus] = useState('SaaS');
  const [fundingStage, setFundingStage] = useState('recent');
  const [customPrompt, setCustomPrompt] = useState('');

  // ✅ Generate social handles from business name
  const generateSocialHandle = (businessName, platform) => {
    if (!businessName) return null;
    let handle = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30);
    return handle;
  };

  // ✅ Open Instagram
  const handleOpenInstagram = (contact) => {
    if (!contact.business) return;
    const igHandle = generateSocialHandle(contact.business, 'instagram');
    if (igHandle) {
      window.open(`https://www.instagram.com/${igHandle}/`, '_blank');
    } else {
      window.open(`https://www.instagram.com/`, '_blank');
    }
  };

  // ✅ Open Twitter (X)
  const handleOpenTwitter = (contact) => {
    if (!contact.business) return;
    const twitterHandle = generateSocialHandle(contact.business, 'twitter');
    if (twitterHandle) {
      const tweetText = encodeURIComponent(`@${twitterHandle}`);
      window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
    } else {
      const query = encodeURIComponent(contact.business);
      window.open(`https://twitter.com/search?q=${query}&src=typed_query`, '_blank');
    }
  };

  // ✅ Generate Claude prompt for personalized email
  const generateClaudePrompt = useCallback((company) => {
    const basePrompt = `
You are a strategic outreach specialist for a boutique development agency that specializes in Next.js and Webflow hybrid solutions. 
Your task is to craft a highly personalized, compelling initial outreach email for ${company.name} based on their recent funding and business context.

COMPANY CONTEXT:
- Name: ${company.name}
- Industry: ${company.industry || 'technology'}
- Recent Funding: ${company.funding_amount ? `$${company.funding_amount}` : 'undisclosed amount'}
- Funding Date: ${company.funding_date || 'recently'}
- Description: ${company.description || 'growing technology company'}

YOUR SERVICE OFFERING:
"NEXT.JS + WEBFLOW HYBRID SPECIALIST
No-Code Automation Specialist
------------
What you ACTUALLY deliver (no buzzwords):
In 30-45 days, you give them:
• A high-converting website (Webflow for speed OR Next.js if they need custom logic)
• Lead capture + CRM setup (Forms → email → CRM → notifications)
• Basic automations (No manual follow-ups, no lost leads)
• Clean handover + optional monthly support
They don't buy tech. They buy 'less chaos + more leads.'"

CRAFT AN EMAIL THAT:
1. Mentions their specific funding round (congratulate them)
2. Identifies 1-2 specific pain points they likely face after funding (scaling website, lead capture, etc.)
3. Offers your service as the solution to those specific pain points
4. Uses a conversational tone (not salesy)
5. Includes a soft, low-pressure call-to-action
6. Keeps the email under 150 words
7. Uses strategic emojis for visual breaks (1-2 max)

OUTPUT FORMAT:
subject: [the subject line]
body: [the email body with line breaks preserved]
pain_points: [1-2 specific pain points identified]
`;

    return customPrompt ? customPrompt.replace('{{COMPANY_CONTEXT}}', company.name) : basePrompt;
  }, [customPrompt]);

  // ✅ Research recently funded companies
  const findRecentlyFundedCompanies = useCallback(async () => {
    try {
      const response = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': APOLLO_API_KEY
        },
        body: JSON.stringify({
          q_keywords: industryFocus,
          funding_stage: fundingStage === 'recent' ? ['series_a', 'series_b', 'seed', 'venture'] : [fundingStage],
          funding_date: {
            min: fundingStage === 'recent' ? 
              new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 
              undefined
          },
          page: 1,
          per_page: 10
        })
      });

      const data = await response.json();
      return data.companies || [];
    } catch (error) {
      console.error('Apollo API error:', error);
      setStatus(`❌ Failed to find companies: ${error.message}`);
      return [];
    }
  }, [industryFocus, fundingStage]);

  // ✅ Find email with Hunter
  const findEmailWithHunter = useCallback(async (domain) => {
    try {
      const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}`);
      const data = await response.json();
      return data.data.emails?.[0]?.value || null;
    } catch (error) {
      console.error('Hunter API error:', error);
      return null;
    }
  }, []);

  // ✅ Generate personalized email using Claude 3.5
  const generatePersonalizedEmail = useCallback(async (company) => {
    try {
      // Build the prompt
      const prompt = generateClaudePrompt(company);
      
      // Use Claude 3.5 Sonnet via Anthropic API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const content = data.content?.[0]?.text || '';
      
      // Parse the response
      const subjectMatch = content.match(/subject:\s*(.+?)\n/i);
      const bodyMatch = content.match(/body:\s*([\s\S]+)/i);
      
      if (subjectMatch && bodyMatch) {
        return {
          subject: subjectMatch[1].trim(),
          body: bodyMatch[1].trim(),
          company: company.name,
          pain_points: content.match(/pain_points:\s*([\s\S]+)/i)?.[1]?.trim() || 'Scaling website, lead capture'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Claude API error:', error);
      return null;
    }
  }, [generateClaudePrompt]);

  // ✅ Research and generate leads
  const generateLeads = useCallback(async () => {
    if (!CLAUDE_API_KEY || !APOLLO_API_KEY || !HUNTER_API_KEY) {
      alert('Please configure API keys in your environment variables');
      return;
    }
    
    setIsResearching(true);
    setStatus('🔍 Researching recently funded companies...');
    
    try {
      // Step 1: Find recently funded companies
      const companies = await findRecentlyFundedCompanies();
      
      if (companies.length === 0) {
        setStatus('⚠️ No companies found. Try adjusting filters.');
        setIsResearching(false);
        return;
      }
      
      setStatus(`✅ Found ${companies.length} companies. Researching and crafting personalized emails...`);
      
      // Step 2: Process each company - get email and generate personalized content
      const researchedLeads = [];
      
      for (const company of companies) {
        // Get domain from website URL
        const domain = company.website_url?.replace(/^https?:\/\//, '').split('/')[0] || 
                      company.name.toLowerCase().replace(/\s+/g, '') + '.com';
        
        // Find email
        const email = await findEmailWithHunter(domain);
        
        // Generate personalized email
        const emailContent = await generatePersonalizedEmail(company);
        
        if (emailContent) {
          researchedLeads.push({
            business_name: company.name,
            email: email || `ceo@${domain}`,
            website: company.website_url || `https://${domain}`,
            industry: company.industry || industryFocus,
            funding_amount: company.funding_amount,
            funding_date: company.funding_date,
            lead_quality: 'HOT',
            email_subject: emailContent.subject,
            email_body: emailContent.body,
            personalized_notes: emailContent.pain_points
          });
          
          setStatus(`✅ Researched ${company.name} (${researchedLeads.length}/${companies.length})`);
        }
      }
      
      // Step 3: Format leads for CSV
      if (researchedLeads.length > 0) {
        const headers = [
          'business_name', 'email', 'website', 'industry', 
          'funding_amount', 'funding_date', 'lead_quality',
          'email_subject', 'email_body', 'personalized_notes'
        ];
        
        const csvRows = researchedLeads.map(lead => 
          headers.map(h => `"${lead[h] || ''}"`).join(',')
        );
        
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        
        // Pass back to parent component
        onLeadsGenerated({
          leads: researchedLeads,
          csvContent,
          researchDate: new Date().toISOString()
        });
        
        setStatus(`🎉 Successfully generated ${researchedLeads.length} AI-researched leads! Loading into dashboard...`);
      } else {
        setStatus('❌ Failed to generate leads. Please try again or adjust filters.');
      }
    } catch (error) {
      console.error('Lead generation error:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsResearching(false);
    }
  }, [findRecentlyFundedCompanies, findEmailWithHunter, generatePersonalizedEmail, onLeadsGenerated, industryFocus]);

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
      <h2 className="text-xl font-bold mb-4 text-white">🤖 AI Lead Generator</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-200">Industry Focus</label>
          <input
            type="text"
            value={industryFocus}
            onChange={(e) => setIndustryFocus(e.target.value)}
            className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded"
            placeholder="e.g., Fintech, SaaS, Healthcare"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-200">Funding Stage</label>
          <select
            value={fundingStage}
            onChange={(e) => setFundingStage(e.target.value)}
            className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded"
          >
            <option value="recent">Recently Funded (Last 90 days)</option>
            <option value="series_a">Series A+</option>
            <option value="seed">Seed Round</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-200">Custom Prompt (Optional)</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded"
            placeholder="Customize the AI prompt. Use {{COMPANY_CONTEXT}} as placeholder."
            rows="3"
          />
          <p className="text-xs text-gray-400 mt-1">
            Default prompt is optimized for SaaS/tech companies. Customize to match your niche.
          </p>
        </div>
        
        <button
          onClick={generateLeads}
          disabled={isResearching}
          className={`w-full py-3 rounded-lg font-bold ${
            isResearching 
              ? 'bg-blue-700 cursor-not-allowed' 
              : 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white'
          }`}
        >
          {isResearching ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Researching Companies...
            </>
          ) : (
            '🚀 Generate AI-Researched Leads'
          )}
        </button>
        
        {status && (
          <div className={`p-3 rounded mt-2 text-sm whitespace-pre-line ${
            status.includes('✅') ? 'bg-green-900/30 text-green-300 border border-green-700' :
            status.includes('❌') ? 'bg-red-900/30 text-red-300 border border-red-700' :
            status.includes('⚠️') ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700' :
            'bg-blue-900/30 text-blue-300 border border-blue-700'
          }`}>
            {status}
          </div>
        )}
        
        <div className="border-t border-gray-700 pt-3 mt-3 text-xs text-gray-400">
          <p>✨ Powered by Claude 3.5 Sonnet - The world's most capable AI model for personalized outreach</p>
          <p>💡 Pro Tip: Use the "Recently Funded" filter for highest conversion rates - companies with fresh capital are 3.2x more likely to invest in tools that drive growth</p>
        </div>
      </div>
    </div>
  );
}