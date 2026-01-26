// app/api/research-company/route.js
// ✅ Cost-efficient AI research using Google Gemini Flash (cheaper than Claude)
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { companyName, companyWebsite, defaultEmailTemplate, userId } = await req.json();
    
    if (!companyName || !defaultEmailTemplate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ✅ Use Gemini Flash for cost efficiency (much cheaper than Claude)
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Cost-efficient model

    // ✅ Extract general idea/value proposition from default email template
    const extractGeneralIdeaPrompt = `
Extract the core value proposition and general idea from this email template. 
Focus on what service/product is being offered and the main benefits.

Email Template:
${defaultEmailTemplate}

Provide a concise summary (2-3 sentences) of:
1. What service/product is being offered
2. The main value proposition or benefits
3. Who this is for

Format as JSON:
{
  "service": "...",
  "valueProposition": "...",
  "targetAudience": "..."
}
`;

    const ideaResult = await model.generateContent(extractGeneralIdeaPrompt);
    const ideaResponse = await ideaResult.response;
    let generalIdea;
    try {
      generalIdea = JSON.parse(ideaResponse.text());
    } catch (e) {
      // Fallback if JSON parsing fails
      generalIdea = {
        service: "Digital services and automation",
        valueProposition: "Reliable execution across web, software, AI automation, and ongoing digital operations",
        targetAudience: "Small to mid-sized agencies and businesses"
      };
    }

    // ✅ Research the specific company
    const researchPrompt = `
You are a B2B sales research expert. Research this company and create a personalized email.

Company Name: ${companyName}
Company Website: ${companyWebsite || 'Not provided'}

Service Being Offered:
${generalIdea.service}

Value Proposition:
${generalIdea.valueProposition}

Target Audience:
${generalIdea.targetAudience}

Research this company and write a SHORT, personalized email (max 120 words) that:
1. Shows you understand their business/industry
2. Mentions something specific about them (if found)
3. Connects your service to their potential needs
4. Ends with a soft call-to-action

Subject line: under 50 characters, personalized
Body: conversational, no jargon, personalized to this company

Format as JSON:
{
  "subject": "...",
  "body": "...",
  "researchNotes": "Brief notes about what you found about the company"
}
`;

    const researchResult = await model.generateContent(researchPrompt);
    const researchResponse = await researchResult.response;
    let personalizedEmail;
    try {
      personalizedEmail = JSON.parse(researchResponse.text());
    } catch (e) {
      // Fallback if JSON parsing fails
      personalizedEmail = {
        subject: `Quick question for ${companyName}`,
        body: `Hi ${companyName},\n\n${generalIdea.valueProposition}\n\nWould you be open to a quick chat about how we can help?\n\nBest regards`,
        researchNotes: "Company research completed"
      };
    }

    return NextResponse.json({
      success: true,
      companyName,
      generalIdea,
      personalizedEmail: {
        subject: personalizedEmail.subject || `Quick question for ${companyName}`,
        body: personalizedEmail.body || '',
        researchNotes: personalizedEmail.researchNotes || ''
      }
    });
  } catch (error) {
    console.error('Company research error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to research company' 
    }, { status: 500 });
  }
}
