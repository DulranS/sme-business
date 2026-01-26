// app/api/smart-followup-generator/route.js
// ✅ Smart Follow-up Sequence Generator (2026 Feature)
// AI-generated personalized follow-up sequences based on lead behavior
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { 
      companyName, 
      leadBehavior, 
      previousEmails, 
      defaultTemplate,
      followUpNumber 
    } = await req.json();
    
    if (!companyName || !leadBehavior) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const behaviorContext = `
Lead Behavior:
- Opened: ${leadBehavior.opened ? 'Yes' : 'No'} (${leadBehavior.openedCount || 0} times)
- Clicked: ${leadBehavior.clicked ? 'Yes' : 'No'} (${leadBehavior.clickCount || 0} times)
- Replied: ${leadBehavior.replied ? 'Yes' : 'No'}
- Interest Score: ${leadBehavior.interestScore || 0}/100
- Days Since First Contact: ${leadBehavior.daysSinceSent || 0}
- Follow-up Number: ${followUpNumber || 1}
`;

    const prompt = `
You are an expert B2B email strategist. Generate a personalized follow-up email based on this lead's behavior.

Company: ${companyName}
${behaviorContext}

Default Email Template Context:
${defaultTemplate || 'Standard outreach template'}

Previous Emails Sent: ${previousEmails || 0}

Generate a follow-up email that:
1. Adapts to their engagement level (${leadBehavior.opened && leadBehavior.clicked ? 'high engagement' : leadBehavior.opened ? 'medium engagement' : 'low engagement'})
2. Uses appropriate tone (${followUpNumber === 1 ? 'gentle reminder' : followUpNumber === 2 ? 'value-first' : 'final attempt'})
3. Includes a clear, soft call-to-action
4. Is personalized and relevant

Respond in JSON:
{
  "subject": "Subject line (max 50 chars)",
  "body": "Email body (max 150 words, conversational)",
  "strategy": "Brief explanation of strategy used",
  "cta": "Call-to-action recommendation"
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    let followUpEmail;
    try {
      followUpEmail = JSON.parse(response.text());
    } catch (e) {
      // Fallback follow-up
      followUpEmail = {
        subject: `Quick follow-up - ${companyName}`,
        body: `Hi ${companyName},\n\nJust wanted to check in and see if you'd be interested in learning more about how we can help.\n\nNo pressure at all - happy to answer any questions!\n\nBest regards`,
        strategy: 'Gentle follow-up based on engagement level',
        cta: 'Reply or schedule a call'
      };
    }
    
    return NextResponse.json({
      success: true,
      followUpEmail: {
        subject: followUpEmail.subject || `Follow-up: ${companyName}`,
        body: followUpEmail.body || '',
        strategy: followUpEmail.strategy || 'Standard follow-up',
        cta: followUpEmail.cta || 'Reply to continue conversation'
      },
      recommendations: [
        `Send ${followUpNumber === 1 ? 'gentle reminder' : followUpNumber === 2 ? 'value-first offer' : 'final attempt'}`,
        leadBehavior.opened && leadBehavior.clicked ? 'They\'re engaged - focus on closing' :
        leadBehavior.opened ? 'They opened but didn\'t click - try different angle' :
        'Low engagement - provide more value',
        `Optimal send time: ${leadBehavior.openedAt ? 'Same time they opened last email' : '9-11 AM'}`
      ]
    });
  } catch (error) {
    console.error('Follow-up generator error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate follow-up' 
    }, { status: 500 });
  }
}
