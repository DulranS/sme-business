// app/api/sentiment-analysis/route.js
// ✅ Sentiment Analysis for Replies (2026 Feature)
// Analyzes reply sentiment to prioritize hot leads
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req) {
  try {
    const { replyText, leadEmail } = await req.json();
    
    if (!replyText) {
      return NextResponse.json({ error: 'Reply text required' }, { status: 400 });
    }

    // ✅ Use Gemini Flash for cost-efficient sentiment analysis
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Analyze this email reply for sentiment and buying intent. Classify as:

1. Sentiment: "positive", "neutral", "negative", or "interested"
2. Buying Intent: "high", "medium", "low", or "none"
3. Urgency: "urgent", "moderate", "low", or "none"
4. Key Topics: List main topics mentioned
5. Action Items: What should the salesperson do next?

Reply Text:
"${replyText}"

Respond in JSON format:
{
  "sentiment": "...",
  "buyingIntent": "...",
  "urgency": "...",
  "keyTopics": ["topic1", "topic2"],
  "actionItems": ["action1", "action2"],
  "summary": "Brief summary",
  "priorityScore": 0-100
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    let analysis;
    try {
      analysis = JSON.parse(response.text());
    } catch (e) {
      // Fallback analysis
      const lowerText = replyText.toLowerCase();
      const positiveWords = ['interested', 'yes', 'sounds good', 'let\'s', 'sure', 'definitely', 'great'];
      const negativeWords = ['not interested', 'no thanks', 'unsubscribe', 'stop'];
      const urgentWords = ['asap', 'urgent', 'immediately', 'soon', 'quick'];
      
      const hasPositive = positiveWords.some(w => lowerText.includes(w));
      const hasNegative = negativeWords.some(w => lowerText.includes(w));
      const hasUrgent = urgentWords.some(w => lowerText.includes(w));
      
      analysis = {
        sentiment: hasNegative ? 'negative' : hasPositive ? 'interested' : 'neutral',
        buyingIntent: hasPositive ? 'high' : hasNegative ? 'none' : 'medium',
        urgency: hasUrgent ? 'urgent' : hasPositive ? 'moderate' : 'low',
        keyTopics: [],
        actionItems: hasPositive ? ['Follow up immediately', 'Schedule a call'] : ['Send nurturing content'],
        summary: hasPositive ? 'Shows interest' : hasNegative ? 'Not interested' : 'Neutral response',
        priorityScore: hasPositive ? 80 : hasNegative ? 10 : 40
      };
    }
    
    // ✅ Calculate priority score
    let priorityScore = analysis.priorityScore || 50;
    if (analysis.sentiment === 'interested') priorityScore += 20;
    if (analysis.buyingIntent === 'high') priorityScore += 15;
    if (analysis.urgency === 'urgent') priorityScore += 10;
    
    priorityScore = Math.min(100, Math.max(0, priorityScore));
    
    // ✅ Determine priority level
    let priorityLevel = 'Medium';
    if (priorityScore >= 75) priorityLevel = 'Critical';
    else if (priorityScore >= 60) priorityLevel = 'High';
    else if (priorityScore >= 40) priorityLevel = 'Medium';
    else priorityLevel = 'Low';
    
    return NextResponse.json({
      success: true,
      sentiment: analysis.sentiment,
      buyingIntent: analysis.buyingIntent,
      urgency: analysis.urgency,
      keyTopics: analysis.keyTopics || [],
      actionItems: analysis.actionItems || [],
      summary: analysis.summary || 'Neutral response',
      priorityScore: Math.round(priorityScore),
      priorityLevel,
      recommendations: [
        priorityScore >= 75 ? '🔥 CRITICAL: Respond within 1 hour' : 
        priorityScore >= 60 ? '⚡ HIGH: Respond within 4 hours' :
        priorityScore >= 40 ? '📧 MEDIUM: Respond within 24 hours' :
        '💤 LOW: Add to nurture sequence',
        analysis.buyingIntent === 'high' ? 'Focus on closing - they\'re ready' :
        analysis.buyingIntent === 'medium' ? 'Provide more value and education' :
        'Long-term nurture approach'
      ]
    });
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to analyze sentiment' 
    }, { status: 500 });
  }
}
