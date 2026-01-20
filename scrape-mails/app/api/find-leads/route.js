// app/api/find-leads/route.js
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { fundingStage, industry } = await req.json();
    
    // 🔑 Get your Apollo.io API key from Vercel env
    const apolloApiKey = process.env.APOLLO_API_KEY;
    
    if (!apolloApiKey) {
      return NextResponse.json({ error: 'Apollo API key missing' }, { status: 500 });
    }

    // 📈 Build Apollo query
    const filters = {
      funding_stage: fundingStage,
      organization_industry_tag: industry,
      last_funding_date: { 
        gte: '2024-01-01' // Adjust based on fundingStage
      }
    };

    const response = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apolloApiKey
      },
      body: JSON.stringify({
        q_organization_name: '',
        page: 1,
        per_page: 20,
        ...filters
      })
    });

    const data = await response.json();
    
    // ✅ Format leads for your CSV
    const leads = data.companies.map(company => ({
      business_name: company.name,
      website: company.website_url,
      industry: company.industry,
      funding_amount: company.last_funding_amount,
      funding_date: company.last_funding_date,
      employee_count: company.estimated_num_employees,
      location: company.headquarters_location,
      lead_quality: 'HOT', // They're funded → HOT
      email: '' // Will be filled later
    }));

    return NextResponse.json({ leads });
  } catch (error) {
    console.error('Lead finder error:', error);
    return NextResponse.json({ error: 'Failed to find leads' }, { status: 500 });
  }
}