// app/api/verify-emails/route.js
// Email verification via third-party service (ZeroBounce, etc.)

export async function POST(req) {
  try {
    const { emails, userId } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return Response.json(
        { error: 'Missing emails array' },
        { status: 400 }
      );
    }

    if (emails.length > 1000) {
      return Response.json(
        { error: 'Max 1000 emails per request' },
        { status: 400 }
      );
    }

    // ✅ Local validation first (fast)
    const results = emails.map(email => {
      const cleaned = email.trim().toLowerCase();
      const basic = isBasicEmailValid(cleaned);

      return {
        email: cleaned,
        valid: basic,
        confidence: basic ? 'medium' : 'low',
        risk: getEmailRisk(cleaned),
        warning: getEmailWarning(cleaned)
      };
    });

    // ✅ Optionally call ZeroBounce API if configured
    if (process.env.ZEROBOUNCE_API_KEY) {
      const validEmails = results.filter(r => r.valid);
      
      for (const result of validEmails) {
        try {
          const zbRes = await fetch(
            `https://api.zerobounce.net/v1/validate?email=${result.email}&api_key=${process.env.ZEROBOUNCE_API_KEY}`
          );
          const zbData = await zbRes.json();

          if (zbData.status === 'invalid') {
            result.valid = false;
            result.confidence = 'high';
            result.risk = 'high';
          } else if (zbData.status === 'valid') {
            result.confidence = 'high';
          }
        } catch (zbError) {
          console.warn(`[verify-emails] ZeroBounce check failed for ${result.email}:`, zbError.message);
        }
      }
    }

    const stats = {
      total: results.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      highRisk: results.filter(r => r.risk === 'high').length
    };

    return Response.json({
      success: true,
      results,
      stats,
      message: `Verified ${stats.valid}/${stats.total} emails`
    });

  } catch (error) {
    console.error('[verify-emails] Error:', error);
    return Response.json(
      { error: error.message || 'Verification failed' },
      { status: 500 }
    );
  }
}

function isBasicEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
         !['test', 'example', 'demo'].some(w => email.includes(w)) &&
         email.length >= 5 && email.length <= 254;
}

function getEmailRisk(email) {
  const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'maildrop.cc'];
  if (disposableDomains.some(d => email.includes(d))) return 'high';
  if (['info@', 'support@', 'noreply@'].some(p => email.startsWith(p))) return 'medium';
  return 'low';
}

function getEmailWarning(email) {
  const roleEmails = ['info', 'hello', 'support', 'sales', 'contact'];
  if (roleEmails.some(r => email.startsWith(r + '@'))) return 'Role-based (not person-specific)';
  if (email.includes('+')) return 'Plus addressing detected';
  return null;
}