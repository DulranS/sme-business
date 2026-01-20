// app/api/research-lead/route.js
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { lead } = await req.json();
    
    // 🔑 Get API keys
    const claudeKey = process.env.CLAUDE_API_KEY;
    const hunterKey = process.env.HUNTER_API_KEY;
    
    if (!claudeKey || !hunterKey) {
      return NextResponse.json({ error: 'API keys missing' }, { status: 500 });
    }

    // 🔍 Step 1: Find CEO/Founder email
    const emailUrl = `https://api.hunter.io/v2/domain-search?domain=${lead.website}&api_key=${hunterKey}`;
    const emailRes = await fetch(emailUrl);
    const emailData = await emailRes.json();
    const contactEmail = emailData.data.emails?.[0]?.value || '';

    // 🧠 Step 2: Research with Claude
    const prompt = `
You are a B2B sales expert. Analyze this company:
- Name: ${lead.business_name}
- Industry: ${lead.industry}
- Funding: $${lead.funding_amount} on ${lead.funding_date}
- Size: ${lead.employee_count} employees
- Location: ${lead.location}

Your offer:
"NEXT.JS + WEBFLOW HYBRID SPECIALIST
- High-converting website (Webflow or Next.js)
- Lead capture + CRM setup
- Basic automations (no lost leads)
- Clean handover + optional support
They buy 'less chaos + more leads'"

Write a SHORT, personalized email (max 120 words) that:
1. Mentions their recent funding
2. Shows you understand their growth stage
3. Offers your service as the solution to scaling chaos
4. Ends with a soft call-to-action

Subject line: under 50 characters
Body: conversational, no jargon
`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const claudeData = await claudeRes.json();
    const fullText = claudeData.content[0].text;
    
    // Parse subject and body
    const subjectMatch = fullText.match(/Subject:\s*(.+?)\n/);
    const bodyMatch = fullText.match(/Body:\s*([\s\S]+)/);
    
    const subject = subjectMatch ? subjectMatch[1].trim() : 'Quick question for your team';
    const body = bodyMatch ? bodyMatch[1].trim() : fullText;

    return NextResponse.json({
      lead: {
        ...lead,
        email: contactEmail,
        researched_email_subject: subject,
        researched_email_body: body
      }
    });
  } catch (error) {
    console.error('Research error:', error);
    return NextResponse.json({ error: 'Research failed' }, { status: 500 });
  }
}