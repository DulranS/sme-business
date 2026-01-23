// app/api/ai-lead-research/route.js
// ✅ SECURITY: Server-side API route for AI lead research (prevents API key exposure)
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { industryFocus, fundingStage, customPrompt } = await req.json();

    // ✅ SECURITY: Input validation
    if (!industryFocus || typeof industryFocus !== 'string' || industryFocus.length > 100) {
      return NextResponse.json({ error: 'Invalid industry focus' }, { status: 400 });
    }

    if (fundingStage && typeof fundingStage !== 'string') {
      return NextResponse.json({ error: 'Invalid funding stage' }, { status: 400 });
    }

    // ✅ SECURITY: Get API keys from server-side environment variables
    const apolloApiKey = process.env.APOLLO_API_KEY;
    const hunterApiKey = process.env.HUNTER_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;

    if (!apolloApiKey || !hunterApiKey || !claudeApiKey) {
      return NextResponse.json({ 
        error: 'API keys not configured' 
      }, { status: 500 });
    }

    // ✅ SECURITY: Find recently funded companies via Apollo (server-side)
    const apolloResponse = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apolloApiKey
      },
      body: JSON.stringify({
        q_keywords: industryFocus.substring(0, 100),
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

    if (!apolloResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to fetch companies from Apollo API' 
      }, { status: apolloResponse.status });
    }

    const apolloData = await apolloResponse.json();
    const companies = apolloData.companies || [];

    // ✅ SECURITY: Process companies and find emails (server-side)
    const researchedLeads = [];
    
    for (const company of companies.slice(0, 10)) { // Limit to 10 for security
      const domain = company.website_url?.replace(/^https?:\/\//, '').split('/')[0] || 
                    company.name.toLowerCase().replace(/\s+/g, '') + '.com';
      
      // ✅ SECURITY: Validate domain format
      if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(domain)) {
        continue;
      }

      // Find email via Hunter (server-side)
      try {
        const hunterResponse = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterApiKey}`
        );
        
        if (hunterResponse.ok) {
          const hunterData = await hunterResponse.json();
          const email = hunterData.data?.emails?.[0]?.value || null;
          
          // ✅ SECURITY: Validate email format
          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            researchedLeads.push({
              business_name: company.name?.substring(0, 100) || '',
              email: email,
              website: company.website_url || `https://${domain}`,
              industry: company.industry || industryFocus,
              funding_amount: company.funding_amount,
              funding_date: company.funding_date,
              lead_quality: 'HOT'
            });
          }
        }
      } catch (err) {
        console.error(`Error fetching email for ${domain}:`, err);
        // Continue to next company
      }
    }

    return NextResponse.json({ leads: researchedLeads });
  } catch (error) {
    console.error('AI lead research error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to research leads' 
    }, { status: 500 });
  }
}
